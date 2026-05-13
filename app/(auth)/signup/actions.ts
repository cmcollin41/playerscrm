"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import {
  createSubscriptionCheckoutSession,
  getOrCreatePlatformCustomer,
  type SubscriptionPlan,
} from "@/lib/billing"
import { slugify, slugWithSuffix } from "@/lib/slugify"

interface SignupInput {
  email: string
  password: string
  firstName: string
  lastName: string
  orgName: string
  programName: string
  sport: string
  plan: SubscriptionPlan
}

interface SignupResult {
  error?: string
  checkoutUrl?: string
}

const VALID_PLANS: SubscriptionPlan[] = ["annual", "monthly"]

/**
 * Self-serve onboarding. Creates the auth user, the organization, the
 * first account under it, the profile + memberships, then returns a
 * Stripe Checkout URL for the chosen subscription plan. The client
 * redirects there; the post-checkout flow (PR C/D) flips
 * subscription_status to 'active' and lets the user into the dashboard.
 */
export async function createSignup(
  raw: Partial<SignupInput>,
): Promise<SignupResult> {
  const email = (raw.email ?? "").trim().toLowerCase()
  const password = raw.password ?? ""
  const firstName = (raw.firstName ?? "").trim()
  const lastName = (raw.lastName ?? "").trim()
  const orgName = (raw.orgName ?? "").trim()
  const programName = (raw.programName ?? "").trim()
  const sport = (raw.sport ?? "").trim() || "basketball"
  const plan: SubscriptionPlan =
    VALID_PLANS.includes(raw.plan as SubscriptionPlan)
      ? (raw.plan as SubscriptionPlan)
      : "annual"

  if (!email.includes("@")) return { error: "Enter a valid email address." }
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." }
  if (!firstName) return { error: "Enter your first name." }
  if (!lastName) return { error: "Enter your last name." }
  if (!orgName) return { error: "Enter your school or club name." }
  if (!programName) return { error: "Enter your program name." }

  const supabase = await createClient()
  const admin = createAdminClient()

  // Step 1: create the auth user. This also signs them in via SSR cookie.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
    },
  })

  if (signUpError || !signUpData.user) {
    return {
      error:
        signUpError?.message === "User already registered"
          ? "An account with that email already exists. Try signing in instead."
          : signUpError?.message ?? "Could not create user.",
    }
  }

  const userId = signUpData.user.id

  // Step 2: organization with a unique slug.
  const orgSlugBase = slugify(orgName) || "team"
  let orgSlug = orgSlugBase
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .maybeSingle()
    if (!existing) break
    orgSlug = slugWithSuffix(orgSlugBase)
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: orgName, slug: orgSlug })
    .select()
    .single()

  if (orgError || !org) {
    console.error("createSignup organization insert:", orgError?.message)
    return { error: "Could not create your organization. Try again." }
  }

  // Step 3: first account under the org.
  const accountSubdomainBase = slugify(programName) || slugify(orgName) || "team"
  let accountSubdomain = accountSubdomainBase
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: existing } = await admin
      .from("accounts")
      .select("id")
      .eq("subdomain", accountSubdomain)
      .maybeSingle()
    if (!existing) break
    accountSubdomain = slugWithSuffix(accountSubdomainBase)
  }

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .insert({
      name: programName,
      sport,
      organization_id: org.id,
      subdomain: accountSubdomain,
      subscription_status: "none",
    })
    .select()
    .single()

  if (accountError || !account) {
    console.error("createSignup account insert:", accountError?.message)
    return { error: "Could not create your program. Try again." }
  }

  // Step 4: profile row tied to the new auth user.
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    created_at: new Date().toISOString(),
    role: "general",
    first_name: firstName,
    last_name: lastName,
    email,
    account_id: account.id,
    current_account_id: account.id,
  })

  if (profileError) {
    console.error("createSignup profile insert:", profileError.message)
    return { error: "Could not finalize your profile. Try again." }
  }

  // Step 5: memberships — owner on both the org and the first account.
  const { error: orgMemberError } = await admin
    .from("organization_members")
    .insert({
      organization_id: org.id,
      profile_id: userId,
      role: "owner",
    })

  if (orgMemberError) {
    console.error("createSignup org_members insert:", orgMemberError.message)
  }

  const { error: acctMemberError } = await admin
    .from("account_members")
    .insert({
      account_id: account.id,
      profile_id: userId,
      role: "owner",
    })

  if (acctMemberError) {
    console.error("createSignup account_members insert:", acctMemberError.message)
  }

  // Step 6: Stripe customer for the account.
  let checkoutUrl: string
  try {
    const customerId = await getOrCreatePlatformCustomer(
      admin,
      {
        id: account.id,
        name: account.name,
        platform_stripe_customer_id: account.platform_stripe_customer_id,
        subscription_id: account.subscription_id,
        subscription_status: account.subscription_status,
        subscription_current_period_end:
          account.subscription_current_period_end,
      },
      email,
    )

    checkoutUrl = await createSubscriptionCheckoutSession(account.id, {
      plan,
      customerId,
    })
  } catch (err: any) {
    console.error("createSignup checkout:", err?.message ?? err)
    return {
      error:
        "Account created, but we couldn't start checkout. Sign in and try again from /billing.",
    }
  }

  return { checkoutUrl }
}

/**
 * Server-action variant that always redirects on success. Lets the form
 * use `action={signupAndRedirect}` so the browser navigates to Stripe
 * Checkout via a 303 instead of a client-side window.location.
 */
export async function signupAndRedirect(formData: FormData): Promise<void> {
  const result = await createSignup({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    firstName: String(formData.get("first_name") ?? ""),
    lastName: String(formData.get("last_name") ?? ""),
    orgName: String(formData.get("org_name") ?? ""),
    programName: String(formData.get("program_name") ?? ""),
    sport: String(formData.get("sport") ?? ""),
    plan: (String(formData.get("plan") ?? "annual") as SubscriptionPlan),
  })

  if (result.error || !result.checkoutUrl) {
    redirect(
      `/signup?error=${encodeURIComponent(result.error ?? "Signup failed")}`,
    )
  }

  redirect(result.checkoutUrl)
}

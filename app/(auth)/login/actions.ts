'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@/lib/supabase/admin'
import { authCallbackRedirectUrl } from '@/lib/auth-site'
import { findInviteByToken, inviteProblem, redeemInvite } from '@/lib/invites'
import {
  ensureAccountMembership,
  normalizeSignupEmail,
  resolvePeopleIdForAccountSignup,
  syncProfileAfterSignup,
} from '@/lib/signup-invite'

export async function login(formData: any): Promise<{ error?: string } | void> {
  const supabase = await createClient()

  const email = formData.get('email')
  const password = formData.get('password')

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error('Login error:', error.message)
    return { error: error.message }
  }

  // revalidatePath('/dashboard')
  redirect('/')
}

export async function signup(formData: FormData): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const emailRaw = String(formData.get("email") || "")
  const email = normalizeSignupEmail(emailRaw)
  const password = String(formData.get("password"))
  const first_name = String(formData.get("first_name") || "")
  const last_name = String(formData.get("last_name") || "")
  const from_events = formData.get("from_events") as string | null
  const inviteToken = String(formData.get("invite") || "")

  if (!email || !password) {
    return redirect(`/login?error=${encodeURIComponent("Email and password are required")}`)
  }

  const invite = await findInviteByToken(admin, inviteToken)
  const problem = inviteProblem(invite, email, new Date())
  if (problem || !invite) {
    return redirect(
      `/login?error=${encodeURIComponent(problem || "An invitation is required to create an account.")}`,
    )
  }

  const account_id = invite.account_id
  const invite_role = invite.role
  const explicitPeopleId = invite.people_id

  const people_id = await resolvePeopleIdForAccountSignup(
    admin,
    account_id,
    email,
    explicitPeopleId,
  )

  const payload: Record<string, unknown> = {
    first_name,
    last_name,
    email,
    account_id,
    role: "general",
    invite_role,
  }
  if (people_id) payload.people_id = people_id

  const { error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: payload,
  })

  if (signUpError) {
    console.log("SIGN UP ERROR", signUpError)
    const msg = signUpError.message || "Could not create user account"
    return redirect(`/login?error=${encodeURIComponent(msg)}`)
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !signInData.user) {
    console.log("SIGN IN ERROR", signInError)
    return redirect(`/login?error=Account created but could not sign in. Please try logging in.`)
  }

  const userId = signInData.user.id

  const redeemed = await redeemInvite(admin, invite.id)
  if (!redeemed) {
    return redirect(
      `/login?error=${encodeURIComponent("This invitation has already been used.")}`,
    )
  }

  await ensureAccountMembership(admin, account_id, userId, invite_role)
  await syncProfileAfterSignup(
    admin,
    userId,
    account_id,
    people_id,
    first_name,
    last_name,
    email,
  )

  const { data: acctRow } = await admin
    .from("accounts")
    .select("subdomain")
    .eq("id", account_id)
    .maybeSingle()

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "playerscrm.com"
  const proto = rootDomain.startsWith("localhost") ? "http" : "https"
  const host = acctRow?.subdomain
    ? `${acctRow.subdomain}.${rootDomain}`
    : rootDomain
  const path =
    from_events === "true"
      ? `/?from_events=true&account_id=${account_id}`
      : `/`

  revalidatePath('/', 'layout')
  return redirect(`${proto}://${host}${path}`)
}

export async function logout() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function resetPassword(email: string) {
  const supabase = await createClient()

  if (!email) {
    return { error: 'Email is required' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackRedirectUrl("/update-password"),
  })

  if (error) {
    console.error('Reset password error:', error.message)
    return { error: error.message }
  }

  return { success: true }
}
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@/lib/supabase/admin'
import { authCallbackRedirectUrl } from '@/lib/auth-site'
import {
  ensureAccountMembership,
  normalizeSignupEmail,
  parseInviteRole,
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
  const account_id = String(formData.get("account_id") || "")
  const people_id_raw = String(formData.get("people_id") || "").trim()
  const explicitPeopleId = people_id_raw.length > 0 ? people_id_raw : null
  const first_name = String(formData.get("first_name") || "")
  const last_name = String(formData.get("last_name") || "")
  const from_events = formData.get("from_events") as string | null
  const invite_role = parseInviteRole(String(formData.get("invite_role") || ""))

  if (!email || !password || !account_id) {
    return redirect(`/login?error=${encodeURIComponent("Email, password, and account are required")}`)
  }

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

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authCallbackRedirectUrl("/"),
      data: payload,
    },
  })

  if (signUpError) {
    console.log("SIGN UP ERROR", signUpError)
    return redirect(`/login?error=Could not create user account`)
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

  let redirectUrl =
    from_events === "true"
      ? `/dashboard?from_events=true&account_id=${account_id}`
      : `/dashboard`

  revalidatePath('/', 'layout')
  return redirect(redirectUrl)
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
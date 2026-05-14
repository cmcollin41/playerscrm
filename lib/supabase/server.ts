import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function authCookieDomain(): string | undefined {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (!root) return undefined
  const host = root.split(":")[0]
  if (host === "localhost" || host === "127.0.0.1") return undefined
  return `.${host}`
}

/**
 * supabase-js throws AuthApiError (e.g. "Invalid Refresh Token: Refresh
 * Token Not Found") when it can't refresh a stale session cookie. That
 * crashes any server component / route that calls auth.getUser() without
 * a try/catch — which is most of them. Wrap the auth methods so a refresh
 * failure becomes a clean "no user" instead of a 500.
 */
function isAuthRefreshError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; status?: number; message?: string; __isAuthError?: boolean }
  if (e.__isAuthError !== true) return false
  if (e.code === 'refresh_token_not_found') return true
  if (typeof e.message === 'string' && /refresh token/i.test(e.message)) return true
  return false
}

export async function createClient() {
  const cookieStore = await cookies()

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            const domain = authCookieDomain()
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                domain: options?.domain ?? domain,
              })
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  const originalGetUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = (async (...args: Parameters<typeof originalGetUser>) => {
    try {
      return await originalGetUser(...args)
    } catch (err) {
      if (isAuthRefreshError(err)) {
        return { data: { user: null }, error: null } as unknown as Awaited<
          ReturnType<typeof originalGetUser>
        >
      }
      throw err
    }
  }) as typeof client.auth.getUser

  const originalGetSession = client.auth.getSession.bind(client.auth)
  client.auth.getSession = (async () => {
    try {
      return await originalGetSession()
    } catch (err) {
      if (isAuthRefreshError(err)) {
        return { data: { session: null }, error: null } as unknown as Awaited<
          ReturnType<typeof originalGetSession>
        >
      }
      throw err
    }
  }) as typeof client.auth.getSession

  return client
}

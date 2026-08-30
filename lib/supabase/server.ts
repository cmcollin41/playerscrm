import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

function authCookieDomain(requestHost: string | null): string | undefined {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (!root) return undefined
  const rootHost = root.split(":")[0]
  if (rootHost === "localhost" || rootHost === "127.0.0.1") return undefined
  if (!requestHost) return undefined
  const reqHost = requestHost.split(":")[0]
  // Span across subdomains only when the request is actually under the root
  // domain. Custom domains (e.g. app.provobasketball.com) get host-only
  // cookies — the browser drops a `Domain=.varsityhabits.com` cookie when the
  // request came in on a different domain, killing the session.
  if (reqHost === rootHost || reqHost.endsWith(`.${rootHost}`)) {
    return `.${rootHost}`
  }
  return undefined
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
  const headerList = await headers()
  const requestHost = headerList.get('host')

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
            const domain = authCookieDomain(requestHost)
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

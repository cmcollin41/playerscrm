import { createBrowserClient } from '@supabase/ssr'

// The browser client must scope its auth cookie with the SAME domain the
// server clients use (see `authCookieDomain` in lib/supabase/server.ts and
// proxy.ts). On the apex/subdomains the server sets `Domain=.varsityhabits.com`,
// so if the browser wrote a host-only cookie of the same name we'd end up with
// two `sb-*-auth-token` cookies and supabase-js would read them ambiguously,
// breaking the session. Custom domains stay host-only on both sides.
function authCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (!root) return undefined
  const rootHost = root.split(':')[0]
  if (rootHost === 'localhost' || rootHost === '127.0.0.1') return undefined
  const reqHost = window.location.hostname
  if (reqHost === rootHost || reqHost.endsWith(`.${rootHost}`)) {
    return `.${rootHost}`
  }
  return undefined
}

export const createClient = () => {
  const domain = authCookieDomain()
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    domain ? { cookieOptions: { domain } } : undefined
  )
}

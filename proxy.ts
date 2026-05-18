import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

function authCookieDomain(): string | undefined {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (!root) return undefined
  const host = root.split(":")[0]
  if (host === "localhost" || host === "127.0.0.1") return undefined
  return `.${host}`
}

export const config = {
  // Skip the proxy on auto-generated metadata routes (OG/Twitter images,
  // favicon, sitemap, robots) and any path with a file extension. Without
  // this, unauthenticated social-card bots get redirected to /login when
  // trying to fetch /opengraph-image, and the og:image meta tag breaks.
  matcher: [
    "/((?!api/|_next/|_static/|_vercel|opengraph-image|twitter-image|icon|apple-icon|favicon|sitemap|robots|[\\w-]+\\.\\w+).*)",
  ],
}

// Refresh-token errors (commonly "Invalid Refresh Token: Refresh Token Not
// Found" after a cookie goes stale) get thrown asynchronously from inside
// supabase-js and crash the request. Treat any auth failure as "no session"
// so the proxy can route the user to the login page instead of a 500. The
// supabase-js cookie handler will have already cleared the bad refresh
// token on the response by the time we get here.
async function safeGetSession(
  supabase: SupabaseClient,
): Promise<{ user: { id: string; email?: string } } | null> {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) return null
    return data.session
      ? { user: { id: data.session.user.id, email: data.session.user.email } }
      : null
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[proxy] getSession threw, treating as anon:", err)
    }
    return null
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          const domain = authCookieDomain()
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              domain: options?.domain ?? domain,
            }),
          )
        },
      },
    },
  )

  const url = request.nextUrl
  const hostname = request.headers.get("host") || ""
  const path = url.pathname

  // Determine root domain (e.g. "athletes.app" or "localhost:3000")
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"

  // Extract subdomain or detect custom domain
  // hostname: "provobasketball.athletes.app" → subdomain: "provobasketball"
  // hostname: "athletes.app" → subdomain: null
  // hostname: "app.provobasketball.com" → customDomain: "app.provobasketball.com"
  let subdomain: string | null = null
  let customDomain: string | null = null

  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    // Root domain or www — no tenant
  } else {
    const sub = hostname.replace(`.${rootDomain}`, "")
    if (sub !== hostname) {
      // It's a subdomain of our root domain
      subdomain = sub
    } else {
      // Not our root domain at all — treat as custom domain
      customDomain = hostname
    }
  }

  // Handle www redirect
  if (hostname === `www.${rootDomain}`) {
    return NextResponse.redirect(
      new URL(`https://${rootDomain}${path}`, request.url),
      { status: 301 },
    )
  }

  // --- Custom domain: look up account and treat like a subdomain ---
  if (customDomain) {
    // Tenant resolution must always run as anon — using the cookie-bound
    // client filters accounts via RLS (authenticated users only see
    // accounts they're members of), which would 404 a custom domain for
    // anyone signed in to a different tenant.
    const tenantLookup = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {},
        },
      },
    )

    const { data: account } = await tenantLookup
      .from("accounts")
      .select("subdomain")
      .eq("custom_domain", customDomain)
      .maybeSingle()

    if (account?.subdomain) {
      subdomain = account.subdomain
    } else {
      // Unknown custom domain — redirect to root
      return NextResponse.redirect(
        new URL(`https://${rootDomain}`, request.url),
        { status: 302 },
      )
    }
  }

  // --- Root domain: serve marketing/home pages ---
  if (!subdomain) {
    if (
      path === "/" ||
      path === "/demo" ||
      path === "/docs" ||
      path.startsWith("/docs/") ||
      path.startsWith("/home")
    ) {
      const rewritePath =
        path === "/"
          ? "/home"
          : path.startsWith("/home")
            ? path
            : `/home${path}`
      const rewritten = NextResponse.rewrite(
        new URL(rewritePath, request.url),
      )
      response.cookies.getAll().forEach(({ name, value }) => {
        rewritten.cookies.set(name, value)
      })
      return rewritten
    }

    // Login, dashboard, etc. still accessible from root domain
    const session = await safeGetSession(supabase)

    const publicPaths = [
      "/login",
      "/signup",
      "/portal-login",
      "/portal/auth",
      "/forgot-password",
      "/update-password",
      "/no-access",
    ]
    const isPublicPath = publicPaths.some((p) => path.startsWith(p))
    const isPortalPath = path === "/portal" || path.startsWith("/portal/")

    if (!session && !isPublicPath) {
      // Send unauth users hitting a private portal path to the magic-link
      // entry instead of the password-only /login.
      const loginPath = isPortalPath ? "/portal-login" : "/login"
      return NextResponse.redirect(new URL(loginPath, request.url))
    } else if (session && path === "/login") {
      return NextResponse.redirect(new URL("/", request.url))
    }

    // Authenticated user on a private path: figure out whether they're a
    // staff/admin (has account_members), a parent (profile.people_id but no
    // account_members), or truly unbound.
    if (session && !isPublicPath) {
      const { data: accountIds } = await supabase.rpc("get_user_account_ids")
      const isStaff = !!accountIds && accountIds.length > 0

      if (!isStaff) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("people_id")
          .eq("id", session.user.id)
          .maybeSingle()

        if (profile?.people_id) {
          // Parent. Allow through if they're already inside /portal/*; route
          // them there otherwise.
          if (!isPortalPath) {
            return NextResponse.redirect(new URL("/portal/welcome", request.url))
          }
        } else {
          return NextResponse.redirect(new URL("/no-access", request.url))
        }
      }
    }

    return response
  }

  // --- Subdomain: tenant routes ---
  // Pass the subdomain to downstream pages via header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-subdomain", subdomain)

  // Public tenant paths that don't require auth. `/store` covers the hosted
  // storefront catalog + product detail pages. Org-admin product management
  // lives at `/products/*` (a private dashboard route).
  const tenantPublicPaths = [
    "/register",
    "/store",
    "/login",
    "/signup",
    "/portal-login",
    "/portal/auth",
    "/forgot-password",
    "/update-password",
    "/no-access",
  ]
  const isPublicTenantPath = tenantPublicPaths.some((p) => path.startsWith(p))
  const isPortalPath = path === "/portal" || path.startsWith("/portal/")

  // Check auth for protected tenant routes
  const session = await safeGetSession(supabase)

  if (!session && !isPublicTenantPath && path !== "/") {
    const loginPath = isPortalPath ? "/portal-login" : "/login"
    return NextResponse.redirect(new URL(loginPath, request.url))
  } else if (session && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Authenticated user on a private path: staff (account_members), parent
  // (profile.people_id only), or unbound. Parents are routed to /portal/*.
  if (session && !isPublicTenantPath) {
    const { data: accountIds } = await supabase.rpc("get_user_account_ids")
    const isStaff = !!accountIds && accountIds.length > 0

    if (!isStaff) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("people_id")
        .eq("id", session.user.id)
        .maybeSingle()

      if (profile?.people_id) {
        if (!isPortalPath) {
          return NextResponse.redirect(new URL("/portal/welcome", request.url))
        }
      } else {
        return NextResponse.redirect(new URL("/no-access", request.url))
      }
    }
  }

  response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Re-apply cookie changes from supabase auth refresh
  const supabaseRefresh = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )
  await supabaseRefresh.auth.getSession()

  return response
}

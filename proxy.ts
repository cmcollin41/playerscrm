import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const config = {
  matcher: ["/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)"],
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
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
    const { data: account } = await supabase
      .from("accounts")
      .select("subdomain")
      .eq("custom_domain", customDomain)
      .single()

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
      path === "/portal" ||
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
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const publicPaths = ["/login", "/forgot-password", "/update-password"]
    const isPublicPath = publicPaths.some((p) => path.startsWith(p))

    if (!session && !isPublicPath) {
      return NextResponse.redirect(new URL("/login", request.url))
    } else if (session && path === "/login") {
      return NextResponse.redirect(new URL("/", request.url))
    }

    return response
  }

  // --- Subdomain: tenant routes ---
  // Pass the subdomain to downstream pages via header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-subdomain", subdomain)

  // Public tenant paths that don't require auth
  const tenantPublicPaths = [
    "/register",
    "/login",
    "/forgot-password",
    "/update-password",
  ]
  const isPublicTenantPath = tenantPublicPaths.some((p) => path.startsWith(p))

  // Check auth for protected tenant routes
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && !isPublicTenantPath && path !== "/") {
    return NextResponse.redirect(new URL("/login", request.url))
  } else if (session && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url))
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

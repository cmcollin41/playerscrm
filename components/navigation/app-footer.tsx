import Image from "next/image"
import Link from "next/link"

interface FooterLink {
  href: string
  label: string
}

interface AppFooterProps {
  accountLogoUrl?: string | null
  accountName?: string | null
  links: FooterLink[]
  maxWidthClass?: string
}

export function AppFooter({
  accountLogoUrl,
  accountName,
  links,
  maxWidthClass = "max-w-5xl",
}: AppFooterProps) {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className={`mx-auto flex ${maxWidthClass} flex-col items-center gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between`}>
        <div className="flex items-center gap-3">
          <Image
            src="/athletes-logo.png"
            width={32}
            height={32}
            alt="Varsity Habits"
          />
          {accountLogoUrl ? (
            <>
              <span aria-hidden="true" className="text-gray-300">
                ×
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element -- tenant logo URL is opaque; Image would need remotePatterns */}
              <img
                src={accountLogoUrl}
                width={32}
                height={32}
                alt={accountName ? `${accountName} logo` : ""}
                className="h-8 w-8 object-contain"
              />
            </>
          ) : null}
          {accountName ? (
            <span className="text-sm font-medium text-gray-700">
              {accountName}
            </span>
          ) : null}
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600 sm:justify-end">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-gray-900">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Varsity Habits
      </p>
    </footer>
  )
}

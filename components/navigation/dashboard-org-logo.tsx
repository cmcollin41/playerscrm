"use client"

import Image from "next/image"
import { useCallback, useState } from "react"

interface DashboardHeaderLogoProps {
  orgLogoUrl?: string
  orgName?: string
}

export function DashboardHeaderLogo({ orgLogoUrl, orgName }: DashboardHeaderLogoProps) {
  const [useDefault, setUseDefault] = useState(false)
  const onError = useCallback(() => setUseDefault(true), [])

  if (!orgLogoUrl || useDefault) {
    return <Image src="/logo.svg" width={50} height={50} alt="Athletes App" />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL; onError falls back to default mark
    <img
      src={orgLogoUrl}
      width={50}
      height={50}
      alt={orgName ? `${orgName} logo` : "Organization logo"}
      className="h-[50px] w-[50px] object-contain"
      onError={onError}
    />
  )
}

interface DashboardFooterOrgLogoProps {
  orgLogoUrl?: string
}

export function DashboardFooterOrgLogo({ orgLogoUrl }: DashboardFooterOrgLogoProps) {
  const [hidden, setHidden] = useState(false)
  const onError = useCallback(() => setHidden(true), [])

  if (!orgLogoUrl || hidden) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={orgLogoUrl}
      width={44}
      height={44}
      alt=""
      className="object-contain opacity-90"
      onError={onError}
    />
  )
}

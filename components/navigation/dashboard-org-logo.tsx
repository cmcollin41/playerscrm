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
    return (
      <Image
        src="/vh.svg"
        width={50}
        height={50}
        alt="PlayersCRM"
        unoptimized
      />
    )
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


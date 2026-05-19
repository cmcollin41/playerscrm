import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile, hasAccountAdminAccess } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ExternalLink, Plug } from "lucide-react"
import { ConnectButton } from "./connect-button"
import { DisconnectButton } from "./disconnect-button"

export const dynamic = "force-dynamic"

interface PartnerRow {
  id: string
  slug: string
  name: string
  adapter_key: string
  config: { docs_url?: string; token_setup_url?: string; description?: string }
}

interface ConnectionRow {
  id: string
  partner_id: string
  external_shop_id: string | null
  external_account_label: string | null
  is_active: boolean
  last_synced_at: string | null
}

export default async function IntegrationsSettingsPage() {
  const profile = await getUserProfile()
  if (!profile) redirect("/login")

  const supabase = await createClient()
  const allowed = await hasAccountAdminAccess(supabase, profile.account_id)
  if (!allowed) redirect("/settings")

  const [{ data: partners }, { data: connections }] = await Promise.all([
    supabase
      .from("fulfillment_partners")
      .select("id, slug, name, adapter_key, config")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("account_partner_connections")
      .select(
        "id, partner_id, external_shop_id, external_account_label, is_active, last_synced_at",
      )
      .eq("account_id", profile.account_id),
  ])

  const byPartnerId = new Map<string, ConnectionRow>()
  for (const c of (connections ?? []) as ConnectionRow[]) {
    byPartnerId.set(c.partner_id, c)
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="font-cal text-3xl font-bold">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a fulfillment partner. Products you create in the
          partner&apos;s tool will be available to publish to your storefront.
          Each sale stays on your Stripe account; we push the order back to
          the partner for fulfillment.
        </p>
      </div>

      <div className="rounded-md border bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">How pricing works</p>
        <p className="mt-1 text-xs">
          You set the retail price in the partner&apos;s dashboard.
          Athletes.app charges your shoppers that price, takes a{" "}
          <strong>7% + $1</strong> platform fee, plus Stripe&apos;s standard
          ~2.9% + $0.30 processing. Your partner separately bills you for
          production costs. Price in the partner&apos;s dashboard accordingly.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {(partners ?? []).map((p) => {
          const partner = p as PartnerRow
          const connection = byPartnerId.get(partner.id) ?? null
          return (
            <div
              key={partner.id}
              className="rounded-md border bg-card p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">{partner.name}</h2>
                    {connection ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-emerald-100 text-emerald-900"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not connected</Badge>
                    )}
                  </div>
                  {partner.config?.description && (
                    <p className="text-xs text-muted-foreground">
                      {partner.config.description}
                    </p>
                  )}
                  {connection?.external_account_label && (
                    <p className="text-xs text-muted-foreground">
                      Shop:{" "}
                      <span className="font-medium text-foreground">
                        {connection.external_account_label}
                      </span>
                      {connection.external_shop_id && (
                        <span className="ml-1 text-muted-foreground">
                          (id {connection.external_shop_id})
                        </span>
                      )}
                    </p>
                  )}
                  {partner.config?.docs_url && (
                    <a
                      href={partner.config.docs_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      API docs
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {connection ? (
                    <DisconnectButton
                      connectionId={connection.id}
                      partnerName={partner.name}
                    />
                  ) : (
                    <ConnectButton
                      accountId={profile.account_id}
                      partnerId={partner.id}
                      partnerName={partner.name}
                      adapterKey={partner.adapter_key}
                      tokenSetupUrl={partner.config?.token_setup_url}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {(!partners || partners.length === 0) && (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
            <Plug className="mb-3 h-8 w-8 text-muted-foreground/50" />
            No integrations available.
          </div>
        )}
      </div>
    </div>
  )
}

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile, hasAccountAdminAccess } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Plug } from "lucide-react"
import { PartnerBadge } from "@/components/store/partner-badge"
import { listIntegrations } from "@/lib/integrations"
import type { Integration, IntegrationCategory } from "@/lib/integrations"
import { ConnectButton } from "./connect-button"
import { DisconnectButton } from "./disconnect-button"
import { EnableToggle } from "./enable-toggle"

export const dynamic = "force-dynamic"

interface AccountIntegrationRow {
  integration_slug: string
  is_enabled: boolean
  credentials_encrypted: unknown | null
  connection_state: Record<string, unknown> | null
}

const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  events: "Events",
  products: "Products",
}

const CATEGORY_DESCRIPTION: Record<IntegrationCategory, string> = {
  events: "Turn on the kinds of events your account can create. Disabled integrations are hidden from the new-event picker and from event edit pages.",
  products: "Connect external product sources. You set the retail price in the partner's dashboard; we charge your shoppers that price, take a 7% + $1 platform fee plus Stripe's ~2.9% + $0.30 processing, and dispatch each order to the partner for fulfillment.",
}

export default async function IntegrationsSettingsPage() {
  const profile = await getUserProfile()
  if (!profile) redirect("/login")

  const supabase = await createClient()
  const allowed = await hasAccountAdminAccess(supabase, profile.account_id)
  if (!allowed) redirect("/settings")

  const { data: rows } = await supabase
    .from("account_integrations")
    .select("integration_slug, is_enabled, credentials_encrypted, connection_state")
    .eq("account_id", profile.account_id)

  const stateBySlug = new Map<string, AccountIntegrationRow>()
  for (const r of (rows ?? []) as AccountIntegrationRow[]) {
    stateBySlug.set(r.integration_slug, r)
  }

  const allIntegrations = listIntegrations()
  const byCategory = new Map<IntegrationCategory, Integration[]>()
  for (const i of allIntegrations) {
    if (!byCategory.has(i.category)) byCategory.set(i.category, [])
    byCategory.get(i.category)!.push(i)
  }

  const categories = Array.from(byCategory.keys())

  return (
    <div className="flex flex-col gap-8 py-8">
      <div>
        <h1 className="font-cal text-3xl font-bold">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable the integrations you want available in this account. Each
          integration shows up in a different part of the app based on what it
          does.
        </p>
      </div>

      {categories.map((category) => {
        const items = byCategory.get(category) ?? []
        return (
          <section key={category} className="flex flex-col gap-3">
            <div>
              <h2 className="text-xl font-semibold">{CATEGORY_LABEL[category]}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {CATEGORY_DESCRIPTION[category]}
              </p>
            </div>

            {items.map((integration) => {
              const state = stateBySlug.get(integration.slug) ?? null
              const isEnabled = state?.is_enabled ?? false
              const isConnected =
                !!state && !!state.credentials_encrypted && state.is_enabled

              return (
                <div
                  key={integration.slug}
                  className="rounded-md border bg-card p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <PartnerBadge
                          slug={integration.slug}
                          variant="logo-only"
                          size={20}
                        />
                        <h3 className="text-base font-semibold">
                          {integration.name}
                        </h3>
                        {integration.requiresCredentials ? (
                          isConnected ? (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-emerald-100 text-emerald-900"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not connected</Badge>
                          )
                        ) : isEnabled ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-emerald-100 text-emerald-900"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="outline">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {integration.description}
                      </p>
                      {isConnected &&
                        typeof state?.connection_state?.external_account_label ===
                          "string" && (
                          <p className="text-xs text-muted-foreground">
                            Shop:{" "}
                            <span className="font-medium text-foreground">
                              {
                                state.connection_state
                                  .external_account_label as string
                              }
                            </span>
                          </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {integration.requiresCredentials ? (
                        isConnected ? (
                          <DisconnectButton
                            accountId={profile.account_id}
                            slug={integration.slug}
                            name={integration.name}
                          />
                        ) : (
                          <ConnectButton
                            accountId={profile.account_id}
                            slug={integration.slug}
                            name={integration.name}
                          />
                        )
                      ) : (
                        <EnableToggle
                          accountId={profile.account_id}
                          slug={integration.slug}
                          name={integration.name}
                          initialEnabled={isEnabled}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}

      {allIntegrations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          <Plug className="mb-3 h-8 w-8 text-muted-foreground/50" />
          No integrations available.
        </div>
      )}
    </div>
  )
}

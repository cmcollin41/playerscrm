import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, ShoppingBag } from "lucide-react"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function priceRangeLabel(prices: number[]): string {
  if (prices.length === 0) return "—"
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatPrice(min)
  return `${formatPrice(min)} – ${formatPrice(max)}`
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "active") return "default"
  if (status === "draft") return "outline"
  return "secondary"
}

export default async function OrgProductsListPage() {
  const profile = await getUserProfile()
  if (!profile) return null

  const supabase = await createClient()
  const { data: products } = await supabase
    .from("org_products")
    .select(
      "id, slug, name, status, updated_at, product_templates(name, category, fulfillment_partners(name)), org_product_variants(price_cents, is_active)"
    )
    .eq("account_id", profile.account_id)
    .order("updated_at", { ascending: false })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {products?.length ?? 0} product
          {(products?.length ?? 0) === 1 ? "" : "s"}
        </p>
        <Button asChild>
          <Link href="/store/manage/products/new">
            <Plus className="mr-1 h-4 w-4" />
            Add from catalog
          </Link>
        </Button>
      </div>

      {(!products || products.length === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
          <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No products yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start by picking a template from the platform catalog.
          </p>
          <Button asChild className="mt-4">
            <Link href="/store/manage/products/new">
              <Plus className="mr-1 h-4 w-4" />
              Browse catalog
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: any) => {
                const activePrices = (p.org_product_variants ?? [])
                  .filter((v: any) => v.is_active)
                  .map((v: any) => v.price_cents)
                const variantCount = (p.org_product_variants ?? []).length
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.slug}</div>
                    </TableCell>
                    <TableCell>
                      {p.product_templates?.name ?? "—"}
                      {p.product_templates?.category && (
                        <span className="ml-1 text-xs text-muted-foreground capitalize">
                          ({p.product_templates.category})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.product_templates?.fulfillment_partners?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {priceRangeLabel(activePrices)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {activePrices.length}/{variantCount} active
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant(p.status)}
                        className="capitalize"
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/store/manage/products/${p.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

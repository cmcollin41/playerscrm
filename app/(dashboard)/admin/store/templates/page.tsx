import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
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
import { Plus } from "lucide-react"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function AdminTemplatesListPage() {
  const supabase = await createClient()

  const { data: templates } = await supabase
    .from("product_templates")
    .select(
      "id, slug, name, category, base_cost_cents, shipping_flat_cents, is_active, fulfillment_partners(slug, name)"
    )
    .order("created_at", { ascending: false })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates?.length ?? 0} template
          {(templates?.length ?? 0) === 1 ? "" : "s"}
        </p>
        <Button asChild>
          <Link href="/admin/store/templates/new">
            <Plus className="mr-1 h-4 w-4" />
            New template
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Base cost</TableHead>
              <TableHead className="text-right">Shipping</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(templates ?? []).map((t: any) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.slug}</div>
                </TableCell>
                <TableCell>{t.fulfillment_partners?.name ?? "—"}</TableCell>
                <TableCell className="capitalize">{t.category}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPrice(t.base_cost_cents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPrice(t.shipping_flat_cents)}
                </TableCell>
                <TableCell>
                  <Badge variant={t.is_active ? "default" : "secondary"}>
                    {t.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/store/templates/${t.id}`}>Edit</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!templates || templates.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No templates yet. Create your first one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

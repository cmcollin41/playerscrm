import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function AdminPartnersPage() {
  const supabase = await createClient()
  const { data: partners } = await supabase
    .from("fulfillment_partners")
    .select("id, slug, name, adapter_key, contact_email, is_active, created_at")
    .order("name")

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Fulfillment partners are seeded by the platform. Add a new partner by
        applying a migration that inserts a row and ships an adapter under{" "}
        <code className="text-xs">lib/fulfillment/</code>.
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Adapter key</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(partners ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <code className="text-xs">{p.slug}</code>
                </TableCell>
                <TableCell>
                  <code className="text-xs">{p.adapter_key}</code>
                </TableCell>
                <TableCell>{p.contact_email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={p.is_active ? "default" : "secondary"}>
                    {p.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {(!partners || partners.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No partners yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  TrashIcon,
  ArrowRightIcon,
  CheckCircledIcon,
  CrossCircledIcon,
} from "@radix-ui/react-icons"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DataTable } from "@/components/ui/data-table"
import { DollarSign, Users } from "lucide-react"

type EventType = "camp" | "practice" | "game" | "other"

export type EventRow = {
  id: string
  name: string
  slug: string
  event_type: EventType | null
  starts_at: string | null
  location: string | null
  capacity: number | null
  fee_amount: number
  is_published: boolean
  is_registerable: boolean
  image_url?: string | null
  opponent_name?: string | null
  is_home?: boolean | null
  created_at?: string
  event_registrations: { id: string; status: string }[]
  teams: { id: string; name: string | null; slug: string | null } | null
}

const TYPE_LABELS: Record<EventType, string> = {
  camp: "Camp",
  practice: "Practice",
  game: "Game",
  other: "Other",
}

const TYPE_STYLES: Record<EventType, string> = {
  camp: "bg-blue-50 text-blue-700 border-blue-200",
  practice: "bg-emerald-50 text-emerald-700 border-emerald-200",
  game: "bg-orange-50 text-orange-700 border-orange-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
}

const columns: ColumnDef<EventRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          {row.original.image_url && (
            <AvatarImage src={row.original.image_url} alt={row.getValue("name") as string} />
          )}
          <AvatarFallback className="text-xs font-medium">
            {(row.getValue("name") as string)?.substring(0, 2).toUpperCase() || "E"}
          </AvatarFallback>
        </Avatar>
        <div className="font-medium">{row.getValue("name")}</div>
      </div>
    ),
  },
  {
    id: "event_type",
    accessorFn: (row) => row.event_type ?? "camp",
    header: "Type",
    cell: ({ row }) => {
      const type = (row.original.event_type ?? "camp") as EventType
      return (
        <Badge variant="outline" className={`capitalize ${TYPE_STYLES[type]}`}>
          {TYPE_LABELS[type]}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      if (!value || value === "all") return true
      return row.getValue(id) === value
    },
  },
  {
    id: "starts_at",
    accessorFn: (row) => row.starts_at,
    header: "Date",
    cell: ({ row }) => {
      const v = row.original.starts_at
      if (!v) return <div className="text-gray-400">—</div>
      return (
        <div className="font-mono text-sm">
          {new Date(v).toLocaleDateString([], { dateStyle: "medium" })}
        </div>
      )
    },
    sortingFn: (a, b) => {
      const av = a.original.starts_at ? new Date(a.original.starts_at).getTime() : -Infinity
      const bv = b.original.starts_at ? new Date(b.original.starts_at).getTime() : -Infinity
      return av - bv
    },
  },
  {
    accessorKey: "is_published",
    header: "Status",
    cell: ({ row }) => {
      const published = row.getValue("is_published")
      return (
        <Badge
          variant={published ? "default" : "secondary"}
          className="flex w-fit items-center gap-1"
        >
          {published ? (
            <>
              <CheckCircledIcon className="h-3 w-3" />
              Published
            </>
          ) : (
            <>
              <CrossCircledIcon className="h-3 w-3" />
              Draft
            </>
          )}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      if (value === "all") return true
      if (value === "published") return row.getValue(id) === true
      if (value === "draft") return row.getValue(id) === false
      return true
    },
  },
  {
    id: "registered",
    header: "Registered",
    accessorFn: (row) =>
      row.event_registrations.filter((r) => r.status === "confirmed").length,
    cell: ({ row }) => {
      const regs = row.original.event_registrations
      const confirmed = regs.filter((r) => r.status === "confirmed").length
      const pending = regs.filter((r) => r.status === "pending").length
      const capacity = row.original.capacity
      return (
        <div className="flex items-center gap-1 text-sm">
          <Users className="h-3.5 w-3.5 text-gray-400" />
          <span>{confirmed}</span>
          {capacity ? <span className="text-gray-400">/{capacity}</span> : null}
          {pending > 0 && (
            <span className="text-xs text-gray-400">({pending} pending)</span>
          )}
        </div>
      )
    },
  },
  {
    id: "fee",
    header: "Fee",
    accessorFn: (row) => row.fee_amount,
    cell: ({ row }) => {
      const cents = row.original.fee_amount
      if (!cents || cents <= 0) return <div className="text-xs text-gray-400">Free</div>
      return (
        <div className="flex items-center gap-1 font-mono text-sm">
          <DollarSign className="h-3 w-3 text-gray-400" />
          {(cents / 100).toFixed(2)}
        </div>
      )
    },
  },
  {
    accessorKey: "actions",
    header: "",
    cell: ({ row }) => (
      <Link
        href={`/events/${row.original.id}`}
        className="cursor rounded p-1 hover:bg-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowRightIcon className="h-5 w-5 text-gray-700" />
      </Link>
    ),
  },
]

export function EventTable({ data }: { data: EventRow[] }) {
  const router = useRouter()
  const { refresh } = useRouter()
  const supabase = createClient()

  return (
    <DataTable
      columns={columns}
      data={data}
      enableRowSelection
      onRowClick={(event) => router.push(`/events/${event.id}`)}
      emptyState={<p className="text-sm text-muted-foreground">No results.</p>}
      toolbar={(table) => (
        <>
          <Input
            placeholder="Search by name..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
          <Select
            value={(table.getColumn("event_type")?.getFilterValue() as string) ?? "all"}
            onValueChange={(value) =>
              table
                .getColumn("event_type")
                ?.setFilterValue(value === "all" ? undefined : value)
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="camp">Camps</SelectItem>
              <SelectItem value="practice">Practices</SelectItem>
              <SelectItem value="game">Games</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center justify-between">
                Filter:{" "}
                {(table.getColumn("is_published")?.getFilterValue() as string) || "All"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuCheckboxItem
                checked={!table.getColumn("is_published")?.getFilterValue()}
                onCheckedChange={() =>
                  table.getColumn("is_published")?.setFilterValue(undefined)
                }
              >
                All Events
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={table.getColumn("is_published")?.getFilterValue() === "published"}
                onCheckedChange={() =>
                  table.getColumn("is_published")?.setFilterValue("published")
                }
              >
                Published Only
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={table.getColumn("is_published")?.getFilterValue() === "draft"}
                onCheckedChange={() =>
                  table.getColumn("is_published")?.setFilterValue("draft")
                }
              >
                Drafts Only
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      bulkActions={(selectedRows, clearSelection) => {
        const handleDeleteSelected = async () => {
          await Promise.all(
            selectedRows.map((row) =>
              supabase.from("events").delete().eq("id", row.original.id),
            ),
          )
          clearSelection()
          refresh()
          toast.success("Selected events deleted")
        }

        const handlePublishSelected = async (publish: boolean) => {
          await Promise.all(
            selectedRows.map((row) =>
              supabase
                .from("events")
                .update({ is_published: publish })
                .eq("id", row.original.id),
            ),
          )
          clearSelection()
          refresh()
          toast.success(`Selected events ${publish ? "published" : "unpublished"}`)
        }

        return (
          <>
            <Button
              onClick={() => handlePublishSelected(true)}
              variant="outline"
              className="text-green-600"
            >
              <CheckCircledIcon className="mr-2 h-4 w-4" /> Publish
            </Button>
            <Button
              onClick={() => handlePublishSelected(false)}
              variant="outline"
              className="text-orange-600"
            >
              <CrossCircledIcon className="mr-2 h-4 w-4" /> Unpublish
            </Button>
            <Button
              onClick={handleDeleteSelected}
              variant="outline"
              className="text-red-500"
            >
              <TrashIcon className="mr-2 h-4 w-4" /> Delete
            </Button>
          </>
        )
      }}
    />
  )
}

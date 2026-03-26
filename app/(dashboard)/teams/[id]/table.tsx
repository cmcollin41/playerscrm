"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  TrashIcon,
  MixerHorizontalIcon
} from "@radix-ui/react-icons";
import EditRosterFeeModal from "@/components/modal/edit-roster-fee-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { useRouter } from "next/navigation";
import { CheckCircle, FileText, AlertCircle, Receipt } from "lucide-react";
import SendEmailSheet from "@/components/modal/send-email-sheet";
import { RosterBillingModal } from "@/components/modal/roster-billing-modal";
import { RosterInvoicesDialog } from "@/components/modal/roster-invoices-dialog";
import {
  invoicesForRoster,
  rosterIsPaid,
  rosterPartiallyPaidViaInvoices,
  rosterTemplateDollars,
  rosterTotalInvoicedDollars,
  unpaidSentInvoicesForRoster,
} from "@/lib/roster-pricing";

function paymentStatus(
  _person: Person,
  roster: any,
): "paid" | "partial" | "sent" | "draft" | "unpaid" | "none" {
  const invs = roster ? invoicesForRoster(roster) : [];
  if (invs.length === 0) return "none";

  if (rosterIsPaid(roster)) return "paid";
  if (rosterPartiallyPaidViaInvoices(roster)) return "partial";

  const unpaidSent = unpaidSentInvoicesForRoster(roster);
  if (unpaidSent.length > 0) return "sent";

  const draftInv = invs.find((i: { status?: string }) => i.status === "draft");
  if (draftInv) return "draft";

  return "unpaid";
}

export type Person = {
  id: string;
  fees: {
    id: string;
    amount: number;
    payments: Array<{
      id: string;
      person_id: string;
      status: string;
      date: string;
      invoice_id?: string;
      payment_intent_id?: string;
    }>;
  };
  invoices?: Array<{
    id: string;
    status: string;
    amount?: number | null;
    roster_id: string | null;
    due_date?: string;
    invoice_number?: string;
    metadata?: any;
  }>;
  email?: string | null;
  first_name: string;
  last_name: string;
  name: string;
  primary_contacts: any;
  jersey_number?: number;
  position?: string;
  photo?: string;
  roster_grade?: string;
  height?: string;
};

const createColumns = (
  team: any,
  onEditRoster: (
    roster: {
      id: string;
      jerseyNumber: number | null;
      position: string | null;
      grade: string | null;
      bio: string | null;
      height: string | null;
      photo: string | null;
    },
    personName: string,
  ) => void,
  onViewInvoices: (person: Person, roster: any) => void,
  onOpenBilling: (person: Person, roster: any) => void,
): ColumnDef<Person>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const roster = team.rosters?.find((r: any) => r.person_id === row.original.id)
      const photoUrl = roster?.photo || row.original.photo
      return (
        <Link href={`/people/${row.original.id}`} className="flex items-center gap-3 group">
          <Avatar className="h-8 w-8">
            {photoUrl && <AvatarImage src={photoUrl} alt={row.getValue("name") as string} />}
            <AvatarFallback className="text-xs">
              {getInitials(row.original.first_name, row.original.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="font-medium group-hover:underline">{row.getValue("name")}</div>
        </Link>
      )
    },
  },
  {
    accessorKey: "jersey_number",
    header: "#",
    cell: ({ row }) => {
      const num = row.getValue("jersey_number") as number | undefined
      return <div className="font-mono text-sm">{num != null ? `#${num}` : "—"}</div>
    },
    sortingFn: (a, b) => {
      const aVal = a.getValue("jersey_number") as number | null | undefined
      const bVal = b.getValue("jersey_number") as number | null | undefined
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      return aVal - bVal
    },
  },
  {
    accessorKey: "fees",
    header: "Fee",
    cell: ({ row }: { row: any }) => {
      const roster = team.rosters?.find(
        (r: any) => r.person_id === row.original.id,
      );
      const template = rosterTemplateDollars(roster);
      const totalInvoiced = rosterTotalInvoicedDollars(roster);

      if (template != null && template > 0) {
        return (
          <span className="font-medium font-mono text-sm">
            ${template.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        );
      }

      if (totalInvoiced > 0) {
        return (
          <span className="font-medium font-mono text-sm text-muted-foreground" title="No fee assigned — showing total invoiced">
            ${totalInvoiced.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        );
      }

      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600 whitespace-nowrap">
          No Fee
        </Badge>
      );
    },
  },
  {
    id: "invoice_status",
    header: "Status",
    cell: ({ row }: { row: any }) => {
      const person = row.original;
      const roster = team.rosters?.find((r: any) => r.person_id === person.id);
      const status = paymentStatus(person, roster);
      const unpaidSent = roster ? unpaidSentInvoicesForRoster(roster) : [];
      const hasOverdue = unpaidSent.some(
        (inv: any) => inv.due_date && new Date(inv.due_date) < new Date(),
      );

      if (status === "none") return <span className="text-xs text-gray-400">—</span>;

      if (status === "paid")
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="mr-1 h-3 w-3" /> Paid
          </Badge>
        );

      if (status === "partial")
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
            Partial
          </Badge>
        );

      if (status === "sent")
        return hasOverdue ? (
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
            <AlertCircle className="mr-1 h-3 w-3" /> Overdue
          </Badge>
        ) : (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Sent
          </Badge>
        );

      if (status === "draft")
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">
            <FileText className="mr-1 h-3 w-3" /> Draft
          </Badge>
        );

      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-500 whitespace-nowrap">
          No Invoice
        </Badge>
      );
    },
  },
  {
    id: "invoiced",
    header: "Invoices",
    cell: ({ row }: { row: any }) => {
      const person = row.original;
      const roster = team.rosters?.find((r: any) => r.person_id === person.id);
      const rosterInvs = roster ? invoicesForRoster(roster) : [];

      if (rosterInvs.length === 0) return <span className="text-xs text-gray-400">—</span>;

      return (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onViewInvoices(person, roster)}
        >
          <FileText className="mr-1 h-3 w-3" />
          Invoices ({rosterInvs.length})
        </Button>
      );
    },
  },
  {
    accessorKey: "primary_contacts",
    header: "Email",
    cell: ({ row }) => {
      const person = row.original;
      const directEmail = typeof person.email === "string" && person.email.trim() ? person.email.trim() : null;
      const contact = person.primary_contacts?.[0];
      const contactEmail = contact?.email?.trim() || null;

      if (directEmail) {
        return (
          <Link href={`/people/${person.id}`}>
            <Badge variant="outline" className="font-mono text-xs font-normal lowercase hover:bg-muted transition-colors">
              {directEmail}
            </Badge>
          </Link>
        );
      }

      if (contactEmail && contact?.id) {
        return (
          <Link href={`/people/${contact.id}`}>
            <Badge variant="outline" className="font-mono text-xs font-normal lowercase hover:bg-muted transition-colors">
              {contactEmail}
            </Badge>
          </Link>
        );
      }

      return <span className="text-xs text-muted-foreground">—</span>;
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const person = row.original;
      const roster = team.rosters?.find((r: any) => r.person_id === person.id);

      return (
        <div className="flex items-center justify-end gap-1">
          {roster?.id ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 shrink-0 p-0 text-green-700 border-green-200 bg-green-50/50 hover:bg-green-50"
              title="Fees & invoices"
              onClick={() => onOpenBilling(person, roster)}
            >
              <Receipt className="h-4 w-4" />
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onEditRoster(
                {
                  id: roster?.id,
                  jerseyNumber: roster?.jersey_number ?? null,
                  position: roster?.position ?? null,
                  grade: roster?.grade ?? null,
                  bio: roster?.bio ?? null,
                  height: roster?.height ?? null,
                  photo: roster?.photo ?? null,
                },
                person.name,
              )
            }
            className="h-8 px-3 text-xs"
            title="Edit roster (jersey, photo, awards…)"
          >
            Edit
          </Button>
        </div>
      );
    }
  }
];

interface TeamTableProps {
  data: Person[];
  team: any;
  account: any;
  onRefresh?: () => void | Promise<void>;
}

export function TeamTable({
  data,
  team,
  account,
  onRefresh,
}: TeamTableProps) {
  const router = useRouter();
  const { refresh } = router;
  const supabase = createClient();

  const [sorting, setSorting] = useState<SortingState>([
    { id: "jersey_number", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRosterId, setEditingRosterId] = useState<string>("");
  const [editingJerseyNumber, setEditingJerseyNumber] = useState<number | null>(null);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState<string | null>(null);
  const [editingHeight, setEditingHeight] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<string | null>(null);
  const [editingPersonName, setEditingPersonName] = useState<string>("");
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingPerson, setBillingPerson] = useState<Person | null>(null);
  const [billingRoster, setBillingRoster] = useState<any>(null);

  const [invoicesDialogOpen, setInvoicesDialogOpen] = useState(false);
  const [invoicesDialogPerson, setInvoicesDialogPerson] = useState<Person | null>(null);
  const [invoicesDialogRoster, setInvoicesDialogRoster] = useState<any>(null);

  const handleOpenBilling = (person: Person, roster: any) => {
    setBillingPerson(person);
    setBillingRoster(roster);
    setBillingOpen(true);
  };

  const handleViewInvoices = (person: Person, roster: any) => {
    setInvoicesDialogPerson(person);
    setInvoicesDialogRoster(roster);
    setInvoicesDialogOpen(true);
  };

  const handleEditRoster = (
    roster: {
      id: string;
      jerseyNumber: number | null;
      position: string | null;
      grade: string | null;
      bio: string | null;
      height: string | null;
      photo: string | null;
    },
    personName: string,
  ) => {
    setEditingRosterId(roster.id);
    setEditingJerseyNumber(roster.jerseyNumber);
    setEditingPosition(roster.position);
    setEditingGrade(roster.grade);
    setEditingBio(roster.bio);
    setEditingHeight(roster.height);
    setEditingPhoto(roster.photo);
    setEditingPersonName(personName);
    setEditModalOpen(true);
  };

  const table = useReactTable({
    data,
    columns: createColumns(
      team,
      handleEditRoster,
      handleViewInvoices,
      handleOpenBilling,
    ),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  useEffect(() => {
    // Set the initial page size
    table.setPageSize(30);
  }, [table]);

  const handleRemoveSelected = async () => {
    const people = selectedRows.map((row) => row.original);

    people.forEach(async (person: any) => {
      const { error } = await supabase
        .from("rosters")
        .delete()
        .eq("team_id", team.id)
        .eq("person_id", person.id);

      if (error) {
        console.log("ERROR REMOVING PERSON", error);
      }
    });

    if (onRefresh) {
      onRefresh();
    } else {
      refresh();
    }
    table.toggleAllPageRowsSelected(false);
    toast.success("Selected players have been removed successfully.");
  };

  // Check if any row is selected
  const isAnyRowSelected = table?.getSelectedRowModel()?.rows?.length > 0;

  const selectedRows = table.getSelectedRowModel().rows;

  const people = selectedRows.map((row) => row.original);

  return (
    <>
      <EditRosterFeeModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        rosterId={editingRosterId}
        currentJerseyNumber={editingJerseyNumber}
        currentPosition={editingPosition}
        currentGrade={editingGrade}
        currentBio={editingBio}
        currentHeight={editingHeight}
        currentPhoto={editingPhoto}
        accountId={account?.id ?? ""}
        personName={editingPersonName}
        onRefresh={onRefresh}
      />
      {invoicesDialogPerson && invoicesDialogRoster ? (
        <RosterInvoicesDialog
          open={invoicesDialogOpen}
          onOpenChange={(open) => {
            setInvoicesDialogOpen(open);
            if (!open) {
              setInvoicesDialogPerson(null);
              setInvoicesDialogRoster(null);
            }
          }}
          personName={`${invoicesDialogPerson.first_name} ${invoicesDialogPerson.last_name}`}
          teamName={team?.name ?? "Team"}
          invoices={invoicesForRoster(invoicesDialogRoster)}
          onRefresh={onRefresh}
        />
      ) : null}
      {billingPerson && billingRoster ? (
        <RosterBillingModal
          open={billingOpen}
          onOpenChange={(open) => {
            setBillingOpen(open);
            if (!open) {
              setBillingPerson(null);
              setBillingRoster(null);
            }
          }}
          rosterId={billingRoster.id}
          teamName={team?.name ?? "Team"}
          person={billingPerson}
          roster={billingRoster}
          team={team}
          account={account}
          currentFeeId={billingRoster.fee_id ?? billingRoster.fees?.id ?? null}
          accountId={team.account_id}
          onRefresh={onRefresh}
        />
      ) : null}
      <div className="w-full space-y-4">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search by name..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="ml-auto flex items-center justify-between"
              >
                <MixerHorizontalIcon className="mr-2 h-4 w-4" /> View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id + Math.random()}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isAnyRowSelected && (
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <SendEmailSheet
                people={people}
                account={account}
                cta="Send Email"
                onClose={() => table.toggleAllRowsSelected(false)}
                context={{
                  type: 'team',
                  name: team?.name
                }}
              />  
            </div>
            <Button
              onClick={handleRemoveSelected}
              variant="outline"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <TrashIcon className="mr-2 h-4 w-4" /> Remove Selected
            </Button>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id + Math.random()}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id + Math.random()}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id + Math.random()}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id + Math.random()}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                      <span className="text-sm text-muted-foreground">Loading roster...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

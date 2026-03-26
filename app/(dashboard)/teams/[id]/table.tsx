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
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import SendEmailSheet from "@/components/modal/send-email-sheet";
import { RosterBillingModal } from "@/components/modal/roster-billing-modal";
import { RosterInvoicesDialog } from "@/components/modal/roster-invoices-dialog";
import {
  amountsDifferCents,
  effectiveRosterOwedDollars,
  invoicesForRoster,
  rosterIsPaid,
  rosterPartiallyPaidViaInvoices,
  rosterTotalPaidCollectedDollars,
  unpaidSentInvoicesForRoster,
} from "@/lib/roster-pricing";

function paymentStatus(
  _person: Person,
  roster: any,
): "paid" | "partial" | "sent" | "draft" | "unpaid" | "none" {
  const owed = effectiveRosterOwedDollars(roster);

  if (rosterIsPaid(roster)) return "paid";

  const invs = roster ? invoicesForRoster(roster) : [];
  if (rosterPartiallyPaidViaInvoices(roster)) return "partial";

  const unpaidSent = roster ? unpaidSentInvoicesForRoster(roster) : [];
  if (unpaidSent.length > 0) return "sent";

  const draftInv = invs.find((i: { status?: string }) => i.status === "draft");
  if (draftInv) return "draft";

  if (owed == null || owed <= 0) return "none";

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
    header: "Fee Amount",
    cell: ({ row }: { row: any }) => {
      const roster = team.rosters?.find(
        (r: any) => r.person_id === row.original.id,
      );
      const owed = effectiveRosterOwedDollars(roster);
      const fees = roster?.fees;
      const isCustom =
        roster?.custom_amount != null && Number(roster.custom_amount) > 0;

      if (owed == null || owed <= 0) {
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-600 whitespace-nowrap">
            No Fee
          </Badge>
        );
      }

      return (
        <span className="font-medium font-mono text-sm inline-flex flex-wrap items-center gap-1.5">
          $
          {owed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          {isCustom ? (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 font-sans">
              Custom
            </Badge>
          ) : null}
          {isCustom &&
          fees?.amount != null &&
          amountsDifferCents(Number(fees.amount), owed) ? (
            <span
              className="text-[10px] text-muted-foreground font-sans font-normal"
              title={`Catalog fee: $${Number(fees.amount).toFixed(2)}`}
            >
              (catalog ${Number(fees.amount).toFixed(0)})
            </span>
          ) : null}
        </span>
      );
    },
  },
  {
    id: "invoice_status",
    header: "Invoice Status",
    cell: ({ row }: { row: any }) => {
      const person = row.original;
      const roster = team.rosters?.find((r: any) => r.person_id === person.id);
      const rosterInvs = roster ? invoicesForRoster(roster) : [];
      const unpaidSent = roster ? unpaidSentInvoicesForRoster(roster) : [];
      const status = paymentStatus(person, roster);
      const rosterOwed = effectiveRosterOwedDollars(roster);
      const paidSum = roster ? rosterTotalPaidCollectedDollars(roster) : 0;
      const hasOverdue = unpaidSent.some(
        (inv: any) => inv.due_date && new Date(inv.due_date) < new Date(),
      );

      if (status === "none") {
        return <span className="text-xs text-gray-400">—</span>;
      }

      if (status === "paid") {
        return (
          <button
            type="button"
            className="cursor-pointer"
            onClick={() => onViewInvoices(person, roster)}
          >
            <Badge className="bg-green-100 text-green-800 hover:bg-green-200 transition-colors">
              <CheckCircle className="mr-1 h-3 w-3" />
              Paid
              {rosterInvs.length > 1 ? ` (${rosterInvs.length})` : ""}
            </Badge>
          </button>
        );
      }

      if (status === "partial") {
        return (
          <button
            type="button"
            className="flex flex-col items-start gap-1 cursor-pointer"
            onClick={() => onViewInvoices(person, roster)}
          >
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100 transition-colors whitespace-normal text-left"
            >
              Partial
              {rosterOwed != null ? (
                <span className="ml-1 font-mono tabular-nums">
                  ${paidSum.toFixed(2)} / ${rosterOwed.toFixed(2)}
                </span>
              ) : null}
            </Badge>
            <span className="text-xs text-blue-600 hover:underline">
              {rosterInvs.length} invoice{rosterInvs.length !== 1 ? "s" : ""} — view
            </span>
          </button>
        );
      }

      if (status === "sent") {
        return (
          <button
            type="button"
            className="flex flex-col items-start gap-1 cursor-pointer"
            onClick={() => onViewInvoices(person, roster)}
          >
            <Badge
              variant="outline"
              className={`transition-colors ${
                hasOverdue
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              {hasOverdue ? (
                <AlertCircle className="mr-1 h-3 w-3" />
              ) : (
                <PaperAirplaneIcon className="mr-1 h-3 w-3" />
              )}
              {hasOverdue ? "Overdue" : "Sent"}
              {rosterInvs.length > 1 ? ` (${rosterInvs.length})` : ""}
            </Badge>
            <span className="text-xs text-blue-600 hover:underline">
              View & resend
            </span>
          </button>
        );
      }

      if (status === "draft") {
        const draftCount = rosterInvs.filter(
          (i: { status?: string }) => i.status === "draft",
        ).length;
        return (
          <button
            type="button"
            className="cursor-pointer"
            onClick={() => onViewInvoices(person, roster)}
          >
            <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
              <FileText className="mr-1 h-3 w-3" />
              Draft{draftCount > 1 ? ` (${draftCount})` : ""}
            </Badge>
          </button>
        );
      }

      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-500 whitespace-nowrap">
          No Invoice
        </Badge>
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
          owedAmount={effectiveRosterOwedDollars(invoicesDialogRoster)}
          paidTotal={rosterTotalPaidCollectedDollars(invoicesDialogRoster)}
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

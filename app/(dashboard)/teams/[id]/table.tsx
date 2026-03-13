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

import SendEmailModal from "@/components/modal/send-email-sheet";
import SendButton from "@/components/modal-buttons/send-button";
import { useRouter } from "next/navigation";
import { CheckCircle, Mail, FileText, ExternalLink, AlertCircle } from "lucide-react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { CreateRosterInvoiceButton } from "@/components/create-roster-invoice-button";
import SendEmailSheet from "@/components/modal/send-email-sheet";

function paymentStatus(person: Person, fees: any, team: any) {
  // First check for successful payments
  if (fees?.payments?.length) {
    const successfulPayment = fees.payments.find(
      (payment: { person_id: string; fee_id: string; status: string }) =>
        payment.person_id === person.id &&
        payment.fee_id === fees.id &&
        payment.status === "succeeded"
    );
    
    if (successfulPayment) {
      return "paid";
    }
  }

  // Then check for existing invoices
  const rosterId = team.rosters?.find((r: any) => r.person_id === person.id)?.id;
  const invoice = person.invoices?.find(inv => inv.roster_id === rosterId);
  
  if (invoice) {
    if (invoice.status === "sent") {
      return "sent";
    }
    if (invoice.status === "draft") {
      return "draft";
    }
  }

  return "unpaid";
}

function getInvoiceForRoster(person: Person, rosterId: string) {
  return person.invoices?.find(inv => inv.roster_id === rosterId);
}

function isInvoiceOverdue(invoice: any) {
  if (!invoice?.due_date || invoice.status !== "sent") return false;
  return new Date(invoice.due_date) < new Date();
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
    roster_id: string;
    due_date?: string;
    invoice_number?: string;
    metadata?: any;
  }>;
  first_name: string;
  last_name: string;
  name: string;
  primary_contacts: any;
  jersey_number?: number;
  position?: string;
  photo?: string;
  roster_grade?: string;
};

const createColumns = (
  team: any, 
  onEditRoster: (roster: { id: string; feeId: string | null; jerseyNumber: number | null; position: string | null; grade: string | null }, personName: string) => void,
  onResendInvoice: (invoiceId: string) => void,
  resendingInvoiceId: string | null
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
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          {row.original.photo && <AvatarImage src={row.original.photo} alt={row.getValue("name") as string} />}
          <AvatarFallback className="text-xs">
            {getInitials(row.original.first_name, row.original.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="font-medium">{row.getValue("name")}</div>
      </div>
    ),
  },
  {
    accessorKey: "jersey_number",
    header: "#",
    cell: ({ row }) => {
      const num = row.getValue("jersey_number") as number | undefined
      return <div className="font-mono">{num != null ? `#${num}` : "—"}</div>
    },
  },
  {
    accessorKey: "position",
    header: "Position",
    cell: ({ row }) => <div>{row.getValue("position") || "—"}</div>,
  },
  {
    id: "grade",
    header: "Grade",
    cell: ({ row }) => {
      const grade = row.original.roster_grade || (row.original as any).grade || ""
      const GRADE_LABELS: Record<string, string> = { "9": "Freshman", "10": "Sophomore", "11": "Junior", "12": "Senior" }
      return <div>{GRADE_LABELS[grade] || grade || "—"}</div>
    },
    accessorFn: (row) => row.roster_grade || (row as any).grade || "",
  },
  {
    accessorKey: "fees",
    header: "Fee Amount",
    cell: ({ row }: { row: any }) => {
      const fees = row.getValue("fees") as { amount: number; id: string } | undefined;
      const amount = fees?.amount;
      
      if (!amount) {
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-600">
            No Fee
          </Badge>
        );
      }
      
      return (
        <span className="font-medium">
          ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
      const invoice = getInvoiceForRoster(person, roster?.id);
      
      // If no fee is assigned, show N/A
      if (!person.fees || !person.fees.amount) {
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-600">
            No Fee
          </Badge>
        );
      }
      
      const status = paymentStatus(person, person.fees, team);
      
      if (status === "paid") {
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        );
      }
      
      if (status === "sent") {
        const overdue = isInvoiceOverdue(invoice);
        return (
          <div className="flex flex-col gap-1">
            <Badge className={`${
              overdue 
                ? "bg-red-100 text-red-800 hover:bg-red-100" 
                : "bg-blue-100 text-blue-800 hover:bg-blue-100"
            }`}>
              <Mail className="mr-1 h-3 w-3" />
              Sent
            </Badge>
            {overdue && (
              <span className="text-xs text-red-600 font-medium">Overdue</span>
            )}
          </div>
        );
      }
      
      if (status === "draft") {
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">
            <FileText className="mr-1 h-3 w-3" />
            Draft
          </Badge>
        );
      }
      
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
          <AlertCircle className="mr-1 h-3 w-3" />
          Unpaid
        </Badge>
      );
    },
  },
  {
    accessorKey: "primary_contacts",
    header: "Email",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.primary_contacts.map((contact: any, index: any) => (
          <Link
            key={index}
            href={`/people/${contact?.id}`}
            className="cursor-pointer rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs lowercase text-gray-900 hover:bg-gray-200 transition-colors"
          >
            {contact?.email}
          </Link>
        ))}
      </div>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const person = row.original;
      const roster = team.rosters?.find((r: any) => r.person_id === person.id);
      const fees = roster?.fees;
      const invoice = getInvoiceForRoster(person, roster?.id);
      const status = paymentStatus(person, person.fees, team);
      const isOverdue = isInvoiceOverdue(invoice);

      return (
        <div className="flex items-center gap-2">
          {/* Link to Person Page */}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 px-2"
            title="View Person"
          >
            <Link href={`/people/${person.id}`}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditRoster({
              id: roster?.id,
              feeId: fees?.id || null,
              jerseyNumber: roster?.jersey_number ?? null,
              position: roster?.position ?? null,
              grade: roster?.grade ?? null,
            }, person.name)}
            className="h-8 px-3 text-xs"
            title="Edit Roster Entry"
          >
            Edit
          </Button>

          {/* Invoice/Payment Status Actions */}
          {status === "paid" ? (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Paid
            </Badge>
          ) : status === "sent" ? (
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => invoice && onResendInvoice(invoice.id)}
              disabled={resendingInvoiceId === invoice?.id}
              className={`h-8 px-3 text-xs ${
                isOverdue 
                  ? "text-red-600 hover:text-red-700 hover:bg-red-50" 
                  : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              }`}
              title={isOverdue ? "Resend overdue invoice" : "Resend invoice"}
            >
              <PaperAirplaneIcon className="h-3.5 w-3.5 mr-1" />
              {resendingInvoiceId === invoice?.id ? "Sending..." : "Resend"}
            </Button>
          ) : status === "draft" ? (
            <Badge variant="outline" className="bg-gray-100 text-gray-600">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Draft
            </Badge>
          ) : fees?.amount ? (
            // Show create invoice button only if fee is assigned
            <CreateRosterInvoiceButton 
              rosterId={roster?.id}
              athleteName={`${person.first_name} ${person.last_name}`}
              teamName={team?.name}
              amount={roster?.fees?.amount}
              guardianEmail={person.primary_contacts?.[0]?.email}
              accountId={team.account_id}
              stripeAccountId={team.accounts?.stripe_id}
              person_id={person.id}
            />
          ) : null}
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
  const [resendingInvoiceId, setResendingInvoiceId] = useState<string | null>(null);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRosterId, setEditingRosterId] = useState<string>("");
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingJerseyNumber, setEditingJerseyNumber] = useState<number | null>(null);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [editingPersonName, setEditingPersonName] = useState<string>("");

  const handleEditRoster = (
    roster: { id: string; feeId: string | null; jerseyNumber: number | null; position: string | null; grade: string | null },
    personName: string
  ) => {
    setEditingRosterId(roster.id);
    setEditingFeeId(roster.feeId);
    setEditingJerseyNumber(roster.jerseyNumber);
    setEditingPosition(roster.position);
    setEditingGrade(roster.grade);
    setEditingPersonName(personName);
    setEditModalOpen(true);
  };

  const handleResendInvoice = async (invoiceId: string) => {
    setResendingInvoiceId(invoiceId);
    
    try {
      const response = await fetch("/api/invoices/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoiceId }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to resend invoice");
      }

      toast.success("Invoice email resent successfully!");
      
      // Refresh the team data to update UI
      if (onRefresh) {
        onRefresh();
      } else {
        refresh();
      }
    } catch (error: any) {
      console.error("Error resending invoice:", error);
      toast.error(error.message || "Failed to resend invoice");
    } finally {
      setResendingInvoiceId(null);
    }
  };

  const table = useReactTable({
    data,
    columns: createColumns(team, handleEditRoster, handleResendInvoice, resendingInvoiceId),
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
        currentFeeId={editingFeeId}
        currentJerseyNumber={editingJerseyNumber}
        currentPosition={editingPosition}
        currentGrade={editingGrade}
        personName={editingPersonName}
        onRefresh={onRefresh}
      />
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

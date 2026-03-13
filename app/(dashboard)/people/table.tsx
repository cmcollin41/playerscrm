"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import {
  TrashIcon,
  ListBulletIcon,
  MixerHorizontalIcon,
} from "@radix-ui/react-icons";

import {
  ShieldIcon, 
  UsersIcon,
  Mail,
  Phone as PhoneIcon,
  User
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"

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

import AddToTeamModal from "@/components/modal/add-to-team-modal";
import IconButton from "@/components/modal-buttons/icon-button";
import LoadingDots from "@/components/icons/loading-dots";
import SendEmailSheet from "@/components/modal/send-email-sheet";
import MergePeopleModal from "@/components/modal/merge-people-modal";

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  tags: any;
  email: string;
  phone: string;
  dependent: boolean;
  primary_contacts: any;
  relationships: any;
  photo?: string;
}

const columns: ColumnDef<Person>[] = [
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
          {row.original.photo && <AvatarImage src={row.original.photo} alt={row.getValue("name") as string} />}
          <AvatarFallback className="text-xs">
            {getInitials(row.original.first_name, row.original.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2">
          {!row.original.dependent ? (
            <span title="Primary Contact">
              <ShieldIcon className="h-4 w-4 text-green-600" aria-label="Primary Contact" />
            </span>
          ) : (
            <span title="Dependent">
              <User className="h-4 w-4 text-blue-600" aria-label="Dependent" />
            </span>
          )}
          {row.original.relationships && row.original.relationships.length > 0 && (
            <span title="Has Relationships">
              <UsersIcon className="h-4 w-4 text-purple-600" aria-label="Has Relationships" />
            </span>
          )}
        </div>
        <div className="font-medium">{row.getValue("name")}</div>
      </div>
    ),
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {((row.getValue("tags") as any[]) || []).length > 0 ? (
          ((row.getValue("tags") as any[]) || []).map((tag: any, index: any) => (
            <Badge
              key={index}
              variant="secondary"
              className="bg-lime-100 text-lime-800 hover:bg-lime-100"
            >
              {tag}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "primary_contacts",
    header: "Primary Contacts",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.primary_contacts?.length > 0 ? (
          row.original.primary_contacts.map((contact: any, index: any) => (
            <Link
              key={index}
              href={`/people/${contact?.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 cursor-pointer rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs lowercase text-gray-900 hover:bg-gray-200 hover:border-gray-300 transition-colors"
            >
              <Mail className="h-3 w-3" />
              {contact?.email}
            </Link>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => {
      const phone = row.getValue("phone") as string;
      return phone ? (
        <div className="flex items-center gap-2 text-sm">
          <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {phone}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      );
    },
  },
];

export function PeopleTable({
  data,
  account,
}: {
  data: Person[];
  account: any;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [tableReady, setTableReady] = useState(false);

  const table = useReactTable({
    data,
    columns,
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
    table.setPageSize(30);
  }, []);

  useEffect(() => {
    if (data.length > 0 && table.getRowModel().rows.length > 0) {
      setTableReady(true);
    }
  }, [data, table]);

  const handleDeleteSelected = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    await Promise.all(
      selectedRows.map((row) => {
        return supabase.from("people").delete().eq("id", row.original.id);
      }),
    );
  };

  const handleRowClick = (personId: string, event: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or links
    const target = event.target as HTMLElement;
    if (
      target.closest('input[type="checkbox"]') ||
      target.closest('a')
    ) {
      return;
    }
    router.push(`/people/${personId}`);
  };

  const isAnyRowSelected = table.getSelectedRowModel().rows.length > 0;
  const selectedRows = table.getSelectedRowModel().rows;
  const people = selectedRows.map((row) => row.original);

  return (
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
                    key={column.id}
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
              onClose={() => table.toggleAllPageRowsSelected(false)}
              context={{
                type: 'manual',
                name: 'Selected People'
              }}
            />
            <IconButton
              icon={<ListBulletIcon className="mr-2" />}
              cta="Add to Team"
            >
              <AddToTeamModal
                people={people}
                onClose={() => table.toggleAllPageRowsSelected(false)}
              />
            </IconButton>
            {selectedRows.length === 2 && (
              <MergePeopleModal
                person1={people[0]}
                person2={people[1]}
                account={account}
                onClose={() => table.toggleAllPageRowsSelected(false)}
              />
            )}
          </div>
          <Button
            onClick={handleDeleteSelected}
            variant="outline"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <TrashIcon className="mr-2 h-4 w-4" /> Delete Selected
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        {!tableReady ? (
          <div className="flex w-full items-center justify-center p-10">
            <LoadingDots />
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
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
              {data.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={(e) => handleRowClick(row.original.id, e)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <User className="h-12 w-12 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No people found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
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
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  TrashIcon,
  ArrowRightIcon,
  CheckCircledIcon,
  CrossCircledIcon,
} from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { ColumnDef, Row } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { getPrimaryContact } from "@/lib/fetchers/client";
import SendEmailSheet from "@/components/modal/send-email-sheet";

import { useRouter } from "next/navigation";

export type Team = {
  id: string;
  name: string;
  level: string;
  is_active: boolean;
  icon?: string;
  rosters: any;
  seasons?: {
    id: string;
    year_start: number;
    year_end: number;
    display_name: string;
    is_current?: boolean;
  } | null;
  staff: {
    people: {
      name: string;
    };
  }[];
};

const LEVEL_LABELS: Record<string, string> = {
  bantam: "Bantam",
  club: "Club",
  freshman: "Freshman",
  sophomore: "Sophomore",
  jv: "JV",
  varsity: "Varsity",
};

const columns: ColumnDef<Team>[] = [
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
          {row.original.icon && (
            <AvatarImage
              src={row.original.icon}
              alt={row.getValue("name") as string}
            />
          )}
          <AvatarFallback className="text-xs font-medium">
            {(row.getValue("name") as string)?.substring(0, 2).toUpperCase() ||
              "T"}
          </AvatarFallback>
        </Avatar>
        <div className="font-medium">{row.getValue("name")}</div>
      </div>
    ),
  },
  {
    id: "season",
    accessorFn: (row) => row.seasons?.year_start ?? null,
    header: "Season",
    cell: ({ row }) => {
      const season = row.original.seasons;
      if (!season) return <div className="text-gray-400">—</div>;
      return <div className="font-mono text-sm">{season.display_name}</div>;
    },
    sortingFn: (a, b) => {
      const ay = a.original.seasons?.year_start ?? -Infinity;
      const by = b.original.seasons?.year_start ?? -Infinity;
      return ay - by;
    },
  },
  {
    accessorKey: "level",
    header: "Level",
    cell: ({ row }) => {
      const level = row.getValue("level") as string;
      return (
        <Badge variant="outline" className="capitalize">
          {LEVEL_LABELS[level] || level}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      if (!value || value === "all") return true;
      return row.getValue(id) === value;
    },
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => {
      const isActive = row.getValue("is_active");
      return (
        <Badge
          variant={isActive ? "default" : "secondary"}
          className="flex w-fit items-center gap-1"
        >
          {isActive ? (
            <>
              <CheckCircledIcon className="h-3 w-3" />
              Active
            </>
          ) : (
            <>
              <CrossCircledIcon className="h-3 w-3" />
              Inactive
            </>
          )}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      if (value === "all") return true;
      if (value === "active") return row.getValue(id) === true;
      if (value === "inactive") return row.getValue(id) === false;
      return true;
    },
  },
  {
    accessorKey: "staff",
    header: "Staff",
    cell: ({ row }) => {
      const staff = row.original.staff;
      if (staff && staff.length > 0 && staff[0].people) {
        return <div>{staff[0].people.name}</div>;
      }
      return <div className="text-gray-400">No staff</div>;
    },
  },
  {
    accessorKey: "actions",
    header: "",
    cell: ({ row }) => (
      <Link
        href={`/teams/${row.original.id}`}
        className="cursor rounded p-1 hover:bg-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowRightIcon className="h-5 w-5 text-gray-700" />
      </Link>
    ),
  },
];

function TeamBulkActions({
  selectedRows,
  account,
  clearSelection,
}: {
  selectedRows: Row<Team>[];
  account: any;
  clearSelection: () => void;
}) {
  const { refresh } = useRouter();
  const supabase = createClient();
  const [primaryContacts, setPrimaryContacts] = useState<any[]>([]);

  useEffect(() => {
    const fetchPrimaryContacts = async () => {
      const selectedPeople = selectedRows.flatMap(
        (team) => team.original.rosters,
      );
      const people = selectedPeople.flatMap((roster) => roster.people);
      const primaryContactsPromises = people.map(async (person) => {
        const primaryContact = await getPrimaryContact(person);
        return {
          ...person,
          primary_contacts: primaryContact,
        };
      });
      const result = await Promise.all(primaryContactsPromises);
      setPrimaryContacts(result);
    };
    fetchPrimaryContacts();
  }, [selectedRows]);

  const handleDeleteSelected = async () => {
    await Promise.all(
      selectedRows.map((row) =>
        supabase.from("teams").delete().eq("id", row.original.id),
      ),
    );
    clearSelection();
    refresh();
    toast.success("Selected teams have been deleted successfully.");
  };

  const handleArchiveSelected = async () => {
    await Promise.all(
      selectedRows.map((row) =>
        supabase
          .from("teams")
          .update({ is_active: false })
          .eq("id", row.original.id),
      ),
    );
    clearSelection();
    refresh();
    toast.success("Selected teams have been archived successfully.");
  };

  const handleActivateSelected = async () => {
    await Promise.all(
      selectedRows.map((row) =>
        supabase
          .from("teams")
          .update({ is_active: true })
          .eq("id", row.original.id),
      ),
    );
    clearSelection();
    refresh();
    toast.success("Selected teams have been activated successfully.");
  };

  return (
    <>
      <SendEmailSheet
        people={primaryContacts}
        account={account}
        cta="Send Email"
        onClose={clearSelection}
        context={{
          type: "team",
          name: "Selected Teams",
        }}
      />
      <Button
        onClick={handleActivateSelected}
        variant="outline"
        className="text-green-600"
      >
        <CheckCircledIcon className="mr-2 h-4 w-4" /> Activate
      </Button>
      <Button
        onClick={handleArchiveSelected}
        variant="outline"
        className="text-orange-600"
      >
        <CrossCircledIcon className="mr-2 h-4 w-4" /> Archive
      </Button>
      <Button
        onClick={handleDeleteSelected}
        variant="outline"
        className="text-red-500"
      >
        <TrashIcon className="mr-2 h-4 w-4" /> Delete
      </Button>
    </>
  );
}

export function TeamTable({ data, account }: { data: Team[]; account: any }) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={data}
      enableRowSelection
      initialColumnFilters={[{ id: "level", value: "bantam" }]}
      onRowClick={(team) => router.push(`/teams/${team.id}`)}
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
            value={
              (table.getColumn("level")?.getFilterValue() as string) ?? "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("level")
                ?.setFilterValue(value === "all" ? undefined : value)
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center justify-between"
              >
                Filter:{" "}
                {(table.getColumn("is_active")?.getFilterValue() as string) ||
                  "All"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuCheckboxItem
                checked={!table.getColumn("is_active")?.getFilterValue()}
                onCheckedChange={() =>
                  table.getColumn("is_active")?.setFilterValue(undefined)
                }
              >
                All Teams
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={
                  table.getColumn("is_active")?.getFilterValue() === "active"
                }
                onCheckedChange={() =>
                  table.getColumn("is_active")?.setFilterValue("active")
                }
              >
                Active Only
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={
                  table.getColumn("is_active")?.getFilterValue() === "inactive"
                }
                onCheckedChange={() =>
                  table.getColumn("is_active")?.setFilterValue("inactive")
                }
              >
                Inactive Only
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      bulkActions={(selectedRows, clearSelection) => (
        <TeamBulkActions
          selectedRows={selectedRows}
          account={account}
          clearSelection={clearSelection}
        />
      )}
    />
  );
}

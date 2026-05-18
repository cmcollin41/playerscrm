"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import {
  TrashIcon,
  ListBulletIcon,
} from "@radix-ui/react-icons";

import {
  ShieldIcon,
  UsersIcon,
  Mail,
  Phone as PhoneIcon,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

import AddToTeamModal from "@/components/modal/add-to-team-modal";
import IconButton from "@/components/modal-buttons/icon-button";
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
          {row.original.photo && (
            <AvatarImage
              src={row.original.photo}
              alt={row.getValue("name") as string}
            />
          )}
          <AvatarFallback className="text-xs">
            {getInitials(row.original.first_name, row.original.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2">
          {!row.original.dependent ? (
            <span title="Primary Contact">
              <ShieldIcon
                className="h-4 w-4 text-green-600"
                aria-label="Primary Contact"
              />
            </span>
          ) : (
            <span title="Dependent">
              <User
                className="h-4 w-4 text-blue-600"
                aria-label="Dependent"
              />
            </span>
          )}
          {row.original.relationships &&
            row.original.relationships.length > 0 && (
              <span title="Has Relationships">
                <UsersIcon
                  className="h-4 w-4 text-purple-600"
                  aria-label="Has Relationships"
                />
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
          ((row.getValue("tags") as any[]) || []).map(
            (tag: any, index: any) => (
              <Badge
                key={index}
                variant="secondary"
                className="bg-lime-100 text-lime-800 hover:bg-lime-100"
              >
                {tag}
              </Badge>
            ),
          )
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

  return (
    <DataTable
      columns={columns}
      data={data}
      enableRowSelection
      onRowClick={(person) => router.push(`/people/${person.id}`)}
      emptyState={
        <div className="flex flex-col items-center justify-center gap-2">
          <User className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No people found</p>
        </div>
      }
      toolbar={(table) => (
        <Input
          placeholder="Search by name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      )}
      bulkActions={(selectedRows, clearSelection) => {
        const people = selectedRows.map((r) => r.original);
        const handleDeleteSelected = async () => {
          await Promise.all(
            selectedRows.map((row) =>
              supabase.from("people").delete().eq("id", row.original.id),
            ),
          );
          clearSelection();
        };
        return (
          <>
            <SendEmailSheet
              people={people}
              account={account}
              cta="Send Email"
              onClose={clearSelection}
              context={{
                type: "manual",
                name: "Selected People",
              }}
            />
            <IconButton
              icon={<ListBulletIcon className="mr-2" />}
              cta="Add to Team"
            >
              <AddToTeamModal people={people} onClose={clearSelection} />
            </IconButton>
            {selectedRows.length === 2 && (
              <MergePeopleModal
                person1={people[0]}
                person2={people[1]}
                account={account}
                onClose={clearSelection}
              />
            )}
            <Button
              onClick={handleDeleteSelected}
              variant="outline"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <TrashIcon className="mr-2 h-4 w-4" /> Delete Selected
            </Button>
          </>
        );
      }}
    />
  );
}

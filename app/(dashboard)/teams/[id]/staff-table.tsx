"use client";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { TrashIcon, ArrowRightIcon } from "@radix-ui/react-icons";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";

import SendEmailModal from "@/components/modal/send-email-sheet";
import SendButton from "@/components/modal-buttons/send-button";
import { useRouter } from "next/navigation";

export type Person = {
  id: string;
  fees: any;
  first_name: string;
  last_name: string;
  name: string;
  tags: any;
  email: string;
  grade: string;
  birthdate: string;
  phone: string;
  primary_contacts: any;
};

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
      />
    ),
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <div>{row.getValue("name")}</div>,
  },
  {
    accessorKey: "grade",
    header: "Grade",
    cell: ({ row }) => <div>{row.getValue("grade")}</div>,
  },
  {
    accessorKey: "birthdate",
    header: "Birthdate",
    cell: ({ row }) => <div>{row.getValue("birthdate")}</div>,
  },
  {
    accessorKey: "primary_contacts",
    header: "Email",
    cell: ({ row }) => (
      <div className="space-x-2">
        {row.original.primary_contacts.map((contact: any, index: any) => (
          <Link
            key={index}
            href={`/people/${contact?.id}`}
            className="cursor-pointer rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-sm lowercase text-gray-900"
          >
            {contact?.email}
          </Link>
        ))}
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => <div>{row.getValue("phone")}</div>,
  },
  {
    accessorKey: "actions",
    header: "",
    cell: ({ row }) => (
      <Link
        href={`/people/${row.original.id}`}
        className="cursor rounded hover:bg-gray-100"
      >
        <span className="flex items-center space-x-2 text-sm text-gray-700">
          <ArrowRightIcon className="h-5 w-5" />
        </span>
      </Link>
    ),
  },
];

export function StaffTable({
  data,
  team,
  account,
}: {
  data: Person[];
  team: any;
  account: any;
}) {
  const { refresh } = useRouter();
  const supabase = createClient();

  return (
    <DataTable
      columns={columns}
      data={data}
      enableRowSelection
      showColumnVisibility={false}
      emptyState={<p className="text-sm text-muted-foreground">No results.</p>}
      bulkActions={(selectedRows, clearSelection) => {
        const people = selectedRows.map((row) => row.original);
        const handleRemoveSelected = async () => {
          people.forEach(async (person: any) => {
            const { error } = await supabase
              .from("staff")
              .delete()
              .eq("team_id", team.id)
              .eq("person_id", person.id);

            if (error) {
              console.log("ERROR REMOVING PERSON", error);
            }
          });
          refresh();
          clearSelection();
          toast.success("Selected staff have been removed successfully.");
        };

        return (
          <>
            <SendButton channel="email" cta="Send Email">
              <SendEmailModal
                people={people}
                cta="Send Email"
                account={account}
                onClose={clearSelection}
              />
            </SendButton>
            <Button
              onClick={handleRemoveSelected}
              variant="outline"
              className="text-red-500"
            >
              <TrashIcon className="mr-2 h-4 w-4" /> Remove
            </Button>
          </>
        );
      }}
    />
  );
}

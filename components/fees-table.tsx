"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatDollars } from "@/lib/money"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MoreHorizontal, Edit, Trash2 } from "lucide-react"
import FeeModal from "@/components/modal/fee-modal"

interface Fee {
  id: string
  name: string
  amount: number
  description?: string
  is_active: boolean
  created_at: string
}

interface FeesTableProps {
  fees: Fee[]
}

export default function FeesTable({ fees }: FeesTableProps) {
  const { refresh } = useRouter()
  const supabase = createClient()
  const [editingFee, setEditingFee] = useState<Fee | null>(null)
  const [feeModalOpen, setFeeModalOpen] = useState(false)
  const [deletingFeeId, setDeletingFeeId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleEdit = (fee: Fee) => {
    setEditingFee(fee)
    setFeeModalOpen(true)
  }

  const handleToggleActive = async (feeId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("fees")
        .update({ is_active: !currentStatus })
        .eq("id", feeId)

      if (error) throw error

      toast.success(
        !currentStatus
          ? "Fee activated successfully"
          : "Fee deactivated successfully"
      )
      refresh()
    } catch (error: any) {
      console.error("Error toggling fee status:", error)
      toast.error(error.message || "Failed to update fee status")
    }
  }

  const handleDelete = async (feeId: string) => {
    setIsDeleting(true)
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("fees")
        .update({ is_active: false })
        .eq("id", feeId)

      if (error) throw error

      toast.success("Fee deactivated successfully")
      setDeletingFeeId(null)
      refresh()
    } catch (error: any) {
      console.error("Error deactivating fee:", error)
      toast.error(error.message || "Failed to deactivate fee")
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (fees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
        <p className="text-muted-foreground mb-4 text-sm">
          No fees found. Create your first fee to get started.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="w-full rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">Name</TableHead>
              <TableHead className="w-[15%]">Amount</TableHead>
              <TableHead className="w-[35%]">Description</TableHead>
              <TableHead className="w-[15%]">Active</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.map((fee) => (
              <TableRow key={fee.id} className={!fee.is_active ? "opacity-60" : ""}>
                <TableCell className="font-medium">{fee.name}</TableCell>
                <TableCell>{formatDollars(fee.amount)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {fee.description || "-"}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={fee.is_active}
                    onCheckedChange={() => handleToggleActive(fee.id, fee.is_active)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(fee)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {fee.is_active && (
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeletingFeeId(fee.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Deactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FeeModal
        open={feeModalOpen}
        onOpenChange={(open) => {
          setFeeModalOpen(open)
          if (!open) setEditingFee(null)
        }}
        fee={editingFee}
      />

      <AlertDialog
        open={!!deletingFeeId}
        onOpenChange={(open) => !open && setDeletingFeeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Fee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the fee. It will no longer be available for
              new assignments, but existing roster assignments will remain
              unchanged. You can reactivate it later using the toggle switch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingFeeId && handleDelete(deletingFeeId)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}


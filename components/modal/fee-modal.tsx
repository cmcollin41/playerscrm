"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { getAccount } from "@/lib/fetchers/client"
import { toast } from "sonner"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormClassName,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

interface Fee {
  id: string
  name: string
  amount: number
  description?: string
}

interface FeeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fee?: Fee | null
}

export default function FeeModal({
  open,
  onOpenChange,
  fee,
}: FeeModalProps) {
  const { refresh } = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    description: "",
  })

  useEffect(() => {
    if (fee) {
      setFormData({
        name: fee.name || "",
        amount: fee.amount?.toString() || "",
        description: fee.description || "",
      })
    } else {
      setFormData({
        name: "",
        amount: "",
        description: "",
      })
    }
  }, [fee, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const account = await getAccount()
      
      if (!formData.name || !formData.amount) {
        toast.error("Name and amount are required")
        setIsLoading(false)
        return
      }

      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount < 0) {
        toast.error("Please enter a valid amount")
        setIsLoading(false)
        return
      }

      const feeData = {
        name: formData.name,
        amount: amount,
        description: formData.description || null,
        account_id: account?.id,
        is_active: true,
      }

      if (fee) {
        // Update existing fee
        const { error } = await supabase
          .from("fees")
          .update(feeData)
          .eq("id", fee.id)

        if (error) throw error
        toast.success("Fee updated successfully")
      } else {
        // Create new fee
        const { error } = await supabase
          .from("fees")
          .insert([feeData])

        if (error) throw error
        toast.success("Fee created successfully")
      }

      onOpenChange(false)
      refresh()
    } catch (error: any) {
      console.error("Error saving fee:", error)
      toast.error(error.message || "Failed to save fee")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{fee ? "Edit Fee" : "Create Fee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={dialogFormClassName}>
          <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Fee Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g. Season Fee, Registration"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of the fee"
            />
          </div>

          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {fee ? "Update Fee" : "Create Fee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


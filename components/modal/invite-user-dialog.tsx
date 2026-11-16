"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormClassName,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import LoadingDots from "@/components/icons/loading-dots"
import { ACCOUNT_ROLES, ROLE_CONFIG, type AccountRole } from "@/lib/roles"

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountName?: string | null
}

export function InviteUserDialog({
  open,
  onOpenChange,
  accountName,
}: InviteUserDialogProps) {
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [role, setRole] = useState<AccountRole>("member")

  function resetForm() {
    setEmail("")
    setFirstName("")
    setLastName("")
    setRole("member")
  }

  function close() {
    resetForm()
    onOpenChange(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      toast.error("Email is required")
      return
    }

    setInviting(true)
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, role }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send invite")

      if (data.emailSent) {
        toast.success(`Invitation sent to ${email}`)
      } else {
        toast.success("Invite link generated (no sender configured to email it)")
      }

      close()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send invite",
      )
    } finally {
      setInviting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation to join {accountName || "your account"}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={dialogFormClassName}>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">First Name</Label>
                <Input
                  id="invite-first-name"
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Last Name</Label>
                <Input
                  id="invite-last-name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={role}
                onValueChange={(val) => setRole(val as AccountRole)}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_CONFIG[r].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {ROLE_CONFIG[role].description}
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviting || !email}>
              {inviting ? <LoadingDots color="#fff" /> : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import RichTextEditor from "@/components/emails/rich-text-editor"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Users,
  Mail,
  Send,
  MousePointerClick,
  Eye,
  Loader2,
  RefreshCw,
  Trash2,
  UserPlus,
  ChevronsUpDown,
  X,
  Megaphone,
  UserX,
} from "lucide-react"
import { getInitials } from "@/lib/utils"

interface Person {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  dependent: boolean
  photo?: string
}

interface ListPerson {
  id: string
  created_at: string
  resend_contact_id: string | null
  people: Person
}

interface List {
  id: string
  created_at: string
  name: string
  description: string | null
  resend_segment_id: string | null
  list_people: ListPerson[]
}

interface Broadcast {
  id: string
  created_at: string
  name: string
  subject: string
  status: string
  sent_at: string | null
  total_recipients: number
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
}

interface Sender {
  id: string
  name: string
  email: string
}

interface ListDetailClientProps {
  list: List
  broadcasts: Broadcast[]
  allPeople: Person[]
  senders: Sender[]
  account: any
  accountId: string
}

export default function ListDetailClient({
  list,
  broadcasts,
  allPeople,
  senders,
  account,
  accountId,
}: ListDetailClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [searchQuery, setSearchQuery] = useState("")
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  // Add people state
  const [addOpen, setAddOpen] = useState(false)
  const [addSearchQuery, setAddSearchQuery] = useState("")
  const [addLoading, setAddLoading] = useState(false)

  // Unsubscribed contacts state
  const [unsubscribed, setUnsubscribed] = useState<{ id: string; email: string; first_name: string; last_name: string }[]>([])
  const [unsubLoading, setUnsubLoading] = useState(false)

  const fetchUnsubscribed = useCallback(async () => {
    if (!list.resend_segment_id) return
    setUnsubLoading(true)
    try {
      const response = await fetch("/api/lists/unsubscribed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId: list.resend_segment_id }),
      })
      const data = await response.json()
      if (response.ok && data.unsubscribed) {
        setUnsubscribed(data.unsubscribed)
      }
    } catch {
      // silently fail
    } finally {
      setUnsubLoading(false)
    }
  }, [list.resend_segment_id])

  useEffect(() => {
    fetchUnsubscribed()
  }, [fetchUnsubscribed])

  // Broadcast form state
  const [showBroadcastForm, setShowBroadcastForm] = useState(false)
  const [broadcastName, setBroadcastName] = useState("")
  const [broadcastSubject, setBroadcastSubject] = useState("")
  const [broadcastContent, setBroadcastContent] = useState("")
  const [selectedSender, setSelectedSender] = useState("")
  const [sendNow, setSendNow] = useState(false)
  const [broadcastLoading, setBroadcastLoading] = useState(false)

  const memberIds = useMemo(
    () => new Set(list.list_people.map((lp) => lp.people.id)),
    [list.list_people]
  )

  const availablePeople = useMemo(
    () => allPeople.filter((p) => !memberIds.has(p.id)),
    [allPeople, memberIds]
  )

  const unsubscribedEmails = useMemo(
    () => new Set(unsubscribed.map((c) => c.email?.toLowerCase())),
    [unsubscribed]
  )

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return list.list_people
    const q = searchQuery.toLowerCase()
    return list.list_people.filter((lp) => {
      const name = `${lp.people.first_name} ${lp.people.last_name}`.toLowerCase()
      const email = (lp.people.email || "").toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [list.list_people, searchQuery])

  // Aggregate broadcast stats
  const broadcastStats = useMemo(() => {
    const sent = broadcasts.filter((b) => b.status === "sent")
    return {
      totalBroadcasts: broadcasts.length,
      sentBroadcasts: sent.length,
      totalSent: sent.reduce((sum, b) => sum + (b.total_sent || 0), 0),
      totalDelivered: sent.reduce((sum, b) => sum + (b.total_delivered || 0), 0),
      totalOpened: sent.reduce((sum, b) => sum + (b.total_opened || 0), 0),
      totalClicked: sent.reduce((sum, b) => sum + (b.total_clicked || 0), 0),
    }
  }, [broadcasts])

  const openRate = broadcastStats.totalSent > 0
    ? Math.round((broadcastStats.totalOpened / broadcastStats.totalSent) * 100)
    : 0

  const clickRate = broadcastStats.totalSent > 0
    ? Math.round((broadcastStats.totalClicked / broadcastStats.totalSent) * 100)
    : 0

  const handleSyncMember = async (listPersonId: string) => {
    setSyncingId(listPersonId)
    try {
      const response = await fetch("/api/lists/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listPersonId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to sync")
      toast.success("Contact synced to Resend")
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to sync contact")
    } finally {
      setSyncingId(null)
    }
  }

  const handleRemovePerson = async (listPersonId: string, personName: string, email?: string) => {
    setRemovingId(listPersonId)
    try {
      const response = await fetch("/api/lists/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listPersonId, email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to remove")
      toast.success(`Removed ${personName} from list`)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to remove person")
    } finally {
      setRemovingId(null)
    }
  }

  const handleAddPerson = async (personId: string) => {
    setAddLoading(true)
    try {
      const response = await fetch("/api/lists/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: list.id, personIds: [personId] }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to add")

      // Auto-sync to Resend so the new member is included
      await fetch("/api/lists/sync-to-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: list.id }),
      })

      const person = allPeople.find((p) => p.id === personId)
      toast.success(`Added ${person?.first_name} ${person?.last_name} to list`)
      setAddSearchQuery("")
      setAddOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to add person")
    } finally {
      setAddLoading(false)
    }
  }

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSender || !broadcastSubject || !broadcastContent) {
      toast.error("Please fill in all required fields")
      return
    }

    if (!list.resend_segment_id) {
      toast.error("Please sync this list to Resend first")
      return
    }

    setBroadcastLoading(true)
    try {
      const response = await fetch("/api/broadcasts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_id: list.id,
          name: broadcastName || broadcastSubject,
          subject: broadcastSubject,
          content: broadcastContent,
          sender: selectedSender,
          sendNow,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create broadcast")

      toast.success(sendNow ? "Broadcast sent!" : "Broadcast saved as draft")
      setShowBroadcastForm(false)
      setBroadcastName("")
      setBroadcastSubject("")
      setBroadcastContent("")
      setSelectedSender("")
      setSendNow(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to create broadcast")
    } finally {
      setBroadcastLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/emails/lists"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Lists
        </Link>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{list.name}</h1>
            </div>
            {list.description && (
              <p className="text-muted-foreground">{list.description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Created {formatDistanceToNow(new Date(list.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowBroadcastForm(!showBroadcastForm)}
              disabled={list.list_people.length === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              New Broadcast
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{list.list_people.length}</div>
            <p className="text-xs text-muted-foreground">People in list</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Broadcasts</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadcastStats.sentBroadcasts}</div>
            <p className="text-xs text-muted-foreground">
              {broadcastStats.totalBroadcasts} total, {broadcastStats.sentBroadcasts} sent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadcastStats.totalSent}</div>
            <p className="text-xs text-muted-foreground">
              {broadcastStats.totalDelivered} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{openRate}%</div>
            <p className="text-xs text-muted-foreground">
              {broadcastStats.totalOpened} opens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{clickRate}%</div>
            <p className="text-xs text-muted-foreground">
              {broadcastStats.totalClicked} clicks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* New Broadcast Dialog */}
      <Dialog open={showBroadcastForm} onOpenChange={setShowBroadcastForm}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogTitle>New Broadcast</DialogTitle>
            <DialogDescription>
              Send an email to all {list.list_people.length} members of {list.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateBroadcast} className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 px-6 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bc-sender">From *</Label>
                    <Select value={selectedSender} onValueChange={setSelectedSender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a sender" />
                      </SelectTrigger>
                      <SelectContent>
                        {senders.map((s) => (
                          <SelectItem key={s.id} value={`${s.name} <${s.email}>`}>
                            {s.name} &lt;{s.email}&gt;
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {senders.length === 0 && (
                      <p className="text-xs text-red-600">
                        No verified senders. Add one in Settings first.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bc-name">Broadcast Name</Label>
                    <Input
                      id="bc-name"
                      placeholder="Internal name (optional)"
                      value={broadcastName}
                      onChange={(e) => setBroadcastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bc-subject">Subject *</Label>
                  <Input
                    id="bc-subject"
                    placeholder="Email subject line"
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email Content *</Label>
                  <RichTextEditor
                    content={broadcastContent}
                    onChange={setBroadcastContent}
                    placeholder="Write your email here..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the toolbar to format text, add images, and insert links.
                  </p>
                </div>
              </div>
            </ScrollArea>
            <div className="shrink-0 flex items-center justify-between border-t px-6 py-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="bc-send-now"
                  checked={sendNow}
                  onCheckedChange={setSendNow}
                />
                <Label htmlFor="bc-send-now" className="cursor-pointer text-sm">
                  Send now
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBroadcastForm(false)}
                  disabled={broadcastLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={broadcastLoading || !selectedSender || !broadcastSubject || !broadcastContent}
                >
                  {broadcastLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {sendNow ? "Send Broadcast" : "Save as Draft"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Broadcast History */}
      {broadcasts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Broadcast History</CardTitle>
            <CardDescription>All broadcasts sent to this list</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Clicked</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {broadcasts.map((b) => {
                    const bOpenRate = b.total_sent > 0 ? Math.round((b.total_opened / b.total_sent) * 100) : 0
                    const bClickRate = b.total_sent > 0 ? Math.round((b.total_clicked / b.total_sent) * 100) : 0
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{b.name}</div>
                            <div className="text-sm text-muted-foreground">{b.subject}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={b.status === "sent" ? "outline" : "secondary"}
                            className={cn(
                              b.status === "sent" && "bg-green-100 text-green-800",
                              b.status === "draft" && "bg-gray-100 text-gray-800",
                              b.status === "failed" && "bg-red-100 text-red-800",
                            )}
                          >
                            {b.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{b.total_sent || "—"}</TableCell>
                        <TableCell>
                          {b.status === "sent" ? `${b.total_opened} (${bOpenRate}%)` : "—"}
                        </TableCell>
                        <TableCell>
                          {b.status === "sent" ? `${b.total_clicked} (${bClickRate}%)` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {b.sent_at
                            ? formatDistanceToNow(new Date(b.sent_at), { addSuffix: true })
                            : formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members ({list.list_people.length})</CardTitle>
              <CardDescription>People in this list</CardDescription>
            </div>
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={addLoading}>
                  {addLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Add Person
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" side="bottom" align="end" sideOffset={4}>
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by name or email..."
                    value={addSearchQuery}
                    onValueChange={setAddSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>No people found.</CommandEmpty>
                    <CommandGroup>
                      {availablePeople
                        .filter((p) => {
                          if (!addSearchQuery) return true
                          const name = `${p.first_name} ${p.last_name}`.toLowerCase()
                          const email = (p.email || "").toLowerCase()
                          const q = addSearchQuery.toLowerCase()
                          return name.includes(q) || email.includes(q)
                        })
                        .slice(0, 15)
                        .map((person) => (
                          <div
                            key={person.id}
                            onClick={() => handleAddPerson(person.id)}
                            className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <Avatar className="h-7 w-7">
                              {person.photo && <AvatarImage src={person.photo} alt={`${person.first_name} ${person.last_name}`} />}
                              <AvatarFallback className="text-[10px]">
                                {getInitials(person.first_name, person.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {person.first_name} {person.last_name}
                              </div>
                              {person.email && (
                                <div className="text-xs text-muted-foreground truncate">{person.email}</div>
                              )}
                            </div>
                          </div>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Resend</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((lp) => (
                      <TableRow key={lp.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              {lp.people.photo && (
                                <AvatarImage src={lp.people.photo} alt={`${lp.people.first_name} ${lp.people.last_name}`} />
                              )}
                              <AvatarFallback className="text-xs">
                                {getInitials(lp.people.first_name, lp.people.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link
                                href={`/people/${lp.people.id}`}
                                className="font-medium hover:underline"
                              >
                                {lp.people.first_name} {lp.people.last_name}
                              </Link>
                              {lp.people.dependent && (
                                <Badge variant="outline" className="ml-2 text-xs">Dependent</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lp.people.email || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(lp.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          {unsubscribedEmails.has(lp.people.email?.toLowerCase()) ? (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700">Unsubscribed</Badge>
                          ) : lp.resend_contact_id ? (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Synced</Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSyncMember(lp.id)}
                              disabled={syncingId === lp.id}
                              className="h-7 gap-1.5 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 px-2"
                            >
                              {syncingId === lp.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              Sync
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemovePerson(lp.id, `${lp.people.first_name} ${lp.people.last_name}`, lp.people.email)
                            }
                            disabled={removingId === lp.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          >
                            {removingId === lp.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        {list.list_people.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-4">
                            <Users className="h-10 w-10 text-muted-foreground/50" />
                            <p className="font-medium">No members yet</p>
                            <p className="text-sm text-muted-foreground">
                              Add people to this list to get started
                            </p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No members match your search</p>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unsubscribed */}
      {(unsubscribed.length > 0 || unsubLoading) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-500" />
              Unsubscribed ({unsubLoading ? "..." : unsubscribed.length})
            </CardTitle>
            <CardDescription>
              People who have unsubscribed from this list
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unsubLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unsubscribed.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(contact.first_name || "", contact.last_name || "")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-muted-foreground">
                              {contact.first_name} {contact.last_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.email}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

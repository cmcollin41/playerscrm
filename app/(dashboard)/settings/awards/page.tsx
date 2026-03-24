"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trophy, Plus, Trash2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import LoadingCircle from "@/components/icons/loading-circle"
import Link from "next/link"
import { slugify } from "@/lib/slug"

interface AwardType {
  id: string
  account_id: string | null
  slug: string
  name: string
  category: string
  sport: string
  sort_order: number
}

const CATEGORIES = [
  { value: "all-state", label: "All-State" },
  { value: "all-region", label: "All-Region" },
  { value: "national", label: "National" },
  { value: "mvp", label: "MVP" },
  { value: "academic", label: "Academic" },
  { value: "milestone", label: "Milestone" },
  { value: "other", label: "Other" },
]

export default function AwardTypesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [awardTypes, setAwardTypes] = useState<AwardType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState("other")
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id, current_account_id, role")
        .eq("id", user.id)
        .single()

      if (!profile || profile.role !== "admin") {
        router.replace("/")
        return
      }

      const activeAccountId = profile.current_account_id || profile.account_id
      setAccountId(activeAccountId)
      await fetchAwardTypes(activeAccountId)
      setIsLoading(false)
    }
    load()
  }, [])

  async function fetchAwardTypes(accId: string) {
    // Get account-specific types
    const { data: accountTypes } = await supabase
      .from("award_types")
      .select("*")
      .eq("account_id", accId)
      .order("sort_order", { ascending: true })

    if (accountTypes && accountTypes.length > 0) {
      setAwardTypes(accountTypes)
      return
    }

    // No account types yet — seed from global defaults
    const { data: defaults } = await supabase
      .from("award_types")
      .select("*")
      .is("account_id", null)
      .order("sort_order", { ascending: true })

    if (defaults && defaults.length > 0) {
      const copies = defaults.map((d) => ({
        account_id: accId,
        slug: d.slug,
        name: d.name,
        category: d.category,
        sport: d.sport,
        sort_order: d.sort_order,
      }))

      const { data: inserted, error } = await supabase
        .from("award_types")
        .insert(copies)
        .select()

      if (error) {
        console.error("Failed to seed defaults:", error)
        toast.error("Failed to load default award types")
        return
      }

      setAwardTypes(inserted || [])
    }
  }

  async function handleAdd() {
    if (!newName.trim() || !accountId) return
    setIsAdding(true)

    const slug = slugify(newName.trim())
    const maxSort = awardTypes.reduce(
      (max, t) => Math.max(max, t.sort_order),
      0
    )

    const { data, error } = await supabase
      .from("award_types")
      .insert({
        account_id: accountId,
        slug,
        name: newName.trim(),
        category: newCategory,
        sport: "basketball",
        sort_order: maxSort + 10,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        toast.error("An award with that name already exists")
      } else {
        toast.error("Failed to add award type")
      }
      setIsAdding(false)
      return
    }

    setAwardTypes((prev) =>
      [...prev, data].sort((a, b) => a.sort_order - b.sort_order)
    )
    setNewName("")
    setNewCategory("other")
    setIsAdding(false)
    toast.success("Award type added")
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from("award_types")
      .delete()
      .eq("id", id)

    if (error) {
      toast.error("Failed to delete award type")
      return
    }

    setAwardTypes((prev) => prev.filter((t) => t.id !== id))
    toast.success("Award type removed")
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingCircle />
      </div>
    )
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    types: awardTypes.filter((t) => t.category === cat.value),
  })).filter((g) => g.types.length > 0)

  return (
    <div className="flex flex-col space-y-6 py-8">
      <div>
        <Link
          href="/settings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
        <h1 className="font-cal text-3xl font-bold">Award Types</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage the award types available when adding awards to players.
          Connected apps can filter players by these awards.
        </p>
      </div>

      {/* Add new award type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Award Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Award name (e.g. 6A MVP)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAdd()
                }
              }}
            />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || isAdding}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Award types list grouped by category */}
      {grouped.map((group) => (
        <Card key={group.value}>
          <CardHeader>
            <CardTitle className="text-base">{group.label}</CardTitle>
            <CardDescription>
              {group.types.length} award{group.types.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {group.types.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Trophy className="h-4 w-4 text-yellow-600" />
                    <div>
                      <span className="text-sm font-medium">{type.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {type.slug}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(type.id)}
                    className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {awardTypes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">
            No award types configured
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first award type above
          </p>
        </div>
      )}
    </div>
  )
}

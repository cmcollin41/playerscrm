"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Pencil, Plus, Settings2, Trash2 } from "lucide-react"

interface Season {
  id: string
  year_start: number
  year_end: number
  display_name: string
  slug: string
  is_current: boolean
}

interface SeasonSelectProps {
  accountId: string
  value: string | null
  onChange: (seasonId: string | null) => void
  id?: string
}

const NONE = "__none__"
const ADD_NEW = "__add_new__"
const MANAGE = "__manage__"

// Convention: user enters the year the season *ends* (e.g. 2026 for the 2025-26 season).
// "2026" → { year_start: 2025, year_end: 2026, display_name: "2025-26" }
function deriveSeasonFields(yearEnd: number) {
  const year_start = yearEnd - 1
  const display_name = `${year_start}-${String(yearEnd).slice(-2)}`
  return { year_start, year_end: yearEnd, display_name, slug: display_name }
}

function sortByYearDesc(list: Season[]): Season[] {
  return [...list].sort((a, b) => b.year_start - a.year_start)
}

export function SeasonSelect({ accountId, value, onChange, id }: SeasonSelectProps) {
  const supabase = useMemo(() => createClient(), [])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<"select" | "add" | "manage">("select")
  const [yearInput, setYearInput] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingYear, setEditingYear] = useState<string>("")

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    setIsLoading(true)
    void (async () => {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, year_start, year_end, display_name, slug, is_current")
        .eq("account_id", accountId)
        .order("year_start", { ascending: false })
      if (cancelled) return
      if (error) {
        toast.error("Failed to load seasons")
      } else {
        setSeasons(data ?? [])
      }
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [accountId, supabase])

  const handleSelect = (next: string) => {
    if (next === ADD_NEW) {
      setMode("add")
      return
    }
    if (next === MANAGE) {
      setMode("manage")
      return
    }
    onChange(next === NONE ? null : next)
  }

  const validateYear = (raw: string): number | null => {
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1900 || n > 2100) return null
    return n
  }

  const handleCreate = async () => {
    const yearEnd = validateYear(yearInput)
    if (yearEnd == null) {
      toast.error("Enter a valid year (e.g. 2026 for the 2025-26 season)")
      return
    }
    const fields = deriveSeasonFields(yearEnd)

    setIsSaving(true)
    const { data, error } = await supabase
      .from("seasons")
      .insert({ account_id: accountId, ...fields })
      .select("id, year_start, year_end, display_name, slug, is_current")
      .single()
    setIsSaving(false)

    if (error || !data) {
      if (error?.code === "23505") {
        const { data: existing } = await supabase
          .from("seasons")
          .select("id, year_start, year_end, display_name, slug, is_current")
          .eq("account_id", accountId)
          .eq("year_start", fields.year_start)
          .maybeSingle()
        if (existing) {
          setSeasons((prev) =>
            prev.some((s) => s.id === existing.id) ? prev : sortByYearDesc([...prev, existing])
          )
          onChange(existing.id)
          setMode("select")
          setYearInput("")
          return
        }
      }
      toast.error(error?.message || "Failed to create season")
      return
    }

    setSeasons((prev) => sortByYearDesc([...prev, data]))
    onChange(data.id)
    setMode("select")
    setYearInput("")
    toast.success(`Season ${data.display_name} created`)
  }

  const startEdit = (season: Season) => {
    setEditingId(season.id)
    setEditingYear(String(season.year_end))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingYear("")
  }

  const saveEdit = async () => {
    if (!editingId) return
    const yearEnd = validateYear(editingYear)
    if (yearEnd == null) {
      toast.error("Enter a valid year (e.g. 2026 for the 2025-26 season)")
      return
    }
    const fields = deriveSeasonFields(yearEnd)
    setIsSaving(true)
    const { data, error } = await supabase
      .from("seasons")
      .update(fields)
      .eq("id", editingId)
      .select("id, year_start, year_end, display_name, slug, is_current")
      .single()
    setIsSaving(false)
    if (error || !data) {
      toast.error(error?.message || "Failed to update season")
      return
    }
    setSeasons((prev) =>
      sortByYearDesc(prev.map((s) => (s.id === editingId ? data : s)))
    )
    cancelEdit()
    toast.success(`Renamed to ${data.display_name}`)
  }

  const deleteSeason = async (season: Season) => {
    if (!confirm(`Delete season ${season.display_name}? Teams using it will become unassigned.`))
      return
    setIsSaving(true)
    const { error } = await supabase.from("seasons").delete().eq("id", season.id)
    setIsSaving(false)
    if (error) {
      toast.error(error.message || "Failed to delete season")
      return
    }
    setSeasons((prev) => prev.filter((s) => s.id !== season.id))
    if (value === season.id) onChange(null)
    toast.success(`Deleted ${season.display_name}`)
  }

  if (mode === "add") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder="End year (e.g. 2026 for 2025-26)"
          value={yearInput}
          onChange={(e) => setYearInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void handleCreate()
            }
            if (e.key === "Escape") {
              setMode("select")
              setYearInput("")
            }
          }}
          autoFocus
        />
        <Button type="button" size="sm" onClick={handleCreate} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setMode("select")
            setYearInput("")
          }}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    )
  }

  if (mode === "manage") {
    return (
      <div className="rounded-md border bg-zinc-50/50 p-2 space-y-1">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-xs font-medium text-muted-foreground">Manage seasons</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => {
              setMode("select")
              cancelEdit()
            }}
          >
            Done
          </Button>
        </div>
        {seasons.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No seasons yet.</p>
        ) : (
          seasons.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="flex items-center gap-2 px-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={editingYear}
                  onChange={(e) => setEditingYear(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void saveEdit()
                    }
                    if (e.key === "Escape") cancelEdit()
                  }}
                  className="h-8"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={saveEdit} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={cancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-white"
              >
                <span className="text-sm">
                  {s.display_name}
                  {s.is_current && (
                    <span className="ml-2 text-xs text-muted-foreground">(current)</span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => startEdit(s)}
                    disabled={isSaving}
                    aria-label="Rename season"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => deleteSeason(s)}
                    disabled={isSaving}
                    aria-label="Delete season"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          )
        )}
      </div>
    )
  }

  return (
    <Select value={value ?? NONE} onValueChange={handleSelect}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={isLoading ? "Loading..." : "No season"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No season</SelectItem>
        {seasons.length > 0 && <SelectSeparator />}
        {seasons.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.display_name}
            {s.is_current ? " (current)" : ""}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={ADD_NEW}>
          <span className="flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />
            Add new season
          </span>
        </SelectItem>
        {seasons.length > 0 && (
          <SelectItem value={MANAGE}>
            <span className="flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5" />
              Manage seasons
            </span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}

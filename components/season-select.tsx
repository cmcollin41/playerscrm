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
import { Loader2, Plus } from "lucide-react"

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

function formatSeasonLabel(yearStart: number, yearEnd: number): string {
  return `${yearStart}-${String(yearEnd).slice(-2)}`
}

export function SeasonSelect({ accountId, value, onChange, id }: SeasonSelectProps) {
  const supabase = useMemo(() => createClient(), [])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newYearStart, setNewYearStart] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

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
      setIsAdding(true)
      return
    }
    onChange(next === NONE ? null : next)
  }

  const handleCreate = async () => {
    const yearStart = parseInt(newYearStart, 10)
    if (!Number.isFinite(yearStart) || yearStart < 1900 || yearStart > 2100) {
      toast.error("Enter a valid year (e.g. 2003)")
      return
    }
    const yearEnd = yearStart + 1
    const displayName = formatSeasonLabel(yearStart, yearEnd)
    const slug = displayName

    setIsSaving(true)
    const { data, error } = await supabase
      .from("seasons")
      .insert({
        account_id: accountId,
        year_start: yearStart,
        year_end: yearEnd,
        display_name: displayName,
        slug,
      })
      .select("id, year_start, year_end, display_name, slug, is_current")
      .single()
    setIsSaving(false)

    if (error || !data) {
      if (error?.code === "23505") {
        const { data: existing } = await supabase
          .from("seasons")
          .select("id, year_start, year_end, display_name, slug, is_current")
          .eq("account_id", accountId)
          .eq("year_start", yearStart)
          .maybeSingle()
        if (existing) {
          setSeasons((prev) =>
            prev.some((s) => s.id === existing.id)
              ? prev
              : [...prev, existing].sort((a, b) => b.year_start - a.year_start)
          )
          onChange(existing.id)
          setIsAdding(false)
          setNewYearStart("")
          return
        }
      }
      toast.error(error?.message || "Failed to create season")
      return
    }

    setSeasons((prev) =>
      [...prev, data].sort((a, b) => b.year_start - a.year_start)
    )
    onChange(data.id)
    setIsAdding(false)
    setNewYearStart("")
    toast.success(`Season ${data.display_name} created`)
  }

  if (isAdding) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Start year (e.g. 2003)"
          value={newYearStart}
          onChange={(e) => setNewYearStart(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void handleCreate()
            }
            if (e.key === "Escape") {
              setIsAdding(false)
              setNewYearStart("")
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
            setIsAdding(false)
            setNewYearStart("")
          }}
          disabled={isSaving}
        >
          Cancel
        </Button>
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
      </SelectContent>
    </Select>
  )
}

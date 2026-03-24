"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Account {
  id: string
  name: string
  sport?: string
}

interface AccountSwitcherProps {
  currentAccountId?: string
  currentAccountName?: string
}

const CACHE_KEY = "account-switcher-accounts"

export function AccountSwitcher({ currentAccountId, currentAccountName }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false)
  // Always initialize with server-provided value to avoid hydration mismatch
  const [accounts, setAccounts] = useState<Account[]>(
    currentAccountId && currentAccountName
      ? [{ id: currentAccountId, name: currentAccountName }]
      : []
  )
  const [activeId, setActiveId] = useState(currentAccountId)
  const [switching, setSwitching] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Try cache first for instant render
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as Account[]
        if (parsed.length > 0) setAccounts(parsed)
      }
    } catch {}

    // Then fetch fresh data
    const fetchAccounts = async () => {
      const { data: members } = await supabase
        .from("account_members")
        .select("account_id, accounts(id, name, sport)")

      if (members && members.length > 0) {
        const accs = members
          .map((m: any) => m.accounts)
          .filter(Boolean)
          .filter(
            (a: Account, i: number, arr: Account[]) =>
              arr.findIndex((x) => x.id === a.id) === i,
          )
        setAccounts(accs)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(accs)) } catch {}
      }
    }
    fetchAccounts()
  }, [])

  const switchAccount = async (accountId: string) => {
    if (accountId === activeId) {
      setOpen(false)
      return
    }

    setSwitching(true)
    const { error } = await supabase.rpc("switch_account", {
      p_account_id: accountId,
    })

    if (error) {
      console.error("Failed to switch account:", error)
      setSwitching(false)
      return
    }

    window.location.href = "/"
  }

  const activeAccount = accounts.find((a) => a.id === activeId)
  const displayName = activeAccount?.name || currentAccountName || ""

  if (accounts.length <= 1) {
    return (
      <div className="hidden md:flex h-8 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700">
        {displayName}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex h-8 gap-1 border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          disabled={switching}
        >
          <span className="truncate max-w-[180px]">
            {displayName || "Select account"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-1 bg-white" align="end">
        {accounts.map((account) => (
          <button
            key={account.id}
            onClick={() => switchAccount(account.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100",
              account.id === activeId && "bg-gray-50 font-medium",
            )}
          >
            <Check
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                account.id === activeId ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="truncate">{account.name}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

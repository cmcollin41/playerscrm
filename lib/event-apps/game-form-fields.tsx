"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { EventAppFormContext } from "./types"

export function GameFormFields({ appData, setAppField }: EventAppFormContext) {
  const opponent = appData.opponent ?? ""
  const isHome = appData.is_home ?? true

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="opponent">Opponent *</Label>
        <Input
          id="opponent"
          placeholder="Lone Peak"
          value={opponent}
          onChange={(e) => setAppField("opponent", e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Home game</p>
          <p className="text-xs text-gray-500">
            {isHome ? "Played at our location" : "Played at the opponent's location"}
          </p>
        </div>
        <Switch
          checked={isHome}
          onCheckedChange={(v) => setAppField("is_home", v)}
        />
      </div>
    </>
  )
}

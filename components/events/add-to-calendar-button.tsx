"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  googleCalendarUrl,
  outlookCalendarUrl,
  type AddToCalendarEvent,
} from "@/lib/events/add-to-calendar"
import { CalendarPlus } from "lucide-react"

interface AddToCalendarButtonProps {
  event: AddToCalendarEvent
  icsUrl: string
  size?: "sm" | "default"
  variant?: "default" | "outline" | "ghost" | "secondary"
  label?: string
  seriesCount?: number
  seriesIcsUrl?: string
}

export function AddToCalendarButton({
  event,
  icsUrl,
  size = "sm",
  variant = "outline",
  label = "Add to Calendar",
  seriesCount,
  seriesIcsUrl,
}: AddToCalendarButtonProps) {
  if (!event.starts_at) return null

  const googleUrl = googleCalendarUrl(event)
  const outlookUrl = outlookCalendarUrl(event)
  const showSeries = !!seriesCount && seriesCount > 1 && !!seriesIcsUrl

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {showSeries && (
          <>
            <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              This date
            </div>
          </>
        )}
        <DropdownMenuItem asChild>
          <a href={googleUrl} target="_blank" rel="noopener noreferrer">
            Google Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={icsUrl} download>
            Apple Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={outlookUrl} target="_blank" rel="noopener noreferrer">
            Outlook
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={icsUrl} download>
            Download .ics
          </a>
        </DropdownMenuItem>
        {showSeries && (
          <>
            <div className="my-1 h-px bg-zinc-100" />
            <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              All {seriesCount} dates
            </div>
            <DropdownMenuItem asChild>
              <a href={seriesIcsUrl} download>
                Add full series (.ics)
              </a>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

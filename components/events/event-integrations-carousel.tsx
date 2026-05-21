"use client"

import * as React from "react"
import {
  Calendar,
  Dumbbell,
  GraduationCap,
  Package,
  ShoppingBag,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"
import { partnerBranding } from "@/lib/store/partners"

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  camp: GraduationCap,
  game: Swords,
  practice: Dumbbell,
  tournament: Trophy,
  other: Calendar,
  products: Package,
  printify: ShoppingBag,
}

export interface EventIntegrationsCarouselItem {
  slug: string
  name: string
  description?: string
}

export function EventIntegrationsCarousel({
  items,
  selectedSlug,
  onSelect,
}: {
  items: EventIntegrationsCarouselItem[]
  /** When provided, each slide becomes a clickable picker tile and the matching slug is highlighted. */
  selectedSlug?: string
  onSelect?: (slug: string) => void
}) {
  const interactive = !!onSelect
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <Carousel setApi={setApi} opts={{ align: "start", loop: false }}>
        <CarouselContent>
          {items.map((item) => {
            const branding = partnerBranding(item.slug)
            const Icon = ICON_BY_SLUG[item.slug] ?? Calendar
            const isSelected = interactive && item.slug === selectedSlug
            const cardClasses = cn(
              "flex h-full w-full flex-col gap-3 rounded-lg border p-4 text-left transition-colors",
              interactive
                ? isSelected
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                : "bg-card",
            )
            const inner = (
              <>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md",
                    isSelected ? "bg-white/15" : "bg-muted",
                  )}
                >
                  {branding.logoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={branding.logoPath}
                      alt={item.name}
                      className="h-6 w-6 object-contain"
                    />
                  ) : (
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isSelected ? "text-white" : "text-foreground",
                      )}
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  {item.description && (
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        isSelected ? "text-gray-300" : "text-muted-foreground",
                      )}
                    >
                      {item.description}
                    </p>
                  )}
                </div>
              </>
            )
            return (
              <CarouselItem
                key={item.slug}
                className="basis-full sm:basis-1/2 lg:basis-1/3"
              >
                {interactive ? (
                  <button
                    type="button"
                    onClick={() => onSelect?.(item.slug)}
                    className={cardClasses}
                  >
                    {inner}
                  </button>
                ) : (
                  <div className={cardClasses}>{inner}</div>
                )}
              </CarouselItem>
            )
          })}
        </CarouselContent>
      </Carousel>
      {count > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to integration ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === current
                  ? "w-4 bg-gray-900"
                  : "w-1.5 bg-gray-300 hover:bg-gray-400",
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

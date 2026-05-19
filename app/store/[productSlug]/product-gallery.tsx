"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

export interface GallerySlide {
  /** Color label used as the key + thumbnail caption. */
  color: string
  imageUrl: string | null
}

interface ProductGalleryProps {
  slides: GallerySlide[]
  /** Product name — used for alt text. */
  productName: string
  /** Color currently picked in the buy panel (drives the carousel). */
  selectedColor: string | null
  /** Fired when the user swipes / clicks a thumbnail. */
  onColorChange?: (color: string) => void
}

export function ProductGallery({
  slides,
  productName,
  selectedColor,
  onColorChange,
}: ProductGalleryProps) {
  const [api, setApi] = useState<CarouselApi | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Sync external color selection → carousel position.
  useEffect(() => {
    if (!api || !selectedColor) return
    const idx = slides.findIndex((s) => s.color === selectedColor)
    if (idx >= 0 && idx !== api.selectedScrollSnap()) {
      api.scrollTo(idx)
    }
  }, [api, selectedColor, slides])

  // Sync carousel position → external color selection.
  useEffect(() => {
    if (!api) return
    const handleSelect = () => {
      const idx = api.selectedScrollSnap()
      setCurrentIndex(idx)
      const next = slides[idx]
      if (next && next.color !== selectedColor) {
        onColorChange?.(next.color)
      }
    }
    handleSelect()
    api.on("select", handleSelect)
    return () => {
      api.off("select", handleSelect)
    }
    // selectedColor intentionally omitted — sync is driven by the carousel here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, slides, onColorChange])

  const jumpTo = useCallback(
    (idx: number) => {
      api?.scrollTo(idx)
    },
    [api],
  )

  if (slides.length === 0) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted" />
    )
  }

  // Single image: skip the carousel chrome — fewer pixels of UI noise.
  if (slides.length === 1) {
    const only = slides[0]
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
        {only.imageUrl ? (
          <Image
            src={only.imageUrl}
            alt={`${productName} — ${only.color}`}
            fill
            className="object-cover"
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Carousel
        opts={{ loop: false, align: "start" }}
        setApi={setApi}
        className="relative"
      >
        <CarouselContent>
          {slides.map((slide, i) => (
            <CarouselItem key={slide.color}>
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                {slide.imageUrl ? (
                  <Image
                    src={slide.imageUrl}
                    alt={`${productName} — ${slide.color}`}
                    fill
                    className="object-cover"
                    priority={i === 0}
                    sizes="(min-width: 768px) 50vw, 100vw"
                  />
                ) : null}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-3" />
        <CarouselNext className="right-3" />

        {/* Counter — anchored to the slide for a clean PDP look. */}
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium tabular-nums text-foreground/80 shadow-sm backdrop-blur">
          {currentIndex + 1} / {slides.length}
        </div>
      </Carousel>

      <ul
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Product colors"
      >
        {slides.map((slide, i) => {
          const isActive = i === currentIndex
          return (
            <li key={slide.color} className="shrink-0">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={slide.color}
                onClick={() => jumpTo(i)}
                className={cn(
                  "relative block h-16 w-16 overflow-hidden rounded-md border-2 bg-muted transition",
                  isActive
                    ? "border-foreground"
                    : "border-transparent hover:border-muted-foreground/60",
                )}
              >
                {slide.imageUrl ? (
                  <Image
                    src={slide.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

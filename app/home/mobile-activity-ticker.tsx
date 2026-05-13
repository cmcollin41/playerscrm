"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

interface Activity {
  icon: React.ReactNode
  accent: string
  delta: string
  label: string
}

// Each visible position: front (newest) is full-size, the ones behind it
// recede in scale + opacity and peek up out of the top of the stack.
const STACK_POSITIONS = [
  { opacity: 1.0, y: 0, scale: 1.0 }, // front (newest)
  { opacity: 0.7, y: -10, scale: 0.94 }, // one behind
  { opacity: 0.42, y: -20, scale: 0.88 }, // two behind
] as const

const STACK_VISIBLE = STACK_POSITIONS.length
const INTERVAL_MS = 2200

/**
 * Mobile-only iOS-style notification stack. The newest activity sits on
 * top at full size; older ones peek above it, smaller and more
 * transparent. After cycling through every activity, the source list
 * wraps so the first one re-enters on top.
 */
export function MobileActivityTicker({
  activities,
}: {
  activities: Activity[]
}) {
  const [stack, setStack] = useState<{ activity: Activity; id: number }[]>([])

  useEffect(() => {
    if (activities.length === 0) return

    let counter = 0
    let index = 0

    const push = () => {
      counter += 1
      const next = activities[index % activities.length]
      index += 1
      // Keep one extra in the array so the kicked-out card has a chance to
      // animate its exit before AnimatePresence unmounts it.
      setStack((prev) =>
        [{ activity: next, id: counter }, ...prev].slice(0, STACK_VISIBLE),
      )
    }

    push()
    const id = window.setInterval(push, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [activities])

  return (
    <div className="mt-6 w-full sm:hidden">
      <div className="relative h-[88px]">
        <AnimatePresence initial={false}>
          {stack.map((item, i) => {
            const target = STACK_POSITIONS[i]
            return (
              <motion.div
                key={item.id}
                className="absolute inset-x-0 bottom-0 flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xl ring-1 ring-black/5"
                style={{ zIndex: 50 - i }}
                initial={{ opacity: 0, y: 60, scale: 0.95 }}
                animate={{
                  opacity: target?.opacity ?? 0,
                  y: target?.y ?? -30,
                  scale: target?.scale ?? 0.82,
                }}
                exit={{ opacity: 0, y: -36, scale: 0.82 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${item.activity.accent}`}
                >
                  {item.activity.icon}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="font-display text-base text-gray-900">
                    {item.activity.delta}
                  </p>
                  <p className="text-xs text-gray-500">{item.activity.label}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

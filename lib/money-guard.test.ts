import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Fails when source code converts money by hand. Cents and dollars are
 * converted only in lib/money.ts. If this test fails on your change, use
 * dollarsToCents / centsToDollars / formatCents from "@/lib/money".
 * If your line is genuinely not money (a percentage needs no entry: any
 * line that also divides is ignored by the "* 100" rule), add the file to
 * the matching allowlist below with a reason.
 */

const ROOT = process.cwd()
const SCAN_DIRS = ["app", "components", "lib"]
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"]

// "/ 100" outside the money module.
const DIVIDE_ALLOWED: Record<string, string> = {
  "lib/money.ts": "the conversion module itself",
  "lib/fees.ts": "percent / 100 when applying the platform fee percentage",
  "lib/maxpreps.ts": "century arithmetic on years",
}

// "* 100" on a line with no division (percentages always divide first).
const MULTIPLY_ALLOWED: Record<string, string> = {
  "lib/money.ts": "the conversion module itself",
  "app/(dashboard)/settings/account/page.tsx": "Math.random() * 100 for a placeholder",
}

const SKIP_PREFIXES = ["components/marketing/"]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
      continue
    }
    if (!EXTENSIONS.some((ext) => name.endsWith(ext))) continue
    if (name.includes(".test.")) continue
    out.push(full)
  }
  return out
}

function findViolations(): string[] {
  const violations: string[] = []
  for (const dir of SCAN_DIRS) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const rel = relative(ROOT, file).split("\\").join("/")
      if (SKIP_PREFIXES.some((p) => rel.startsWith(p))) continue
      const lines = readFileSync(file, "utf8").split("\n")
      lines.forEach((line, i) => {
        if (/\/\s*100\b/.test(line) && !(rel in DIVIDE_ALLOWED)) {
          violations.push(`${rel}:${i + 1} divides by 100: ${line.trim()}`)
        }
        if (/\*\s*100\b/.test(line) && !line.includes("/") && !(rel in MULTIPLY_ALLOWED)) {
          violations.push(`${rel}:${i + 1} multiplies by 100: ${line.trim()}`)
        }
      })
    }
  }
  return violations
}

describe("money conversions", () => {
  it("happen only in lib/money.ts", () => {
    expect(findViolations()).toEqual([])
  })
})

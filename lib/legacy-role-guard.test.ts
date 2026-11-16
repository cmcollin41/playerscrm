import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Fails when code reads the legacy profiles.role flag. Access is decided by
 * the caller's role on the active account:
 *   supabase.rpc("has_account_role", { p_account_id, p_min_role })
 * or the helpers in lib/auth.ts (requireAccountAdminApi, hasAccountAdminAccess).
 */

const ROOT = process.cwd()
const SCAN_DIRS = ["app", "components", "lib"]
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"]
const LEGACY_ROLE = /\b(raw)?[pP]rofile\??\.role\b/

const ALLOWED: Record<string, string> = {
  "lib/fetchers/server.ts": "passes the stored value through in getAccount(); not an access check",
}

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
      if (rel in ALLOWED) continue
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (LEGACY_ROLE.test(line)) {
            violations.push(`${rel}:${i + 1} reads profile.role: ${line.trim()}`)
          }
        })
    }
  }
  return violations
}

describe("legacy profiles.role", () => {
  it("is not used to decide access", () => {
    expect(findViolations()).toEqual([])
  })
})

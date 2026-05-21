"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { connectIntegration } from "./actions"

interface ConnectButtonProps {
  accountId: string
  slug: string
  name: string
  tokenSetupUrl?: string
}

export function ConnectButton({
  accountId,
  slug,
  name,
  tokenSetupUrl,
}: ConnectButtonProps) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState("")
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!token.trim()) {
      toast.error("Paste a token to continue.")
      return
    }
    startTransition(async () => {
      const result = await connectIntegration({
        accountId,
        slug,
        token: token.trim(),
      })
      if (!result.ok) {
        toast.error(result.error ?? "Could not connect integration.")
        return
      }
      toast.success(`Connected ${name}.`)
      setOpen(false)
      setToken("")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Connect</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {name}</DialogTitle>
          <DialogDescription>
            Paste a personal access token from your {name} account.
            We&apos;ll encrypt and store it; it&apos;s only used to sync
            products and push orders.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {tokenSetupUrl && (
            <a
              href={tokenSetupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Generate a token in {name}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor={`token-${slug}`}>Personal access token</Label>
            <Input
              id={`token-${slug}`}
              type="password"
              autoComplete="off"
              placeholder="paste your token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={pending}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !token.trim()}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

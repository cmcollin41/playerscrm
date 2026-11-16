# Credential rotation checklist (owner task)

`.env.local` was committed to git and pushed. Treat every credential that
was ever in it as exposed. Rotate in this order; after each rotation update
the value in Vercel (Project → Settings → Environment Variables, all
environments) and in your local `.env.local`, then redeploy.

- [ ] **Supabase service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) — highest
      priority; it bypasses row-level security for all tenants. Supabase
      dashboard → Project Settings → API keys. Rotating the JWT secret also
      invalidates the anon key, so update `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      in the same deploy.
- [ ] **Stripe secret key** (`STRIPE_SECRET_KEY`) — Stripe dashboard →
      Developers → API keys → roll key. Do this for live mode and test mode.
- [ ] **Stripe webhook signing secrets** (`STRIPE_WEBHOOK_SECRET_KEY`,
      `STRIPE_CONNECT_WEBHOOK_SECRET_KEY`) — Developers → Webhooks → each
      endpoint → roll secret.
- [ ] **Resend API key** (`RESEND_API_KEY`) — create a new key, deploy,
      then delete the old one.
- [ ] **Resend webhook secrets** (`RESEND_WEBHOOK_SECRET`,
      `RESEND_DOMAIN_WEBHOOK_SECRET`) — recreate or roll each webhook's secret.
- [ ] **Vercel API token** (`AUTH_BEARER_TOKEN`) — Vercel → Account
      Settings → Tokens: create a new token, deploy, delete the old one.
- [ ] **Any other key present in the file** (for example an OpenAI key left
      over from the starter kit) — revoke it; the app does not use it.
- [ ] **`PLATFORM_ENCRYPTION_KEY`** — ONLY if it was in the committed file.
      Do NOT simply replace it: stored print-partner credentials are
      encrypted with it (`lib/integrations/products/crypto.ts`). Either
      re-encrypt those rows with the new key first, or have each account
      reconnect its print partner after the change.
- [ ] Check provider logs for unexpected use during the exposure window
      (Stripe → Developers → Logs; Supabase → Logs; Resend → Emails).
- [ ] Decide whether to purge `.env.local` from git history
      (`git filter-repo --path .env.local --invert-paths`, then force-push
      and have every collaborator re-clone). Rotation is what makes the
      leaked values harmless; purging is optional clean-up.
- [ ] If the repository is or ever was public, or has outside collaborators,
      assume the values were copied.

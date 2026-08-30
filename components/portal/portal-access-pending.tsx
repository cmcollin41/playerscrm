"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * Shown to a signed-in parent who reached a dashboard route. Their email
 * matches a `people` row, so they belong in the portal — they just aren't
 * staff. Distinct from DashboardAccessDenied, which tells people they have
 * no account at all.
 */
export function PortalAccessPending({ email }: { email: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/portal-login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
          Parent portal
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
          This part is for staff
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          You&apos;re signed in
          {email ? (
            <>
              {" "}
              as <span className="font-medium text-gray-900">{email}</span>
            </>
          ) : null}
          . Rosters, invoices and everything tied to your family live in the
          parent portal — the coach dashboard is a separate area.
        </p>
        <Button className="mt-6 w-full" asChild>
          <Link href="/portal/welcome">Go to my portal</Link>
        </Button>
        <Button
          variant="ghost"
          className="mt-2 w-full"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Sign out
        </Button>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

// Bare /portal lands here when an authenticated parent visits the root
// portal URL. The layout has already enforced auth; just bounce to the
// dashboard overview. (Logged-out visitors are caught upstream by the
// proxy and sent to /portal-login.)
export default function PortalIndex() {
  redirect("/portal/welcome")
}

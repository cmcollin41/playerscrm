import { NextResponse } from "next/server"
import { sendInvoiceEmail } from "@/lib/send-invoice-email"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { invoiceId } = await req.json()

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      )
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, account_id")
      .eq("id", invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    const { data: rawProfile } = await supabase
      .from("profiles")
      .select("account_id, current_account_id")
      .eq("id", user.id)
      .single()

    const activeAccountId =
      rawProfile?.current_account_id || rawProfile?.account_id
    if (activeAccountId !== invoice.account_id) {
      return NextResponse.json(
        { error: "Unauthorized access to invoice" },
        { status: 403 }
      )
    }

    const result = await sendInvoiceEmail(invoiceId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send invoice email" },
        { status: result.error?.includes("No ") ? 400 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Invoice email sent to ${result.sent_count} recipient${result.sent_count !== 1 ? "s" : ""}${result.failed_count > 0 ? ` (${result.failed_count} failed)` : ""}`,
      sent_count: result.sent_count,
      failed_count: result.failed_count,
    })
  } catch (error: any) {
    console.error("Error in /api/invoices/resend:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

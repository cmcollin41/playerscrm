import { NextResponse } from "next/server"
import resend from "@/lib/resend"
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { person_id, email, first_name, last_name } = body

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    try {
      const { data, error } = await resend.contacts.create({
        email,
        firstName: first_name || "",
        lastName: last_name || "",
        unsubscribed: false,
      })

      if (error) {
        if (error.message?.includes("already exists")) {
          return NextResponse.json({
            success: true,
            message: "Contact already exists in Resend",
            data: { email },
          })
        }

        console.error("Error creating Resend contact:", error)
        return NextResponse.json(
          { error: "Failed to create Resend contact", details: error },
          { status: 500 }
        )
      }

      if (person_id && data?.id) {
        await supabase
          .from("people")
          .update({
            metadata: {
              resend_contact_id: data.id,
            },
          })
          .eq("id", person_id)
      }

      return NextResponse.json({
        success: true,
        message: "Contact synced to Resend",
        data,
      })
    } catch (resendError: any) {
      console.error("Resend API error:", resendError)
      return NextResponse.json(
        { error: "Failed to sync contact", details: resendError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error in /api/resend/sync-contact:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

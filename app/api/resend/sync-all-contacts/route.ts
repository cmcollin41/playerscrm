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

    const { data: rawProfile } = await supabase
      .from("profiles")
      .select("account_id, current_account_id")
      .eq("id", user.id)
      .single()

    const profile = rawProfile ? { ...rawProfile, account_id: rawProfile.current_account_id || rawProfile.account_id } : null

    if (!profile?.account_id) {
      return NextResponse.json(
        { error: "No account found for user" },
        { status: 404 }
      )
    }

    const { data: people, error: peopleError } = await supabase
      .from("people")
      .select("id, email, first_name, last_name, account_people!inner(account_id)")
      .eq("account_people.account_id", profile.account_id)
      .not("email", "is", null)

    if (peopleError) {
      console.error("Error fetching people:", peopleError)
      return NextResponse.json(
        { error: "Failed to fetch people", details: peopleError },
        { status: 500 }
      )
    }

    if (!people || people.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No people with emails found",
        stats: { total: 0, synced: 0, failed: 0, skipped: 0 },
      })
    }

    let synced = 0
    let failed = 0
    let skipped = 0

    for (const person of people) {
      try {
        const { data, error } = await resend.contacts.create({
          email: person.email!,
          firstName: person.first_name || "",
          lastName: person.last_name || "",
          unsubscribed: false,
        })

        if (error) {
          if (error.message?.includes("already exists")) {
            skipped++
            continue
          }

          console.error(`Error creating contact for ${person.email}:`, error)
          failed++
          continue
        }

        synced++

        if (data?.id) {
          await supabase
            .from("people")
            .update({
              metadata: {
                resend_contact_id: data.id,
              },
            })
            .eq("id", person.id)
        }

        await new Promise((resolve) => setTimeout(resolve, 50))
      } catch (error) {
        console.error(`Error syncing person ${person.id}:`, error)
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} contacts to Resend`,
      stats: {
        total: people.length,
        synced,
        failed,
        skipped,
      },
    })
  } catch (error: any) {
    console.error("Error in /api/resend/sync-all-contacts:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

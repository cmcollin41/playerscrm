import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { EventEditClient } from "./event-edit-client"

export default async function EventEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !event) notFound()

  return <EventEditClient event={event} />
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { primaryPersonId, secondaryPersonId, mergedData } = await req.json();

    if (!primaryPersonId || !secondaryPersonId || !mergedData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (primaryPersonId === secondaryPersonId) {
      return NextResponse.json(
        { error: "Cannot merge a person with themselves" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      );
    }

    const { data: people, error: peopleError } = await supabase
      .from("people")
      .select("id, account_id")
      .in("id", [primaryPersonId, secondaryPersonId])
      .eq("account_id", profile.account_id);

    if (peopleError || !people || people.length !== 2) {
      return NextResponse.json(
        { error: "One or both people not found" },
        { status: 404 }
      );
    }

    console.log("Starting merge process...", {
      primaryPersonId,
      secondaryPersonId,
      mergedData,
    });

    // Step 1: Update relationships - person_id references
    // Update relationships where secondary person is the "from" person
    const { error: rel1Error } = await supabase
      .from("relationships")
      .update({ person_id: primaryPersonId })
      .eq("person_id", secondaryPersonId);

    if (rel1Error) {
      console.error("Error updating relationships (person_id):", rel1Error);
      throw new Error(`Failed to update relationships: ${rel1Error.message}`);
    }

    // Step 2: Update relationships - relation_id references
    // Update relationships where secondary person is the "to" person
    const { error: rel2Error } = await supabase
      .from("relationships")
      .update({ relation_id: primaryPersonId })
      .eq("relation_id", secondaryPersonId);

    if (rel2Error) {
      console.error("Error updating relationships (relation_id):", rel2Error);
      throw new Error(`Failed to update relationship references: ${rel2Error.message}`);
    }

    // Step 3: Update roster entries
    const { error: rosterError } = await supabase
      .from("rosters")
      .update({ person_id: primaryPersonId })
      .eq("person_id", secondaryPersonId);

    if (rosterError) {
      console.error("Error updating rosters:", rosterError);
      throw new Error(`Failed to update roster entries: ${rosterError.message}`);
    }

    // Step 4: Update list_people entries
    // First, check if primary person is already in any of the same lists
    const { data: secondaryLists } = await supabase
      .from("list_people")
      .select("list_id")
      .eq("person_id", secondaryPersonId);

    const { data: primaryLists } = await supabase
      .from("list_people")
      .select("list_id")
      .eq("person_id", primaryPersonId);

    const primaryListIds = new Set(primaryLists?.map((l) => l.list_id) || []);
    const listsToUpdate = secondaryLists?.filter(
      (l) => !primaryListIds.has(l.list_id)
    );

    // Update list memberships that won't conflict
    if (listsToUpdate && listsToUpdate.length > 0) {
      const { error: listError } = await supabase
        .from("list_people")
        .update({ person_id: primaryPersonId })
        .eq("person_id", secondaryPersonId)
        .in("list_id", listsToUpdate.map((l) => l.list_id));

      if (listError) {
        console.error("Error updating list_people:", listError);
        throw new Error(`Failed to update list memberships: ${listError.message}`);
      }
    }

    // Delete conflicting list memberships (where both are in same list)
    const { error: deleteListError } = await supabase
      .from("list_people")
      .delete()
      .eq("person_id", secondaryPersonId);

    if (deleteListError) {
      console.error("Error deleting duplicate list memberships:", deleteListError);
      // Don't throw here, continue with merge
    }

    // Step 5: Update emails - recipient_id is set to null on delete, so update them
    const { error: emailError } = await supabase
      .from("emails")
      .update({ recipient_id: primaryPersonId })
      .eq("recipient_id", secondaryPersonId);

    if (emailError) {
      console.error("Error updating emails:", emailError);
      throw new Error(`Failed to update email history: ${emailError.message}`);
    }

    // Step 6: Update invoices - find invoices through rosters
    // Get all rosters for secondary person (which should now be updated to primary)
    // Invoices are linked via roster_id, so they should automatically follow

    // Step 7: Update payments - person_id references
    const { error: paymentError } = await supabase
      .from("payments")
      .update({ person_id: primaryPersonId })
      .eq("person_id", secondaryPersonId);

    if (paymentError) {
      console.error("Error updating payments:", paymentError);
      throw new Error(`Failed to update payment history: ${paymentError.message}`);
    }

    // Step 8: Update staff entries if they exist
    const { error: staffError } = await supabase
      .from("staff")
      .update({ person_id: primaryPersonId })
      .eq("person_id", secondaryPersonId);

    if (staffError && staffError.code !== "42P01") {
      // 42P01 = table doesn't exist
      console.error("Error updating staff:", staffError);
      throw new Error(`Failed to update staff entries: ${staffError.message}`);
    }

    // Step 9: Update the primary person with merged data
    const { error: updateError } = await supabase
      .from("people")
      .update(mergedData)
      .eq("id", primaryPersonId);

    if (updateError) {
      console.error("Error updating primary person:", updateError);
      throw new Error(`Failed to update merged data: ${updateError.message}`);
    }

    // Step 10: Delete the secondary person
    const { error: deleteError } = await supabase
      .from("people")
      .delete()
      .eq("id", secondaryPersonId);

    if (deleteError) {
      console.error("Error deleting secondary person:", deleteError);
      throw new Error(`Failed to delete secondary person: ${deleteError.message}`);
    }

    console.log("Merge completed successfully");

    return NextResponse.json({
      success: true,
      message: "People merged successfully",
      primaryPersonId,
    });
  } catch (error) {
    console.error("Merge error:", error);
    return NextResponse.json(
      {
        error: "Failed to merge people",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


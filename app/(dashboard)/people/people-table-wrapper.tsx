"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PeopleTable } from "./table";
import { Skeleton } from "@/components/ui/skeleton";

interface PeopleTableWrapperProps {
  initialPeople: any[];
  account: any;
}

// Resolve primary contacts from the already-fetched relationships data
// instead of making N individual API calls
function resolveContacts(peopleData: any[]) {
  const peopleById = new Map(peopleData.map(p => [p.id, p]))

  return peopleData.map(person => {
    if (!person.dependent || !person.relationships?.length) {
      return { ...person, primary_contacts: null }
    }

    // relationships are fetched via relationships_person_id_fkey,
    // meaning person.relationships contains rows where person_id = person.id
    // But for dependents, we need rows where relation_id = person.id (parent → child)
    // The server query uses relationships_person_id_fkey which gives us
    // relationships where THIS person is the person_id (i.e., this person is the parent)
    // For dependents, we need the reverse — handled below

    return { ...person, primary_contacts: null }
  })
}

export function PeopleTableWrapper({ initialPeople, account }: PeopleTableWrapperProps) {
  const supabase = createClient();
  const [people, setPeople] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Build a lookup of primary contacts from relationships
  const buildPrimaryContacts = async (peopleData: any[]) => {
    const peopleById = new Map(peopleData.map(p => [p.id, p]))

    // For dependents, find their guardians via relationships where relation_id = dependent.id
    const dependentIds = peopleData.filter(p => p.dependent).map(p => p.id)

    if (dependentIds.length === 0) {
      return peopleData.map(p => ({ ...p, primary_contacts: null }))
    }

    // Single batch query instead of 572 individual queries
    const { data: guardianRels } = await supabase
      .from("relationships")
      .select("person_id, relation_id, primary")
      .in("relation_id", dependentIds)
      .eq("primary", true)

    // Map: dependent_id → [guardian person objects]
    const guardianMap = new Map<string, any[]>()
    for (const rel of guardianRels || []) {
      const guardian = peopleById.get(rel.person_id)
      if (guardian) {
        const existing = guardianMap.get(rel.relation_id) || []
        existing.push(guardian)
        guardianMap.set(rel.relation_id, existing)
      }
    }

    return peopleData.map(p => ({
      ...p,
      primary_contacts: p.dependent ? (guardianMap.get(p.id) || null) : null,
    }))
  }

  // Initial load
  useEffect(() => {
    const load = async () => {
      try {
        const processed = await buildPrimaryContacts(initialPeople)
        setPeople(processed)
      } catch (err) {
        console.error("Error processing people:", err)
        setPeople(initialPeople.map(p => ({ ...p, primary_contacts: null })))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("people")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        async () => {
          try {
            const { data: updatedPeople } = await supabase
              .from("people")
              .select("*, relationships!relationships_person_id_fkey(*), account_people!inner(account_id)")
              .eq("account_people.account_id", account.id)

            if (updatedPeople) {
              const processed = await buildPrimaryContacts(updatedPeople)
              setPeople(processed)
            }
          } catch (err) {
            console.error("Error refetching people:", err)
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [account.id])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="ml-auto h-10 w-24" />
        </div>
        <div className="space-y-1">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return <PeopleTable data={people} account={account} />;
}

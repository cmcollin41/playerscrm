"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PeopleTable } from "./table";
import { getPrimaryContacts } from "@/lib/fetchers/client";
import { Skeleton } from "@/components/ui/skeleton";

interface PeopleTableWrapperProps {
  initialPeople: any[];
  account: any;
}

export function PeopleTableWrapper({ initialPeople, account }: PeopleTableWrapperProps) {
  const supabase = createClient();
  const [people, setPeople] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Process people with primary contacts
  const processPeople = async (peopleData: any[]) => {
    const peopleWithPrimaryEmailPromises = peopleData.map(async (person) => {
      const primaryPeople = await getPrimaryContacts(person);
      return {
        ...person,
        primary_contacts: primaryPeople,
      };
    });
    return await Promise.all(peopleWithPrimaryEmailPromises);
  };

  // Initial load with server data
  useEffect(() => {
    const loadInitialData = async () => {
      const processed = await processPeople(initialPeople);
      setPeople(processed);
      setIsLoading(false);
    };
    loadInitialData();
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("people")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "people",
        },
        async () => {
          // Refetch people on changes
          const { data: updatedPeople } = await supabase
            .from("people")
            .select("*, relationships!relationships_person_id_fkey(*)")
            .eq("account_id", account.id);

          if (updatedPeople) {
            const processed = await processPeople(updatedPeople);
            setPeople(processed);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account.id]);

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
    );
  }

  return <PeopleTable data={people} account={account} />;
}


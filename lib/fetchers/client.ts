import { createClient } from "@/lib/supabase/client"
import { getDomainQuery } from "../utils";


export async function getAccountWithDomain(domain: string) {
  const supabase = createClient();

  const [domainKey, domainValue] = getDomainQuery(domain);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    let account;
    if (user?.id) {
      // Use getAccount() which respects current_account_id
      account = await getAccount();
    } else if (domain) {
      const { data: site, error: siteError } = await supabase
        .from("sites")
        .select("*, accounts(*)")
        .eq(domainKey, domainValue)
        .single();

      if (siteError) throw siteError;
      account = site?.accounts;
      
      // Fetch senders for this account
      if (account?.id) {
        const { data: senders, error: sendersError } = await supabase
          .from("senders")
          .select("*")
          .eq("account_id", account.id);
        
        if (!sendersError && senders) {
          account.senders = senders;
        }
      }
    }

    return account;
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}

export async function getAccount() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_account_id, account_id")
      .eq("id", user?.id)
      .single();

    if (profileError) throw profileError;

    const accountId = profile.current_account_id || profile.account_id;
    if (!accountId) throw new Error("No account found");

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accountError) throw accountError;

    const { data: senders, error: sendersError } = await supabase
      .from("senders")
      .select("*")
      .eq("account_id", account.id);

    if (!sendersError && senders) {
      account.senders = senders;
    }

    return account;
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}

export async function getSiteId(domain: string) {
  const supabase = createClient();

  console.log("public root domain", process.env.NEXT_PUBLIC_ROOT_DOMAIN);

  const [domainKey, domainValue] = getDomainQuery(domain);
  console.log(domainKey, domainValue);

  const { data } = await supabase
    .from("sites")
    .select("id")
    .eq(domainKey, domainValue)
    .single();

  return data?.id || "";
}

export async function getSiteData(domain: any) {
  const supabase = createClient();

  const [domainKey, domainValue] = getDomainQuery(domain);
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq(domainKey, domainValue)
    .single();

  return data;
}



export async function getPrimaryContact(person: any) {
  const supabase = createClient(); // replace with your Supabase client

  if (person.dependent) {
    try {
      // Fetch the primary relationship
      const { data: relationship, error: relationshipError } = await supabase
        .from("relationships")
        .select("*")
        .eq("relation_id", person.id)
        .eq("primary", true)
        .single();

      if (relationshipError) {
        console.error(relationshipError);
        return null;
      }

      // Fetch the primary person
      const { data: primaryPerson, error: primaryPersonError } = await supabase
        .from("people")
        .select("*")
        .eq("id", relationship.person_id)
        .single();

      if (primaryPersonError) {
        console.error(primaryPersonError);
        return null;
      }

      // Return the primary person
      return primaryPerson;
    } catch (error) {
      console.error("Error fetching primary contact:", error);
      return null;
    }
  } else {
    // If the person is not a dependent, return the person itself
    return person;
  }
}

export async function getPrimaryContacts(person: any) {
  const supabase = createClient();

  if (person?.dependent) {
    try {
      // Fetch the primary relationships
      const { data: relationships, error: relationshipError } = await supabase
        .from("relationships")
        .select("*")
        .eq("relation_id", person.id)
        .eq("primary", true);

      if (relationshipError) {
        console.error(relationshipError);
        return null;
      }

      // Fetch the primary persons
      const primaryPersons = await Promise.all(
        relationships.map(async (relationship: any) => {
          const { data: primaryPerson, error: primaryPersonError } =
            await supabase
              .from("people")
              .select("*")
              .eq("id", relationship.person_id)
              .single();

          if (primaryPersonError) {
            console.error(primaryPersonError);
            return null;
          }

          return primaryPerson;
        }),
      );

      // Filter out any null values (in case of errors)
      return primaryPersons.filter((person) => person !== null);
    } catch (error) {
      console.error("Error fetching primary contacts:", error);
      return null;
    }
  } else {
    // If the person is not a dependent, return the person itself in an array
    return [person];
  }
}

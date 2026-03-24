import { createClient } from "@/lib/supabase/server";
import { getDomainQuery } from "../utils";
import type { UserRole } from "@/types/schema.types";

export async function getAccount() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_account_id, account_id")
      .eq("id", user?.id)
      .single();

    if (profileError) {
      console.error("getAccount: profile error", profileError);
      throw profileError;
    }

    const accountId = profile.current_account_id || profile.account_id;
    if (!accountId) {
      console.error("getAccount: no accountId", { profile });
      throw new Error("No account found");
    }

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accountError) {
      console.error("getAccount: account error", accountError, { accountId });
      throw accountError;
    }

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

export async function getAccountWithProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { account: null, profile: null }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    const accountId = profile.current_account_id || profile.account_id;

    let account = null;
    if (accountId) {
      const { data: acc, error: accountError } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .single();

      if (!accountError && acc) {
        const { data: senders, error: sendersError } = await supabase
          .from("senders")
          .select("*")
          .eq("account_id", acc.id);

        if (!sendersError && senders) {
          acc.senders = senders;
        }
        account = acc;
      }
    }

    return {
      account,
      profile: {
        id: profile.id,
        role: profile.role as UserRole,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        account_id: accountId,
      },
    };
  } catch (error: any) {
    return { account: null, profile: null, error: error.message };
  }
}


export async function getSiteData(domain: string) {
  const supabase = await createClient();

  const [domainKey, domainValue] = getDomainQuery(domain);

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq(domainKey, domainValue)
    .single();

  return data;
}

export async function getAccountId(domain: string) {
  const supabase = await createClient();

  const [domainKey, domainValue] = getDomainQuery(domain);

  const { data, error } = await supabase
    .from("sites")
    .select("account_id")
    .eq(domainKey, domainValue)
    .single();

  if (error) console.log("ERROR IN THE getAccountId FETCHER", error);

  if (data) {
    console.log("DATA FROM GET ACCOUNT ID", data);
  }
  return data?.account_id;
}

export async function getSiteTheme(domain: string) {
  const supabase = await createClient();

  const [domainKey, domainValue] = getDomainQuery(domain);

  try {
    const { data } = await supabase
      .from("sites")
      .select("theme")
      .eq(domainKey, domainValue)
      .single();

    return data?.theme;
  } catch (error) {
    console.log("ERROR IN THE getSiteTheme FETCHER", error);
    return {};
  }
}


export async function getPageDataBySiteAndSlug(site_id: string, slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .eq("site_id", site_id)
    .single();

  if (error) {
    console.log("ERROR IN getPageDataBySiteAndSlug FETCHER");
    return;
  }

  return data;
}

export async function getPrimaryContact(person: any) {
  const supabase = await createClient();

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
  const supabase = await createClient();

  if (person.dependent) {
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

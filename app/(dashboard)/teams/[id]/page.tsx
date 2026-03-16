"use client";

import { createClient } from "@/lib/supabase/client";

import { TeamTable } from "./table";

import GenericButton from "@/components/modal-buttons/generic-button";
import EditTeamModal from "@/components/modal/edit-team-modal";
import { useEffect, useState, use } from "react";
import { AddToStaffModal } from "@/components/modal/add-to-staff-modal";
import { EditStaffModal } from "@/components/modal/edit-staff-modal";
import { AddToRosterModal } from "@/components/modal/add-to-roster-modal";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, CheckCircle, AlertCircle, X, Trophy, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LEVEL_LABELS: Record<string, string> = {
  bantam: "Bantam",
  club: "Club",
  freshman: "Freshman",
  sophomore: "Sophomore",
  jv: "JV",
  varsity: "Varsity",
}

async function getPrimaryContacts(supabase: any, person: any) {
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

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params Promise
  const { id } = use(params);
  
  const supabase = createClient();

  const [account, setAccount] = useState<any>({});
  const [user, setUser] = useState<any>({});
  const [team, setTeam] = useState<any>({});

  const [peopleWithPrimaryEmail, setPeopleWithPrimaryEmail] = useState<any>([]);

  // Fetch team data function (extracted so we can call it from callbacks)
  const fetchTeam = async () => {
    if (!id) return;
    
    const { data: team, error } = await supabase
      .from("teams")
      .select(`
        *,
        accounts(id, stripe_id),
        rosters(
          *, 
          people(
            *,
            invoices(*)
          ), 
          fees(*, payments(*))
        ),
        staff(*, people(*)),
        team_awards(*)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error('Error fetching team:', error);
      return;
    }
    console.log('Team data fetched:', {
      name: team?.name,
      rostersCount: team?.rosters?.length,
      staffCount: team?.staff?.length,
      rosters: team?.rosters
    });
    setTeam(team);
  }

  const removeStaff = async (staffId: string) => {
    const { error } = await supabase.from("staff").delete().eq("id", staffId)
    if (error) {
      toast.error("Failed to remove staff member")
      return
    }
    toast.success("Staff member removed")
    fetchTeam()
  }

  const [editStaffOpen, setEditStaffOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<{ id: string; personName: string; photo: string | null } | null>(null)

  const openEditStaff = (staffMember: any) => {
    setEditingStaff({
      id: staffMember.id,
      personName: staffMember.people?.name || "Staff",
      photo: staffMember.photo ?? null,
    })
    setEditStaffOpen(true)
  }

  const removeAward = async (awardId: string) => {
    const { error } = await supabase.from("team_awards").delete().eq("id", awardId)
    if (error) {
      toast.error("Failed to remove award")
      return
    }
    toast.success("Award removed")
    fetchTeam()
  }

  useEffect(() => {
    if (!id) return;
    
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
    };
    fetchUser();

    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!user?.id) return;
    
    const fetchAccount = async () => {
      // First get the profile with account
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*, accounts(*)")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      
      // Then fetch senders for this account
      if (profile.accounts?.id) {
        const { data: senders, error: sendersError } = await supabase
          .from("senders")
          .select("*")
          .eq("account_id", profile.accounts.id);
        
        if (!sendersError && senders) {
          profile.accounts.senders = senders;
        }
      }
      
      setAccount(profile.accounts);
    };

    fetchAccount();
  }, [user, supabase]);

  useEffect(() => {
    if (!team?.rosters || team.rosters.length === 0) {
      console.log('No rosters found or team not loaded yet', { team: !!team, rosters: team?.rosters?.length });
      setPeopleWithPrimaryEmail([]);
      return;
    }
    
    const getPrimaryEmail = async () => {
      console.log('Processing rosters:', team.rosters.length);
      try {
        const peopleWithPrimaryEmailPromises = team.rosters.map(
          async (r: any) => {
            const primaryPeople = await getPrimaryContacts(supabase, r.people);
            return {
              ...r.people,
              primary_contacts: primaryPeople,
              jersey_number: r.jersey_number,
              position: r.position,
              roster_grade: r.grade,
              fees: r.fees || {
                id: "",
                name: "",
                description: "",
                amount: null,
                type: "",
              },
            };
          },
        );

        const peopleWithPrimaryEmails = await Promise.all(
          peopleWithPrimaryEmailPromises,
        );
        console.log('Processed people:', peopleWithPrimaryEmails.length);
        setPeopleWithPrimaryEmail(peopleWithPrimaryEmails);
      } catch (error) {
        console.error('Error processing rosters:', error);
      }
    };

    getPrimaryEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id, team?.rosters?.length]);

  // Calculate team statistics
  const stats = {
    totalPlayers: team?.rosters?.length || 0,
    staffCount: team?.staff?.length || 0,
    totalFees: team?.rosters?.reduce((sum: number, roster: any) => {
      return sum + (roster.fees?.amount || 0);
    }, 0) || 0,
    paidFees: team?.rosters?.reduce((sum: number, roster: any) => {
      const hasPaidPayment = roster.fees?.payments?.some(
        (payment: any) => 
          payment.person_id === roster.person_id && 
          payment.status === "succeeded"
      );
      return sum + (hasPaidPayment ? (roster.fees?.amount || 0) : 0);
    }, 0) || 0,
    playersWithFees: team?.rosters?.filter((r: any) => r.fees?.amount).length || 0,
    paidPlayers: team?.rosters?.filter((roster: any) => {
      return roster.fees?.payments?.some(
        (payment: any) => 
          payment.person_id === roster.person_id && 
          payment.status === "succeeded"
      );
    }).length || 0,
  };

  const outstandingFees = stats.totalFees - stats.paidFees;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              {team?.icon && <AvatarImage src={team.icon} alt={team?.name} />}
              <AvatarFallback className="text-lg font-semibold">
                {team?.name ? team.name.substring(0, 2).toUpperCase() : "T"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{team?.name}</h1>
                {team?.level && (
                  <Badge variant="outline" className="capitalize text-sm">
                    {LEVEL_LABELS[team.level] || team.level}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Manage your team roster, fees, and invoices
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AddToRosterModal 
              team={team} 
              accountId={account?.id}
              onSuccess={fetchTeam}
            />
            <AddToStaffModal
              team={team}
              accountId={account?.id ?? ""}
              onSuccess={fetchTeam}
            />
            {editingStaff && (
              <EditStaffModal
                open={editStaffOpen}
                onOpenChange={(open) => {
                  setEditStaffOpen(open)
                  if (!open) setEditingStaff(null)
                }}
                staffId={editingStaff.id}
                personName={editingStaff.personName}
                currentPhoto={editingStaff.photo}
                accountId={account?.id ?? ""}
                onRefresh={fetchTeam}
              />
            )}
            <GenericButton
              cta="Edit Team"
              size={undefined}
              variant={undefined}
              classNames=""
            >
              <EditTeamModal team={team} onRefresh={fetchTeam} />
            </GenericButton>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlayers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.playersWithFees} with fees assigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all roster members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Collected</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.paidFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.paidPlayers} of {stats.playersWithFees} players paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              ${outstandingFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.playersWithFees - stats.paidPlayers} players pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Staff Section */}
      {team?.staff && team.staff.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {team.staff.map((staffMember: any, index: number) => (
                <div
                  key={index}
                  className="group relative flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 transition-colors hover:bg-gray-100 hover:border-gray-300"
                >
                  <Link
                    href={`/people/${staffMember.people?.id}`}
                    className="flex items-center gap-2"
                  >
                    <Avatar className="h-8 w-8">
                      {(staffMember.photo || staffMember.people?.photo) && (
                        <AvatarImage src={staffMember.photo || staffMember.people?.photo} alt={staffMember.people?.name} />
                      )}
                      <AvatarFallback className="text-xs">
                        {getInitials(
                          staffMember.people?.first_name,
                          staffMember.people?.last_name,
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{staffMember.people.name}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEditStaff(staffMember)}
                    className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStaff(staffMember.id)}
                    className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Awards Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Awards
          </CardTitle>
        </CardHeader>
        <CardContent>
          {team?.team_awards && team.team_awards.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {team.team_awards.map((award: any) => (
                <div
                  key={award.id}
                  className="group flex items-center gap-1.5 rounded-full border bg-yellow-50 px-3 py-1.5 text-sm"
                >
                  <Trophy className="h-3.5 w-3.5 text-yellow-600" />
                  <span className="font-medium">{award.title}</span>
                  <button
                    type="button"
                    onClick={() => removeAward(award.id)}
                    className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No awards yet</p>
          )}
        </CardContent>
      </Card>

      {/* Roster Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster ({stats.totalPlayers})</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamTable
            data={peopleWithPrimaryEmail}
            team={team}
            account={account}
            onRefresh={fetchTeam}
          />
        </CardContent>
      </Card>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client"
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { getAccount } from "@/lib/fetchers/client";
import { useModal } from "./provider";
import { toast } from 'sonner'
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface Team {
  id: number;
  name: string;
}

interface Fee {
  id: number;
  name: string;
}

export default function AddToTeamModal({
  people,
  onClose,
}: {
  people: any;
  onClose: any;
}) {
  const { refresh } = useRouter();
  const modal = useModal();

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();

  const [teams, setTeams] = useState<Team[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedFee, setSelectedFee] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchAccount = async () => {
      const account = await getAccount();
      return account;
    };

    async function fetchTeams({ account }: { account: any }) {
      const { data: teams, error } = await supabase
        .from("teams")
        .select("*")
        .eq("is_active", true)
        .eq("account_id", account?.id);
      if (error) {
        console.log("ERROR: ", error);
      } else {
        setTeams(teams);
        if (teams && teams[0]) {
          setSelectedTeam(teams[0].id.toString());
          setValue("team", teams[0].id);
        }
      }
    }

    async function fetchFees({ account }: { account: any }) {
      const { data: fees, error } = await supabase
        .from("fees")
        .select("*")
        .eq("is_active", true)
        .eq("account_id", account?.id);
      if (error) {
        console.log("ERROR: ", error);
      } else {
        setFees(fees || []);
        setSelectedFee(undefined);
        setValue("fee", undefined);
      }
    }

    const account = fetchAccount();

    account.then((acc) => {
      fetchTeams({ account: acc });
      fetchFees({ account: acc });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const promises = people.map(async (person: any) => {
        // Only include fee_id if a fee was selected (not empty string)
        const rosterData: any = {
          team_id: data.team || selectedTeam,
          person_id: person.id,
        }
        
        // Add fee_id only if a fee was selected
        const feeValue = data.fee || selectedFee;
        if (feeValue && feeValue !== "none") {
          rosterData.fee_id = feeValue;
        }
        
        const { error } = await supabase.from("rosters").insert([rosterData])
        
        if (error) throw error
        return person
      })

      await Promise.all(promises)
      
      toast.success(
        `Successfully added ${people.length} ${people.length === 1 ? 'person' : 'people'} to team`,
      )

      modal?.hide()
      onClose()
      refresh()
    } catch (error: any) {
      console.error("FORM ERRORS: ", error)
      toast.error(error.message || 'Failed to add to team')
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6">
      <DialogHeader>
        <DialogTitle>Add to Team</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="team">Team</Label>
          <Select
            value={selectedTeam}
            onValueChange={(value) => {
              setSelectedTeam(value);
              setValue("team", value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team: any) => (
                <SelectItem key={team.id} value={team.id.toString()}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.team && (
            <p className="text-sm text-red-500">Team is required</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fee">Fee (Optional)</Label>
          <Select
            value={selectedFee}
            onValueChange={(value) => {
              setSelectedFee(value === "none" ? undefined : value);
              setValue("fee", value === "none" ? undefined : value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="No fee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Fee</SelectItem>
              {fees.map((fee: any) => (
                <SelectItem key={fee.id} value={fee.id.toString()}>
                  {fee.name} - ${fee.amount}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => modal?.hide()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add to Team
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}

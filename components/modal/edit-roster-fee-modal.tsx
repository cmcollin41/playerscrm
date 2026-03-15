"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getAccount } from "@/lib/fetchers/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Trophy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GRADE_OPTIONS = [
  ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
  "Graduated",
] as const

interface Fee {
  id: string;
  name: string;
  amount: number;
}

interface EditRosterFeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rosterId: string;
  currentFeeId: string | null;
  currentJerseyNumber?: number | null;
  currentPosition?: string | null;
  currentGrade?: string | null;
  currentBio?: string | null;
  personId: string;
  currentHeight?: string | null;
  personName: string;
  onRefresh?: () => void | Promise<void>;
}

export default function EditRosterFeeModal({
  open,
  onOpenChange,
  rosterId,
  currentFeeId,
  currentJerseyNumber,
  currentPosition,
  currentGrade,
  currentBio,
  personId,
  currentHeight,
  personName,
  onRefresh,
}: EditRosterFeeModalProps) {
  const { refresh } = useRouter();
  const supabase = createClient();
  const [fees, setFees] = useState<Fee[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState<string | undefined>(undefined);
  const [jerseyNumber, setJerseyNumber] = useState<string>("");
  const [position, setPosition] = useState<string>("");
  const [grade, setGrade] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [awards, setAwards] = useState<{ id: string; title: string }[]>([]);
  const [newAwardTitle, setNewAwardTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchFees = async () => {
      const account = await getAccount();
      
      const { data: fees, error } = await supabase
        .from("fees")
        .select("*")
        .eq("is_active", true)
        .eq("account_id", account?.id);

      if (error) {
        console.error("Error fetching fees:", error);
      } else {
        setFees(fees || []);
      }
    };

    if (open) {
      fetchFees();
      setSelectedFeeId(currentFeeId || undefined);
      setJerseyNumber(currentJerseyNumber != null ? String(currentJerseyNumber) : "");
      setPosition(currentPosition || "");
      setGrade(currentGrade || "");
      setBio(currentBio || "");
      setHeight(currentHeight || "");

      if (personId) {
        supabase
          .from("person_awards")
          .select("id, title")
          .eq("person_id", personId)
          .then(({ data }) => setAwards(data ?? []));
      }
    }
  }, [open, currentFeeId, currentJerseyNumber, currentPosition, currentGrade, currentBio, currentHeight, personId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updateData: Record<string, unknown> = {};
      
      if (!selectedFeeId || selectedFeeId === "none") {
        updateData.fee_id = null;
      } else {
        updateData.fee_id = selectedFeeId;
      }

      updateData.jersey_number = jerseyNumber ? Number(jerseyNumber) : null;
      updateData.position = position && position !== "none_clear" ? position : null;
      updateData.grade = grade && grade !== "none_clear" ? grade : null;
      updateData.bio = bio || null;
      updateData.height = height || null;

      const { error } = await supabase
        .from("rosters")
        .update(updateData)
        .eq("id", rosterId);

      if (error) throw error;

      toast.success("Roster entry updated");
      onOpenChange(false);
      if (onRefresh) {
        onRefresh();
      } else {
        refresh();
      }
    } catch (error: any) {
      console.error("Error updating roster:", error);
      toast.error(error.message || "Failed to update roster entry");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Roster — {personName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jersey_number">Jersey #</Label>
              <Input
                id="jersey_number"
                type="number"
                min={0}
                max={99}
                placeholder="e.g. 23"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger id="position">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none_clear">None</SelectItem>
                  <SelectItem value="PG">PG</SelectItem>
                  <SelectItem value="SG">SG</SelectItem>
                  <SelectItem value="SF">SF</SelectItem>
                  <SelectItem value="PF">PF</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger id="grade">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none_clear">None</SelectItem>
                  {GRADE_OPTIONS.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="height">Height</Label>
            <Input
              id="height"
              placeholder={`e.g. 6'2"`}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Awards</Label>
            {awards.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {awards.map((award) => (
                  <Badge key={award.id} variant="secondary" className="gap-1 pr-1">
                    <Trophy className="h-3 w-3 text-yellow-600" />
                    {award.title}
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.from("person_awards").delete().eq("id", award.id);
                        setAwards((prev) => prev.filter((a) => a.id !== award.id));
                      }}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-red-100 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Award title (e.g. All-State)"
                value={newAwardTitle}
                onChange={(e) => setNewAwardTitle(e.target.value)}
                className="flex-1"
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newAwardTitle.trim() || !personId) return;
                    const { data, error } = await supabase
                      .from("person_awards")
                      .insert({ person_id: personId, title: newAwardTitle.trim() })
                      .select("id, title")
                      .single();
                    if (!error && data) {
                      setAwards((prev) => [data, ...prev]);
                      setNewAwardTitle("");
                    }
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!newAwardTitle.trim()}
                onClick={async () => {
                  if (!newAwardTitle.trim() || !personId) return;
                  const { data, error } = await supabase
                    .from("person_awards")
                    .insert({ person_id: personId, title: newAwardTitle.trim() })
                    .select("id, title")
                    .single();
                  if (!error && data) {
                    setAwards((prev) => [data, ...prev]);
                    setNewAwardTitle("");
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fee">Fee</Label>
            <Select
              value={selectedFeeId || "none"}
              onValueChange={(value) => setSelectedFeeId(value === "none" ? undefined : value)}
            >
              <SelectTrigger id="fee">
                <SelectValue placeholder="No fee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Fee</SelectItem>
                {fees.map((fee) => (
                  <SelectItem key={fee.id} value={fee.id}>
                    {fee.name} - ${fee.amount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Season Bio</Label>
            <Textarea
              id="bio"
              placeholder="Write a season-specific bio for this player..."
              className="resize-none"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { ImageDropzone } from "@/components/ui/image-dropzone";
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
  currentPhoto?: string | null;
  accountId: string;
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
  currentPhoto,
  accountId,
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
  const [awards, setAwards] = useState<{ id: string; title: string; award_type_id?: string }[]>([]);
  const [newAwardTitle, setNewAwardTitle] = useState("");
  const [awardTypes, setAwardTypes] = useState<{ id: string; name: string; slug: string; category: string }[]>([]);
  const [photo, setPhoto] = useState<string>("");
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
      setPhoto(currentPhoto || "");

      if (rosterId) {
        supabase
          .from("roster_awards")
          .select("id, title, award_type_id")
          .eq("roster_id", rosterId)
          .then(({ data }) => setAwards(data ?? []));
      }

      // Fetch award types
      getAccount().then((account) => {
        if (account?.id) {
          supabase
            .from("award_types")
            .select("id, name, slug, category")
            .eq("account_id", account.id)
            .order("sort_order", { ascending: true })
            .then(({ data }) => setAwardTypes(data ?? []));
        }
      });
    }
  }, [open, currentFeeId, currentJerseyNumber, currentPosition, currentGrade, currentBio, currentHeight, currentPhoto, rosterId, supabase]);

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
      updateData.photo = photo || null;

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

          <div className="space-y-1">
            <ImageDropzone
              value={photo || null}
              onChange={(url) => setPhoto(url || "")}
              onFileSelect={async (file) => {
                const ext = file.name.split(".").pop();
                const fileName = `rosters/${accountId}/${crypto.randomUUID()}.${ext}`;
                const { data, error } = await supabase.storage
                  .from("headshots")
                  .upload(fileName, file, { upsert: true });
                if (error) throw error;
                const { data: urlData } = supabase.storage.from("headshots").getPublicUrl(data.path);
                toast.success("Image uploaded");
                return urlData.publicUrl;
              }}
              onError={(msg) => toast.error(msg)}
              placeholder="Drop image or click to upload"
            />
            <p className="text-xs text-muted-foreground">Overrides person photo for this roster</p>
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
                        await supabase.from("roster_awards").delete().eq("id", award.id);
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
            {awardTypes.length > 0 && (
              <Select
                onValueChange={async (value) => {
                  const type = awardTypes.find((t) => t.id === value);
                  if (!type || !rosterId) return;
                  if (awards.some((a) => a.award_type_id === type.id)) return;
                  const { data, error } = await supabase
                    .from("roster_awards")
                    .insert({ roster_id: rosterId, title: type.name, award_type_id: type.id })
                    .select("id, title, award_type_id")
                    .single();
                  if (!error && data) {
                    setAwards((prev) => [data, ...prev]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an award..." />
                </SelectTrigger>
                <SelectContent>
                  {awardTypes
                    .filter((t) => !awards.some((a) => a.award_type_id === t.id))
                    .map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Custom award title"
                value={newAwardTitle}
                onChange={(e) => setNewAwardTitle(e.target.value)}
                className="flex-1"
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newAwardTitle.trim() || !rosterId) return;
                    const { data, error } = await supabase
                      .from("roster_awards")
                      .insert({ roster_id: rosterId, title: newAwardTitle.trim() })
                      .select("id, title, award_type_id")
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
                  if (!newAwardTitle.trim() || !rosterId) return;
                  const { data, error } = await supabase
                    .from("roster_awards")
                    .insert({ roster_id: rosterId, title: newAwardTitle.trim() })
                    .select("id, title, award_type_id")
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

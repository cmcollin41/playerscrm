"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client"
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useModal } from "./provider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Camera, X, Plus, Trophy, Pencil, DollarSign } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { slugify, ensureUniqueSlug } from "@/lib/slug";

const TEAM_LEVELS = [
  { value: "bantam", label: "Bantam" },
  { value: "club", label: "Club" },
  { value: "freshman", label: "Freshman" },
  { value: "sophomore", label: "Sophomore" },
  { value: "jv", label: "JV" },
  { value: "varsity", label: "Varsity" },
] as const

interface EditTeamModalProps {
  team?: any
  onRefresh?: () => void | Promise<void>
}

export default function EditTeamModal({ team, onRefresh }: EditTeamModalProps) {
  const { refresh } = useRouter();
  const modal = useModal();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(team?.icon || null);
  const [awards, setAwards] = useState<{ id: string; title: string }[]>(team?.team_awards ?? []);
  const [newAwardTitle, setNewAwardTitle] = useState("");
  const [isAddingAward, setIsAddingAward] = useState(false);
  const [editingAwardId, setEditingAwardId] = useState<string | null>(null);
  const [editingAwardTitle, setEditingAwardTitle] = useState("");

  const supabase = useMemo(() => createClient(), []);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm();

  const isActive = watch("is_active");
  const isPublic = watch("is_public");
  const [level, setLevel] = useState(team?.level || "bantam");
  const [rosterFeeOptions, setRosterFeeOptions] = useState<
    { id: string; name: string; amount: number }[]
  >([]);
  const [defaultRosterFeeId, setDefaultRosterFeeId] = useState<string>("none");

  // Sync all state whenever the team prop changes (including after onRefresh)
  useEffect(() => {
    if (team) {
      setValue("name", team.name);
      setValue("coach", team.coach);
      setValue("is_active", team.is_active);
      setValue("is_public", team.is_public ?? false);
      setLevel(team.level || "bantam");
      setImagePreview(team.icon || null);
      setAwards(team.team_awards ?? []);
    } else {
      setValue("is_active", true);
      setValue("is_public", false);
      setAwards([]);
    }
  }, [team, setValue]);

  // Load fee options and then set the default fee ID (must happen after options load)
  useEffect(() => {
    if (!team?.account_id) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("fees")
        .select("id, name, amount")
        .eq("account_id", team.account_id)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (cancelled) return;
      setRosterFeeOptions(data ?? []);
      setDefaultRosterFeeId(team.fee_id ? String(team.fee_id) : "none");
    })();
    return () => { cancelled = true };
  }, [team?.account_id, team?.fee_id, team?.id, supabase]);

  const addAward = async () => {
    if (!team?.id || !newAwardTitle.trim()) return;
    setIsAddingAward(true);
    const { data, error } = await supabase
      .from("team_awards")
      .insert({ team_id: team.id, title: newAwardTitle.trim() })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add award");
    } else {
      setAwards((prev) => [...prev, { id: data.id, title: data.title }]);
      setNewAwardTitle("");
      toast.success("Award added");
      onRefresh?.();
    }
    setIsAddingAward(false);
  };

  const removeAward = async (awardId: string) => {
    const { error } = await supabase.from("team_awards").delete().eq("id", awardId);
    if (error) {
      toast.error("Failed to remove award");
      return;
    }
    setAwards((prev) => prev.filter((a) => a.id !== awardId));
    setEditingAwardId(null);
    toast.success("Award removed");
    onRefresh?.();
  };

  const startEditAward = (award: { id: string; title: string }) => {
    setEditingAwardId(award.id);
    setEditingAwardTitle(award.title);
  };

  const saveEditAward = async () => {
    if (!editingAwardId || !editingAwardTitle.trim()) return;
    const { error } = await supabase
      .from("team_awards")
      .update({ title: editingAwardTitle.trim() })
      .eq("id", editingAwardId);
    if (error) {
      toast.error("Failed to update award");
      return;
    }
    setAwards((prev) =>
      prev.map((a) => (a.id === editingAwardId ? { ...a, title: editingAwardTitle.trim() } : a))
    );
    setEditingAwardId(null);
    setEditingAwardTitle("");
    toast.success("Award updated");
    onRefresh?.();
  };

  const cancelEditAward = () => {
    setEditingAwardId(null);
    setEditingAwardTitle("");
  };

  const handleImageUpload = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/jpeg,image/png,image/webp"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB")
        return
      }

      setIsUploadingImage(true)
      try {
        const ext = file.name.split(".").pop()
        const fileName = `teams/${team?.account_id || "new"}/${crypto.randomUUID()}.${ext}`

        const { data, error: uploadError } = await supabase.storage
          .from("headshots")
          .upload(fileName, file, { upsert: true })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from("headshots")
          .getPublicUrl(data.path)

        setImagePreview(urlData.publicUrl)
        toast.success("Image uploaded")
      } catch (err) {
        console.error("Upload error:", err)
        toast.error("Failed to upload image")
      } finally {
        setIsUploadingImage(false)
      }
    }
    input.click()
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
  }

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const baseSlug = slugify(data.name || "team");
      const { data: existing } = await supabase
        .from("teams")
        .select("id, slug")
        .eq("account_id", team?.account_id || "");
      const existingSlugs = (existing ?? [])
        .filter((t: { id: string; slug: string }) => t.id !== team?.id)
        .map((t: { slug: string }) => t.slug)
        .filter(Boolean);
      const slug = baseSlug ? ensureUniqueSlug(baseSlug, existingSlugs) : null;

      const teamData = {
        name: data.name,
        coach: data.coach,
        is_active: data.is_active,
        is_public: data.is_public,
        level,
        icon: imagePreview,
        slug,
        fee_id: defaultRosterFeeId === "none" ? null : defaultRosterFeeId,
      };

      let error;
      if (team) {
        const { error: updateError } = await supabase
          .from("teams")
          .update(teamData)
          .eq("id", team.id);
        error = updateError;
      }

      if (error) {
        toast.error("Failed to update team");
        console.error("FORM ERRORS: ", error);
      } else {
        toast.success(team ? "Team updated successfully" : "Team created successfully");
        modal?.hide();
        onRefresh?.()
        refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
      <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
        <DialogTitle>{team ? "Edit Team" : "New Team"}</DialogTitle>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-4">
        {/* Team Image */}
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Avatar className="h-16 w-16">
              {imagePreview && <AvatarImage src={imagePreview} alt={team?.name || "Team"} />}
              <AvatarFallback className="text-lg">
                {team?.name ? getInitials(team.name.split(" ")[0], team.name.split(" ")[1] || "") : "T"}
              </AvatarFallback>
            </Avatar>
            {imagePreview && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleImageUpload}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="mr-2 h-3.5 w-3.5" />
              )}
              {imagePreview ? "Change Image" : "Upload Image"}
            </Button>
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max 5MB.</p>
          </div>
        </div>

        {/* Team Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Team Name</Label>
          <Input
            id="name"
            placeholder="Enter team name"
            {...register("name", { required: true })}
          />
          {errors.name && (
            <p className="text-sm text-red-500">Team name is required</p>
          )}
        </div>

        {/* Level */}
        <div className="space-y-2">
          <Label htmlFor="level">Level</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {TEAM_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Default Roster Fee */}
        {team?.id ? (
          <div className="space-y-2">
            <Label htmlFor="default_roster_fee" className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5" />
              Default roster fee
            </Label>
            <Select key={`${defaultRosterFeeId}-${rosterFeeOptions.length}`} value={defaultRosterFeeId} onValueChange={setDefaultRosterFeeId}>
              <SelectTrigger id="default_roster_fee">
                <SelectValue placeholder="No default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — choose per player when adding</SelectItem>
                {rosterFeeOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} — ${f.amount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pre-selected when you add someone to this roster; you can still pick another fee or no fee for each player.
            </p>
          </div>
        ) : null}

        {/* Active */}
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="is_active" className="text-base">Active</Label>
            <p className="text-sm text-muted-foreground">
              Active teams appear on the main teams list
            </p>
          </div>
          <Switch
            id="is_active"
            checked={isActive}
            onCheckedChange={(checked) => setValue("is_active", checked)}
          />
        </div>

        {/* Public */}
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="is_public" className="text-base">Public Team</Label>
            <p className="text-sm text-muted-foreground">
              Show this team on your public website and API
            </p>
          </div>
          <Switch
            id="is_public"
            checked={isPublic}
            onCheckedChange={(checked) => setValue("is_public", checked)}
          />
        </div>

        {/* Awards */}
        {team?.id && (
          <div className="space-y-2">
            <Label className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Awards
            </Label>
            {awards.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {awards.map((award) =>
                  editingAwardId === award.id ? (
                    <div key={award.id} className="flex items-center gap-1.5">
                      <Input
                        value={editingAwardTitle}
                        onChange={(e) => setEditingAwardTitle(e.target.value)}
                        className="h-8 w-40"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditAward();
                          if (e.key === "Escape") cancelEditAward();
                        }}
                        autoFocus
                      />
                      <Button type="button" size="sm" variant="ghost" onClick={saveEditAward}>
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={cancelEditAward}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div
                      key={award.id}
                      className="group flex items-center gap-1.5 rounded-full border bg-yellow-50 px-3 py-1.5 text-sm"
                    >
                      <Trophy className="h-3.5 w-3.5 text-yellow-600" />
                      <span className="font-medium">{award.title}</span>
                      <button
                        type="button"
                        onClick={() => startEditAward(award)}
                        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-blue-100 hover:text-blue-600 group-hover:opacity-100"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAward(award.id)}
                        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Award title (e.g. State Champions)"
                value={newAwardTitle}
                onChange={(e) => setNewAwardTitle(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAward();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={addAward}
                disabled={!newAwardTitle.trim() || isAddingAward}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="shrink-0 border-t bg-zinc-50/90 px-6 py-4">
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
          {team ? "Update Team" : "Create Team"}
        </Button>
      </DialogFooter>
    </form>
  );
}

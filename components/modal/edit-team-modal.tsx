"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Camera, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const TEAM_LEVELS = [
  { value: "bantam", label: "Bantam" },
  { value: "club", label: "Club" },
  { value: "freshman", label: "Freshman" },
  { value: "sophomore", label: "Sophomore" },
  { value: "jv", label: "JV" },
  { value: "varsity", label: "Varsity" },
] as const

export default function EditTeamModal({ team }: { team?: any }) {
  const { refresh } = useRouter();
  const modal = useModal();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(team?.icon || null);

  const supabase = createClient();
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

  useEffect(() => {
    if (team) {
      setValue("name", team.name);
      setValue("coach", team.coach);
      setValue("is_active", team.is_active);
      setValue("is_public", team.is_public ?? false);
      setLevel(team.level || "bantam");
      setImagePreview(team.icon || null);
    } else {
      setValue("is_active", true);
      setValue("is_public", false);
    }
  }, [team, setValue]);

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
      const teamData = {
        name: data.name,
        coach: data.coach,
        is_active: data.is_active,
        is_public: data.is_public,
        level,
        icon: imagePreview,
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
        refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{team ? "Edit Team" : "New Team"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        <div className="flex items-center space-x-2">
          <Switch
            id="is_active"
            checked={isActive}
            onCheckedChange={(checked) => setValue("is_active", checked)}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>

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
            {team ? "Update Team" : "Create Team"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

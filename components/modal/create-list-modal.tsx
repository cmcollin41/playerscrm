"use client";
import { createClient } from "@/lib/supabase/client"
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useModal } from "./provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function CreateListModal({ account }: { account: any }) {
  const { refresh } = useRouter();
  const modal = useModal();
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("lists").insert([
        {
          account_id: account.id,
          name: data.name,
        },
      ]);
      if (error) {
        toast.error("Failed to create list");
        console.error("FORM ERRORS: ", error);
      } else {
        toast.success("List created successfully");
        modal?.hide();
        refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <DialogHeader>
        <DialogTitle>New List</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">List Name</Label>
          <Input
            id="name"
            placeholder="Enter list name"
            {...register("name", { required: true })}
          />
          {errors.name && (
            <p className="text-sm text-red-500">List name is required</p>
          )}
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
            Create List
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}

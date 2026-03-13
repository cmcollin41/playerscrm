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
import { Label } from "@/components/ui/label";
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
    }
  }, [open, currentFeeId, currentJerseyNumber, currentPosition, currentGrade, supabase]);

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

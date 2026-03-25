"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getAccount } from "@/lib/fetchers/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { postRosterInvoice } from "@/lib/post-roster-invoice";
import {
  effectiveRosterOwedDollars,
  linkedInvoiceForRoster,
} from "@/lib/roster-pricing";

type PricingMode = "preset" | "custom";

interface FeeRow {
  id: string;
  name: string;
  amount: number;
}

function draftRosterForPreview(
  roster: any,
  pricingMode: PricingMode,
  selectedFeeId: string | undefined,
  fees: FeeRow[],
  customAmountInput: string,
): any {
  const trim = customAmountInput.trim();
  const feeRow =
    pricingMode === "preset" && selectedFeeId
      ? fees.find((f) => f.id === selectedFeeId) ??
        (roster?.fees?.id === selectedFeeId ? roster.fees : undefined)
      : undefined;

  return {
    ...roster,
    fee_id:
      pricingMode === "preset" && selectedFeeId ? selectedFeeId : null,
    fees: pricingMode === "preset" ? feeRow ?? null : null,
    custom_amount:
      pricingMode === "custom" && trim
        ? Number.parseFloat(trim)
        : null,
  };
}

interface InvoiceLinkRow {
  id: string;
  invoice_number: string | null;
  amount: number | null;
  status: string;
  roster_id: string | null;
  metadata: Record<string, unknown> | null;
}

function parseLinkedDraftForSend(
  invoiceLinkValue: string,
  rows: InvoiceLinkRow[],
): { kind: "sendable"; id: string } | { kind: "blocked"; id: string } | null {
  if (invoiceLinkValue === "__none__") return null;
  const row = rows.find((r) => r.id === invoiceLinkValue);
  if (!row || row.status !== "draft") return null;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const stripeInvoiceId =
    typeof meta.stripe_invoice_id === "string" ? meta.stripe_invoice_id : null;
  const stripeAccountId =
    typeof meta.stripe_account_id === "string" ? meta.stripe_account_id : null;
  if (stripeInvoiceId && stripeAccountId) return { kind: "sendable", id: row.id };
  return { kind: "blocked", id: row.id };
}

export interface RosterBillingPerson {
  id: string;
  first_name: string;
  last_name: string;
  primary_contacts: any[];
}

export interface RosterBillingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rosterId: string;
  teamName: string;
  person: RosterBillingPerson;
  roster: any;
  team: any;
  account: any;
  currentFeeId: string | null;
  currentCustomAmount: number | null;
  accountId: string;
  onRefresh?: () => void | Promise<void>;
}

export function RosterBillingModal({
  open,
  onOpenChange,
  rosterId,
  teamName,
  person,
  roster,
  team,
  account,
  currentFeeId,
  currentCustomAmount,
  accountId,
  onRefresh,
}: RosterBillingModalProps) {
  const { refresh } = useRouter();
  const supabase = createClient();
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState<string | undefined>(
    undefined,
  );
  const [customAmountInput, setCustomAmountInput] = useState("");
  const [invoicesForLink, setInvoicesForLink] = useState<InvoiceLinkRow[]>([]);
  const [invoiceLinkValue, setInvoiceLinkValue] = useState("__none__");
  const [saving, setSaving] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [pricingMode, setPricingMode] = useState<PricingMode>("preset");
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [savedOwedForInvoice, setSavedOwedForInvoice] = useState<number | null>(
    null,
  );
  const [customInvoiceMemo, setCustomInvoiceMemo] = useState("");
  const billingOpenSessionRef = useRef(false);

  const personName = `${person.first_name} ${person.last_name}`;
  const defaultRosterInvoiceMemo = `Team Roster Fee - ${personName} - ${teamName}`;
  const guardianEmail = person.primary_contacts?.[0]?.email;

  useEffect(() => {
    if (!open) {
      setWizardStep(1);
      setSavedOwedForInvoice(null);
      setCustomInvoiceMemo("");
      billingOpenSessionRef.current = false;
      return;
    }

    const justOpened = !billingOpenSessionRef.current;
    billingOpenSessionRef.current = true;

    if (justOpened) {
      const fromSavedCustom =
        currentCustomAmount != null && Number(currentCustomAmount) > 0;
      if (fromSavedCustom) {
        setCustomInvoiceMemo(
          `Team Roster Fee - ${person.first_name} ${person.last_name} - ${teamName}`,
        );
      }
    }
  }, [
    open,
    currentCustomAmount,
    person.first_name,
    person.last_name,
    teamName,
  ]);

  useEffect(() => {
    if (!open || wizardStep === 2) return;

    const desiredFeeIdRaw =
      roster?.fee_id ?? roster?.fees?.id ?? currentFeeId ?? null;
    const desiredFeeId = desiredFeeIdRaw ? String(desiredFeeIdRaw) : undefined;

    const embeddedInvoice = roster ? linkedInvoiceForRoster(roster) : undefined;
    const useCustomAmount =
      currentCustomAmount != null && Number(currentCustomAmount) > 0;
    setPricingMode(useCustomAmount ? "custom" : "preset");
    setSelectedFeeId(useCustomAmount ? undefined : desiredFeeId);
    setInvoiceLinkValue(embeddedInvoice?.id ?? "__none__");
    setCustomAmountInput(
      useCustomAmount && currentCustomAmount != null
        ? String(currentCustomAmount)
        : "",
    );

    const load = async () => {
      const acc = await getAccount();
      const { data: feesData } = await supabase
        .from("fees")
        .select("id, name, amount")
        .eq("is_active", true)
        .eq("account_id", acc?.id ?? accountId);
      setFees(feesData ?? []);

      if (!useCustomAmount) {
        if (desiredFeeId) {
          setSelectedFeeId(desiredFeeId);
        } else {
          setSelectedFeeId(undefined);
        }
      }

      if (rosterId && accountId) {
        const { data: invData } = await supabase
          .from("invoices")
          .select("id, invoice_number, amount, status, roster_id, metadata")
          .eq("person_id", person.id)
          .eq("account_id", accountId)
          .neq("status", "void")
          .order("created_at", { ascending: false });
        const rows = invData ?? [];
        setInvoicesForLink(rows);
        const linked = rows.find((r) => r.roster_id === rosterId);
        setInvoiceLinkValue(
          linked?.id ?? embeddedInvoice?.id ?? "__none__",
        );
      }
    };

    void load();
  }, [
    open,
    rosterId,
    accountId,
    person.id,
    roster,
    currentFeeId,
    currentCustomAmount,
    supabase,
    wizardStep,
  ]);

  function handlePricingModeChange(useCustom: boolean) {
    if (useCustom) {
      setPricingMode("custom");
      setSelectedFeeId(undefined);
      setCustomInvoiceMemo((prev) =>
        prev.trim() === "" ? defaultRosterInvoiceMemo : prev,
      );
    } else {
      setPricingMode("preset");
      setCustomAmountInput("");
      setCustomInvoiceMemo("");
      const back =
        roster?.fee_id ?? roster?.fees?.id ?? currentFeeId ?? null;
      setSelectedFeeId(back ? String(back) : undefined);
    }
  }

  const draftRoster = draftRosterForPreview(
    roster,
    pricingMode,
    selectedFeeId,
    fees,
    customAmountInput,
  );
  const rosterOwed = effectiveRosterOwedDollars(draftRoster);

  async function handleSaveBilling(e: React.FormEvent) {
    e.preventDefault();
    if (!rosterId) return;
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {};
      if (pricingMode === "preset") {
        updateData.fee_id =
          !selectedFeeId || selectedFeeId === "none" ? null : selectedFeeId;
        updateData.custom_amount = null;
      } else {
        updateData.fee_id = null;
        const customTrim = customAmountInput.trim();
        if (!customTrim) {
          updateData.custom_amount = null;
        } else {
          const n = Number.parseFloat(customTrim);
          if (Number.isNaN(n) || n <= 0) {
            throw new Error("Custom amount must be a positive number");
          }
          updateData.custom_amount = n;
        }
      }

      const saveRes = await fetch(`/api/rosters/${rosterId}/billing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fee_id: updateData.fee_id ?? null,
          custom_amount: updateData.custom_amount ?? null,
          invoice_id:
            invoiceLinkValue === "__none__" ? null : invoiceLinkValue,
        }),
      });
      if (!saveRes.ok) {
        const errBody = await saveRes.json().catch(() => ({}));
        throw new Error(
          (errBody as { error?: string }).error || "Failed to save billing",
        );
      }

      toast.success("Billing saved");
      if (onRefresh) await onRefresh();
      else refresh();
      const owedAfter = effectiveRosterOwedDollars(
        draftRosterForPreview(
          roster,
          pricingMode,
          selectedFeeId,
          fees,
          customAmountInput,
        ),
      );
      setSavedOwedForInvoice(
        owedAfter != null && owedAfter > 0 ? owedAfter : null,
      );
      setWizardStep(2);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const linkedDraft = parseLinkedDraftForSend(invoiceLinkValue, invoicesForLink);

  async function handleCreateStandardInvoice() {
    if (linkedDraft?.kind === "sendable") {
      setCreatingInvoice(true);
      try {
        const res = await fetch(
          `/api/invoices/${linkedDraft.id}/finalize-send`,
          { method: "POST" },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (body as { error?: string }).error || "Could not send invoice",
          );
        }
        toast.success("Draft invoice finalized and emailed");
        if (onRefresh) await onRefresh();
        else refresh();
        onOpenChange(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Invoice failed");
      } finally {
        setCreatingInvoice(false);
      }
      return;
    }

    if (!guardianEmail) {
      toast.error("Add a primary contact email first");
      return;
    }
    const amount =
      savedOwedForInvoice ??
      (rosterOwed != null && rosterOwed > 0 ? rosterOwed : null);
    if (amount == null || amount <= 0) {
      toast.error("Set a fee or custom amount in step 1 first");
      return;
    }
    if (!team?.accounts?.stripe_id) {
      toast.error("Connect Stripe on this account first");
      return;
    }
    setCreatingInvoice(true);
    try {
      await postRosterInvoice({
        rosterId,
        athleteName: personName,
        teamName,
        amount,
        guardianEmail,
        payerPersonId: person.primary_contacts?.[0]?.id,
        description:
          pricingMode === "custom" && customInvoiceMemo.trim() !== ""
            ? customInvoiceMemo.trim()
            : undefined,
        accountId: team.account_id,
        stripeAccountId: team.accounts.stripe_id,
        person_id: person.id,
      });
      toast.success("Invoice created and emailed to the primary contact");
      if (onRefresh) await onRefresh();
      else refresh();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invoice failed");
    } finally {
      setCreatingInvoice(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(85vh,720px)] max-h-[90vh] w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-1.5 border-b border-zinc-200 px-6 pb-4 pt-6 pr-14 text-left dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <DialogTitle>
                {wizardStep === 1 ? "Player billing" : "Send invoice"}
              </DialogTitle>
              <span className="rounded-full border bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:bg-zinc-800">
                Step {wizardStep} of 2
              </span>
            </div>
            <DialogDescription>
              {wizardStep === 1
                ? `${personName} · ${teamName}`
                : linkedDraft?.kind === "sendable"
                  ? "Billing is saved. You have a draft invoice linked — you can finalize and email that Stripe invoice, or finish without sending."
                  : "Billing is saved. You can email a Stripe invoice for the amount below, or finish without sending."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div
              className={cn(
                "flex h-full min-h-[min(360px,50vh)] w-[200%] transition-transform duration-300 ease-out motion-reduce:transition-none",
                wizardStep === 1 ? "translate-x-0" : "-translate-x-1/2",
              )}
            >
              <div className="h-full w-1/2 shrink-0 overflow-y-auto overscroll-contain px-6 py-4">
                <form
                  id="roster-billing-form"
                  className="space-y-4"
                  onSubmit={handleSaveBilling}
                >
                  <div className="flex flex-row items-center justify-between gap-3 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="pricing-custom-mode" className="text-base">
                        Custom amount
                      </Label>
                      <p className="text-xs text-muted-foreground pr-2">
                        Use a custom amount instead of a preset fee. This drives
                        invoices, checkout, and team totals.
                      </p>
                    </div>
                    <Switch
                      id="pricing-custom-mode"
                      checked={pricingMode === "custom"}
                      onCheckedChange={handlePricingModeChange}
                    />
                  </div>

                  {pricingMode === "preset" ? (
                    <div className="space-y-2">
                      <Label htmlFor="bill_fee">Fee</Label>
                      <Select
                        value={selectedFeeId || "none"}
                        onValueChange={(v) =>
                          setSelectedFeeId(v === "none" ? undefined : v)
                        }
                      >
                        <SelectTrigger id="bill_fee">
                          <SelectValue placeholder="No fee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No fee</SelectItem>
                          {fees.map((fee) => (
                            <SelectItem key={fee.id} value={fee.id}>
                              {fee.name} — ${fee.amount}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="bill_custom">Amount ($)</Label>
                      <Input
                        id="bill_custom"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="e.g. 175.00"
                        value={customAmountInput}
                        onChange={(e) => setCustomAmountInput(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Used for invoices, payment links, and reporting for this
                        roster spot.
                      </p>
                      <div className="space-y-2 pt-1">
                        <Label htmlFor="bill_custom_memo">
                          Invoice description / memo
                        </Label>
                        <Textarea
                          id="bill_custom_memo"
                          className="min-h-[88px] resize-y"
                          placeholder={defaultRosterInvoiceMemo}
                          value={customInvoiceMemo}
                          onChange={(e) => setCustomInvoiceMemo(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Shown on the Stripe invoice line item and in your
                          records. Leave blank to use the default roster fee text.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="bill_invoice_link">Linked invoice</Label>
                    <Select
                      value={invoiceLinkValue}
                      onValueChange={setInvoiceLinkValue}
                    >
                      <SelectTrigger id="bill_invoice_link">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {invoicesForLink.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.invoice_number || inv.id.slice(0, 8)}
                            {inv.amount != null
                              ? ` — $${Number(inv.amount).toFixed(2)}`
                              : ""}
                            {` — ${inv.status}`}
                            {inv.roster_id && inv.roster_id !== rosterId
                              ? " (other roster)"
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Tie an existing invoice to this roster for status and
                      resend.
                    </p>
                  </div>
                </form>
              </div>

              <div className="h-full w-1/2 shrink-0 overflow-y-auto overscroll-contain px-6 py-4">
                <div className="space-y-4">
                  <div className="rounded-xl border border-green-200/80 bg-green-50/80 px-4 py-4 dark:border-green-900/50 dark:bg-green-950/30">
                    <p className="text-xs font-medium uppercase tracking-wide text-green-800 dark:text-green-200">
                      Amount to invoice
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-green-900 dark:text-green-50">
                      {savedOwedForInvoice != null && savedOwedForInvoice > 0
                        ? `$${savedOwedForInvoice.toFixed(2)}`
                        : "—"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Matches what you just saved for this roster ({personName},{" "}
                      {teamName}).
                      {linkedDraft?.kind === "sendable"
                        ? " The linked Stripe draft may list a different total; sending uses that draft as-is."
                        : null}
                    </p>
                  </div>
                  {linkedDraft?.kind === "sendable" ? (
                    <p className="text-sm text-muted-foreground">
                      This uses the{" "}
                      <span className="font-medium text-foreground">
                        existing draft
                      </span>{" "}
                      in Stripe (finalize + email to the invoice customer). No
                      second invoice is created.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Stripe creates the invoice, finalizes it, and{" "}
                      <span className="font-medium text-foreground">
                        emails it to the primary contact
                      </span>{" "}
                      (customer on file).
                    </p>
                  )}
                  {linkedDraft?.kind === "blocked" ? (
                    <p className="text-xs text-amber-700 dark:text-amber-500">
                      The linked invoice is a draft without Stripe data. Use{" "}
                      <span className="font-medium">Back</span> and unlink it,
                      then send a new invoice—or fix the draft in Stripe.
                    </p>
                  ) : null}
                  {!guardianEmail && linkedDraft?.kind !== "sendable" ? (
                    <p className="text-xs text-amber-700">
                      Add a primary contact with email before sending invoices.
                    </p>
                  ) : null}
                  {linkedDraft?.kind !== "sendable" &&
                  (savedOwedForInvoice == null || savedOwedForInvoice <= 0) ? (
                    <p className="text-sm text-muted-foreground">
                      There is no billable amount on file. Use{" "}
                      <span className="font-medium">Back</span> to set a fee or
                      custom amount, save again, then return here.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="default"
                    className="w-full bg-green-700 text-white hover:bg-green-800 h-11"
                    disabled={
                      creatingInvoice ||
                      linkedDraft?.kind === "blocked" ||
                      (linkedDraft?.kind !== "sendable" &&
                        (savedOwedForInvoice == null ||
                          savedOwedForInvoice <= 0 ||
                          !guardianEmail))
                    }
                    onClick={() => void handleCreateStandardInvoice()}
                  >
                    <DocumentIcon className="h-4 w-4 mr-2 shrink-0" />
                    {creatingInvoice
                      ? "Sending…"
                      : linkedDraft?.kind === "sendable"
                        ? "Email linked draft invoice"
                        : savedOwedForInvoice != null && savedOwedForInvoice > 0
                          ? `Email invoice for $${savedOwedForInvoice.toFixed(2)}`
                          : "Set amount in step 1"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-zinc-200 bg-zinc-50/90 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/90 sm:flex-row sm:justify-end sm:space-x-2">
            {wizardStep === 1 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  form="roster-billing-form"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save and continue"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWizardStep(1)}
                  disabled={saving || creatingInvoice}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  disabled={creatingInvoice}
                >
                  Close without sending
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

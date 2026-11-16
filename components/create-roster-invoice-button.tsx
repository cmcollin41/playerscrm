import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { DocumentIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { postRosterInvoice } from "@/lib/post-roster-invoice";

interface CreateRosterInvoiceButtonProps {
  rosterId: string;
  athleteName: string;
  teamName: string;
  amount: number;
  guardianEmail: string;
  accountId: string;
  stripeAccountId: string;
  person_id: string;
  className?: string;
  onSuccess?: () => void | Promise<void>;
}

export function CreateRosterInvoiceButton({
  rosterId,
  athleteName,
  teamName,
  amount,
  guardianEmail,
  accountId,
  stripeAccountId,
  person_id,
  className,
  onSuccess,
}: CreateRosterInvoiceButtonProps) {
  const { refresh } = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCreateInvoice = async () => {
    try {
      setLoading(true);
      const result = await postRosterInvoice({
        rosterId,
        athleteName,
        teamName,
        amount,
        guardianEmail,
        accountId,
        stripeAccountId,
        person_id,
      });
      if (result.emailSent) {
        toast.success('Invoice created and emailed');
      } else {
        toast.error(
          `Invoice created, but the email didn't send${result.emailError ? `: ${result.emailError}` : ''}. Use Resend to try again.`,
        );
      }
      await onSuccess?.();
      refresh();
    } catch (error: unknown) {
      console.error('Error creating invoice:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={() => void handleCreateInvoice()}
      disabled={loading}
      variant="outline"
      className={cn(
        "text-green-600 hover:text-green-700 w-full",
        className,
      )}
    >
      <DocumentIcon className="h-4 w-4 mr-2" />
      {loading ? 'Creating...' : 'Create Invoice'}
    </Button>
  );
}

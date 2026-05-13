"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [isEmailSent, setIsEmailSent] = useState(false);

  const handleBillingPortal = async () => {
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.toLowerCase() })
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      toast.success('If your email matches an account, a link is on the way');
      setIsEmailSent(true);
      setEmail('');
    } catch (error) {
      console.error('Error details:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {isEmailSent && (
        <div className="w-full bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
          <p className="mb-1 text-base text-left font-bold font-mono">Check your inbox</p>
          <p className="text-xs text-left">If we found an Athletes App account matching that email, a billing portal link is on its way from <span className="font-medium">noreply@e.athletes.app</span>. The link expires shortly for security.</p>
        </div>
      )}
      
      <div className="flex gap-2 items-center w-full">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant="outline"
          className="whitespace-nowrap bg-blue-50 hover:bg-blue-100"
          onClick={handleBillingPortal}
          disabled={loading}
        >
          {loading ? (
            "Loading..."
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Billing Portal
            </>
          )}
        </Button>
      </div>
      <span className="text-xs text-gray-500">Use the email associated with your Athletes App account to access the billing portal.</span>
    </div>
  );
}

"use client"

import Link from "next/link"
import BillingPortalButton from "@/components/billing-portal-button"

export default function BillingPortalPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
            Billing portal link
          </h1>
          <p className="mb-8 text-center text-sm text-gray-600">
            Get a one-time link to Stripe&apos;s billing portal emailed to you
            — manage your payment methods, view past invoices, and update your
            card.
          </p>

          <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow sm:rounded-lg">
            <div className="flex flex-col items-center justify-center text-center">
              <BillingPortalButton />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            Want a full dashboard with your teams, events, and invoices?{" "}
            <Link
              href="/portal-login"
              className="text-blue-600 hover:underline"
            >
              Sign in to your portal
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { signupAndRedirect } from "./actions"

export const dynamic = "force-dynamic"

interface SignupPageProps {
  searchParams: Promise<{ error?: string; plan?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const sp = await searchParams
  const error = typeof sp.error === "string" ? sp.error : null
  const defaultPlan = sp.plan === "monthly" ? "monthly" : "annual"

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/athletes-logo.png"
          width={48}
          height={48}
          alt="Athletes App"
        />
        <span className="font-display text-xl text-gray-900">Athletes App</span>
      </Link>

      <div className="mt-8 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
          Get started
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-gray-900">
          Run your program with Athletes App.
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Create your account, then continue to checkout.
        </p>

        {error && (
          <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <form action={signupAndRedirect} className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                name="first_name"
                required
                autoComplete="given-name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                name="last_name"
                required
                autoComplete="family-name"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-900">Your program</p>
            <p className="mt-0.5 text-xs text-gray-500">
              You can add more programs (e.g. boys + girls basketball, football)
              from the dashboard once you&apos;re in.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="org_name">School or club name</Label>
                <Input
                  id="org_name"
                  name="org_name"
                  required
                  placeholder="Provo High School"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="program_name">First program</Label>
                <Input
                  id="program_name"
                  name="program_name"
                  required
                  placeholder="Provo Basketball"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="sport">Sport</Label>
                <Select name="sport" defaultValue="basketball">
                  <SelectTrigger id="sport" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basketball">Basketball</SelectItem>
                    <SelectItem value="football">Football</SelectItem>
                    <SelectItem value="baseball">Baseball</SelectItem>
                    <SelectItem value="soccer">Soccer</SelectItem>
                    <SelectItem value="lacrosse">Lacrosse</SelectItem>
                    <SelectItem value="volleyball">Volleyball</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-900">Plan</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <PlanRadio
                value="annual"
                defaultChecked={defaultPlan === "annual"}
                label="Annual"
                price="$99"
                cadence="/year"
                savings="Save $21"
              />
              <PlanRadio
                value="monthly"
                defaultChecked={defaultPlan === "monthly"}
                label="Monthly"
                price="$10"
                cadence="/month"
              />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Charged after you complete checkout. Payments processed by
              Stripe.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-gray-900 text-base font-semibold hover:bg-gray-800"
          >
            Continue to checkout
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-orange-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

function PlanRadio({
  value,
  defaultChecked,
  label,
  price,
  cadence,
  savings,
}: {
  value: "annual" | "monthly"
  defaultChecked?: boolean
  label: string
  price: string
  cadence: string
  savings?: string
}) {
  return (
    <label
      className="relative flex cursor-pointer flex-col rounded-lg border border-gray-200 p-3 transition has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/40 has-[:checked]:ring-1 has-[:checked]:ring-orange-500"
      htmlFor={`plan_${value}`}
    >
      <input
        id={`plan_${value}`}
        type="radio"
        name="plan"
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
        {label}
      </span>
      <span className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-2xl text-gray-900">{price}</span>
        <span className="text-xs text-gray-500">{cadence}</span>
      </span>
      {savings && (
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
          {savings}
        </span>
      )}
    </label>
  )
}

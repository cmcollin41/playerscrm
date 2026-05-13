"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { updateFamilyMember } from "./actions"

interface PersonInput {
  id: string
  first_name: string | null
  last_name: string | null
  name: string | null
  email: string | null
  phone: string | null
  birthdate: string | null
  grade: string | null
  gender: string | null
  aau_number: string | null
  height: string | null
  weight_lbs: number | null
  grad_year: number | null
  hometown: string | null
  bio: string | null
  maxpreps_url: string | null
  instagram: string | null
  twitter: string | null
  hudl_url: string | null
}

export function FamilyMemberForm({ person }: { person: PersonInput }) {
  const [pending, startTransition] = useTransition()
  const [dirty, setDirty] = useState(false)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updateFamilyMember(person.id, formData)
      if (result.success) {
        toast.success("Saved")
        setDirty(false)
      } else {
        toast.error(result.error ?? "Could not save")
      }
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      onChange={() => setDirty(true)}
      className="space-y-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <Section title="Contact">
        <Row>
          <Field label="First name" name="first_name" defaultValue={person.first_name} />
          <Field label="Last name" name="last_name" defaultValue={person.last_name} />
        </Row>
        <Row>
          <Field label="Email" name="email" type="email" defaultValue={person.email} />
          <Field label="Phone" name="phone" type="tel" defaultValue={person.phone} />
        </Row>
      </Section>

      <Section title="Profile">
        <Row>
          <Field label="Birthdate" name="birthdate" type="date" defaultValue={person.birthdate} />
          <Field label="Gender" name="gender" defaultValue={person.gender} />
        </Row>
        <Row>
          <Field label="Grade" name="grade" defaultValue={person.grade} />
          <Field label="Graduation year" name="grad_year" type="number" defaultValue={person.grad_year} />
        </Row>
        <Row>
          <Field label="Height" name="height" defaultValue={person.height} placeholder='e.g. 6&#39;1"' />
          <Field label="Weight (lbs)" name="weight_lbs" type="number" defaultValue={person.weight_lbs} />
        </Row>
        <Row>
          <Field label="Hometown" name="hometown" defaultValue={person.hometown} />
          <Field label="AAU number" name="aau_number" defaultValue={person.aau_number} />
        </Row>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            name="bio"
            defaultValue={person.bio ?? ""}
            rows={4}
            className="mt-1"
          />
        </div>
      </Section>

      <Section title="Links">
        <Row>
          <Field label="Instagram" name="instagram" defaultValue={person.instagram} />
          <Field label="Twitter" name="twitter" defaultValue={person.twitter} />
        </Row>
        <Row>
          <Field label="Hudl URL" name="hudl_url" defaultValue={person.hudl_url} />
          <Field label="MaxPreps URL" name="maxpreps_url" defaultValue={person.maxpreps_url} />
        </Row>
      </Section>

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <span className="text-xs text-gray-500">
          {dirty ? "Unsaved changes" : "Up to date"}
        </span>
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  )
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string | number | null
  placeholder?: string
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="mt-1"
      />
    </div>
  )
}

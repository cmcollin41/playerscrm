"use client"

import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ImageDropzone } from "@/components/ui/image-dropzone"
import { Check, ChevronsUpDown, Plus, X, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const GRADE_OPTIONS = [
  ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
  "Graduated",
] as const

const formSchema = z.object({
  person: z.string({
    required_error: "Please select a person",
  }),
  fee: z.string().optional(),
  /** dollars, optional override for this roster row */
  custom_amount: z.string().optional(),
  jersey_number: z.coerce.number().int().min(0).max(99).optional(),
  position: z.string().optional(),
  grade: z.string().optional(),
  height: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface Person {
  id: string
  first_name: string
  last_name: string
  name?: string
  grade?: string
}

interface Fee {
  id: string
  name: string
  amount: number
}

export function AddToRosterModal({
  team,
  accountId,
  onSuccess,
}: {
  team: { id: string; fee_id?: string | null }
  accountId: string
  onSuccess?: () => void
}) {
  const { refresh } = useRouter()
  const supabase = createClient()
  const [people, setPeople] = useState<Person[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [awards, setAwards] = useState<{ title: string; award_type_id?: string }[]>([])
  const [newAwardTitle, setNewAwardTitle] = useState("")
  const [awardTypes, setAwardTypes] = useState<{ id: string; name: string; slug: string; category: string }[]>([])
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })
  const { setValue } = form

  useEffect(() => {
    const fetchData = async () => {
      // Fetch people
      const { data: peopleData, error: peopleError } = await supabase
        .from("people")
        .select("id, first_name, last_name, name, grade, account_people!inner(account_id)")
        .eq("account_people.account_id", accountId)
      
      if (peopleData) setPeople(peopleData)
      if (peopleError) console.error("Error fetching people:", peopleError)

      // Fetch fees
      const { data: feesData, error: feesError } = await supabase
        .from("fees")
        .select("id, name, amount")
        .eq("account_id", accountId)
        .eq("is_active", true)
      
      if (feesData) {
        setFees(feesData)
        const defaultFeeId =
          team.fee_id && feesData.some((f) => f.id === team.fee_id)
            ? team.fee_id
            : "none"
        setValue("fee", defaultFeeId)
      }
      if (feesError) console.error("Error fetching fees:", feesError)

      // Fetch award types for this account
      const { data: awardTypesData } = await supabase
        .from("award_types")
        .select("id, name, slug, category")
        .eq("account_id", accountId)
        .order("sort_order", { ascending: true })

      if (awardTypesData) setAwardTypes(awardTypesData)
    }
    
    if (dialogOpen && accountId) {
      void fetchData()
    }
  }, [supabase, accountId, dialogOpen, team?.fee_id, setValue])

  const selectedPerson = people.find((p) => p.id === form.watch("person"))

  const filteredPeople = people.filter((person) => {
    const name = person.name || `${person.first_name} ${person.last_name}`
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    
    try {
      const rosterData: any = {
        team_id: team.id,
        person_id: data.person,
      }

      if (data.fee && data.fee !== "none") {
        rosterData.fee_id = data.fee
      }

      if (data.jersey_number != null) {
        rosterData.jersey_number = data.jersey_number
      }

      if (data.position) {
        rosterData.position = data.position
      }

      if (data.grade) {
        rosterData.grade = data.grade
      }

      if (data.height) {
        rosterData.height = data.height
      }

      if (photoPreview) {
        rosterData.photo = photoPreview
      }

      const customRaw = data.custom_amount?.trim()
      if (customRaw) {
        const n = Number.parseFloat(customRaw)
        if (!Number.isNaN(n) && n > 0) {
          rosterData.custom_amount = n
        }
      }

      const { data: insertedRoster, error } = await supabase
        .from("rosters")
        .insert([rosterData])
        .select("id")
        .single()

      if (error) {
        // Check if it's a duplicate error
        if (error.code === "23505") {
          toast.error("This person is already on the team roster")
        } else {
          toast.error("Failed to add roster member")
        }
        console.error("Error adding to roster:", error)
        return
      }

      if (insertedRoster?.id && awards.length > 0) {
        await supabase.from("roster_awards").insert(
          awards.map((a) => ({
            roster_id: insertedRoster.id,
            title: a.title,
            ...(a.award_type_id ? { award_type_id: a.award_type_id } : {}),
          }))
        )
      }

      setDialogOpen(false)
      form.reset()
      setAwards([])
      setPhotoPreview(null)
      toast.success("Roster member added to team")
      
      // Call the success callback if provided
      if (onSuccess) {
        onSuccess()
      } else {
        refresh()
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" color="primary">
          Add Player
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Roster Member</DialogTitle>
          <DialogDescription>
            Search and select a person to add to the team roster, and optionally assign a fee.
            {team.fee_id
              ? " The team's default fee is pre-selected when it is still an active catalog fee."
              : null}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="person"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Search Person</FormLabel>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        className="w-full justify-between text-sm"
                      >
                        {selectedPerson
                          ? selectedPerson.name ||
                            `${selectedPerson.first_name} ${selectedPerson.last_name}`
                          : "Search by name..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      side="bottom"
                      align="start"
                      sideOffset={4}
                    >
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search name..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>No person found.</CommandEmpty>
                          <CommandGroup>
                            {filteredPeople.map((person) => {
                              const handleSelect = () => {
                                form.setValue("person", person.id, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                  shouldTouch: true,
                                })
                                if (person.grade && !form.getValues("grade")) {
                                  form.setValue("grade", person.grade)
                                }
                                setComboboxOpen(false)
                              }

                              return (
                                <div
                                  key={person.id}
                                  onClick={handleSelect}
                                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedPerson?.id === person.id
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {person.name ||
                                    `${person.first_name} ${person.last_name}`}
                                </div>
                              )
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="jersey_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jersey #</FormLabel>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      placeholder="e.g. 23"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        field.onChange(val === '' ? undefined : Number(val))
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PG">PG</SelectItem>
                        <SelectItem value="SG">SG</SelectItem>
                        <SelectItem value="SF">SF</SelectItem>
                        <SelectItem value="PF">PF</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADE_OPTIONS.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height</FormLabel>
                    <Input
                      placeholder={`e.g. 6'2"`}
                      {...field}
                      value={field.value ?? ""}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-1">
              <ImageDropzone
                value={photoPreview}
                onChange={setPhotoPreview}
                onFileSelect={async (file) => {
                  const ext = file.name.split(".").pop()
                  const fileName = `rosters/${accountId}/${crypto.randomUUID()}.${ext}`
                  const { data, error } = await supabase.storage
                    .from("headshots")
                    .upload(fileName, file, { upsert: true })
                  if (error) throw error
                  const { data: urlData } = supabase.storage.from("headshots").getPublicUrl(data.path)
                  toast.success("Image uploaded")
                  return urlData.publicUrl
                }}
                onError={(msg) => toast.error(msg)}
                placeholder="Drop image or click to upload"
              />
              <p className="text-xs text-muted-foreground">Overrides person photo for this roster</p>
            </div>

            <div className="space-y-2">
              <FormLabel>Awards</FormLabel>
              {awards.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {awards.map((award, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      <Trophy className="h-3 w-3 text-yellow-600" />
                      {award.title}
                      <button
                        type="button"
                        onClick={() => setAwards((prev) => prev.filter((_, idx) => idx !== i))}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-red-100 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {awardTypes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Select
                    onValueChange={(value) => {
                      if (value === "__custom__") return
                      const type = awardTypes.find((t) => t.id === value)
                      if (type && !awards.some((a) => a.award_type_id === type.id)) {
                        setAwards((prev) => [
                          ...prev,
                          { title: type.name, award_type_id: type.id },
                        ])
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1 min-w-[140px]">
                      <SelectValue placeholder="Select an award..." />
                    </SelectTrigger>
                    <SelectContent>
                      {awardTypes
                        .filter((t) => !awards.some((a) => a.award_type_id === t.id))
                        .map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Custom award title"
                  value={newAwardTitle}
                  onChange={(e) => setNewAwardTitle(e.target.value)}
                  className="flex-1 min-w-[140px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (newAwardTitle.trim()) {
                        setAwards((prev) => [...prev, { title: newAwardTitle.trim() }])
                        setNewAwardTitle("")
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!newAwardTitle.trim()}
                  onClick={() => {
                    if (newAwardTitle.trim()) {
                      setAwards((prev) => [...prev, { title: newAwardTitle.trim() }])
                      setNewAwardTitle("")
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? "none"}
                  >
                    <SelectTrigger>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="custom_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom amount (optional)</FormLabel>
                  <Input
                    {...field}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 125.00"
                    value={field.value ?? ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    When set, this price is used for standard invoices and checkout instead of the catalog fee amount (you can still assign a fee for reporting).
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={!form.formState.isValid || isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add to Roster"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


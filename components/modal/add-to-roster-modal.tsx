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
import { Check, ChevronsUpDown } from "lucide-react"
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
  jersey_number: z.coerce.number().int().min(0).max(99).optional(),
  position: z.string().optional(),
  grade: z.string().optional(),
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
  team: { id: string }
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })

  useEffect(() => {
    const fetchData = async () => {
      // Fetch people
      const { data: peopleData, error: peopleError } = await supabase
        .from("people")
        .select("id, first_name, last_name, name, grade")
        .eq("account_id", accountId)
      
      if (peopleData) setPeople(peopleData)
      if (peopleError) console.error("Error fetching people:", peopleError)

      // Fetch fees
      const { data: feesData, error: feesError } = await supabase
        .from("fees")
        .select("id, name, amount")
        .eq("account_id", accountId)
        .eq("is_active", true)
      
      if (feesData) setFees(feesData)
      if (feesError) console.error("Error fetching fees:", feesError)
    }
    
    if (dialogOpen && accountId) {
      fetchData()
    }
  }, [supabase, accountId, dialogOpen])

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

      const { error } = await supabase.from("rosters").insert([rosterData])

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

      setDialogOpen(false)
      form.reset()
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

            <div className="grid grid-cols-3 gap-4">
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
            </div>

            <FormField
              control={form.control}
              name="fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
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


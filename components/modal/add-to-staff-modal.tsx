"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useModal } from "./provider";
import { toast } from "sonner";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Define the form schema
const formSchema = z.object({
  person: z.string({
    required_error: "Please select a person",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  name?: string;
}

export function AddToStaffModal({
  team,
  accountId,
  onSuccess,
}: {
  team: { id: string };
  accountId: string;
  onSuccess?: () => void;
}) {
  const { refresh } = useRouter();
  const modal = useModal();
  const supabase = createClient();
  const [people, setPeople] = useState<Person[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    const fetchPeople = async () => {
      const { data, error } = await supabase
        .from('people')
        .select('id, first_name, last_name, name')
      if (data) setPeople(data)
    }
    fetchPeople()
  }, [supabase])

  const selectedPerson = people.find(p => p.id === form.watch("person"))
  
  const filteredPeople = people.filter((person) => {
    const name = person.name || `${person.first_name} ${person.last_name}`
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const onSubmit = async (data: FormValues) => {
    const { error } = await supabase.from("staff").insert([
      {
        team_id: team.id,
        person_id: data.person,
        photo: photoPreview || null,
      },
    ])

    if (error) {
      toast.error("Failed to add staff member")
      return
    }

    setDialogOpen(false)
    form.reset()
    setPhotoPreview(null)
    toast.success("Staff member added to team")
    
    // Call the success callback if provided, otherwise use router.refresh()
    if (onSuccess) {
      onSuccess()
    } else {
      refresh()
    }
  }

 

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          color="primary"
        >
          Add Staff
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
          <DialogDescription>
            Search and select a person to add as a staff member to this team.
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
                          ? (selectedPerson.name || `${selectedPerson.first_name} ${selectedPerson.last_name}`)
                          : "Search by name..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="p-0 w-[--radix-popover-trigger-width]" 
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
                                  shouldTouch: true
                                })
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
                                      selectedPerson?.id === person.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {person.name || `${person.first_name} ${person.last_name}`}
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

            {selectedPerson && (
              <div className="space-y-1">
                <ImageDropzone
                  value={photoPreview}
                  onChange={setPhotoPreview}
                  onFileSelect={async (file) => {
                    const ext = file.name.split(".").pop();
                    const fileName = `staff/${accountId}/${crypto.randomUUID()}.${ext}`;
                    const { data, error } = await supabase.storage
                      .from("headshots")
                      .upload(fileName, file, { upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabase.storage.from("headshots").getPublicUrl(data.path);
                    toast.success("Image uploaded");
                    return urlData.publicUrl;
                  }}
                  onError={(msg) => toast.error(msg)}
                  placeholder="Drop image or click to upload"
                />
                <p className="text-xs text-muted-foreground">Overrides person photo for this team</p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={!form.formState.isValid}
              >
                Add to Staff
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

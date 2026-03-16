"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useForm, useFieldArray } from "react-hook-form"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import LoadingDots from "@/components/icons/loading-dots"
import { PlusIcon, XIcon, Trash2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ImageDropzone } from "@/components/ui/image-dropzone"
import { Textarea } from "@/components/ui/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import useProfile from "@/lib/hooks/use-profile"
import { slugify, ensureUniqueSlug } from "@/lib/slug"


interface PersonSheetProps {
  cta: React.ReactNode;
  title: string;
  description?: string;
  person?: any;
  account: any;
  mode?: 'create' | 'edit' | 'dependent';
  fromRelationships?: any;
}

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  email: z.string().optional(),
  dependent: z.boolean().default(false),
  birthdate: z.date().optional(),
  grade: z.string().min(1, "Grade is required"),
  tags: z.array(z.string()).default([]),
  photo: z.string().optional(),
  isPublic: z.boolean().default(false),
  bio: z.string().optional(),
  relationships: z.array(z.object({
    relationshipId: z.string().optional(),
    id: z.string().min(1, "Person ID is required"),
    name: z.string().min(1, "Relationship type is required"),
    primary: z.boolean().default(false)
  })).optional(),
}).superRefine((data, ctx) => {
  // Validate relationships if dependent
  if (data.dependent && (!data.relationships || data.relationships.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one relationship is required for dependents",
      path: ["relationships"]
    });
  }

  // Validate email if not dependent
  if (!data.dependent) {
    if (!data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required for non-dependents",
        path: ["email"]
      });
    } else if (!z.string().email().safeParse(data.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid email address",
        path: ["email"]
      });
    }
  }
});

type FormValues = z.infer<typeof formSchema>

const getYearRange = (startYear: number = 1900) => {
  const currentYear = new Date().getFullYear()
  return Array.from(
    { length: currentYear - startYear + 1 },
    (_, i) => currentYear - i
  )
}

const RELATIONSHIP_TYPES = [
  { id: "parent", label: "Parent" },
  { id: "guardian", label: "Guardian" },
  { id: "sibling", label: "Sibling" },
  { id: "grandparent", label: "Grandparent" },
  { id: "aunt_uncle", label: "Aunt/Uncle" },
  { id: "cousin", label: "Cousin" },
  { id: "other", label: "Other" },
] as const

// Helper function to deduplicate relationships by person_id
const deduplicateRelationships = (relationships: any[]) => {
  const seen = new Map();
  return relationships.filter(rel => {
    const key = rel.person_id;
    if (seen.has(key)) {
      // If we've seen this person_id before, keep the most recent one
      const existing = seen.get(key);
      if (new Date(rel.created_at) > new Date(existing.created_at)) {
        seen.set(key, rel);
        return true;
      }
      return false;
    } else {
      seen.set(key, rel);
      return true;
    }
  });
};

export default function PersonSheet({
  cta,
  title,
  description,
  person,
  account,
  mode = 'create',
  fromRelationships
}: PersonSheetProps) {
  const router = useRouter()
  const supabase = createClient()
  const { isAdmin } = useProfile()
  const [tags, setTags] = useState<any>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [people, setPeople] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>(undefined)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: person?.first_name || "",
      lastName: person?.last_name || "",
      phone: person?.phone || "",
      email: person?.email || "",
      dependent: person?.dependent || false,
      birthdate: person?.birthdate ? new Date(person.birthdate) : undefined,
      grade: person?.grade || "",
      tags: person?.tags || [],
      photo: person?.photo || "",
      isPublic: person?.is_public || false,
      bio: person?.bio || "",
      relationships: deduplicateRelationships(fromRelationships || []).map((rel) => ({
        relationshipId: rel.id,
        id: rel.from?.id,
        name: rel.name.toLowerCase(),
        primary: rel.primary
      })) || []
    },
    mode: "onChange"
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "relationships",
  });

  // Add this useEffect to debug the mapping
  useEffect(() => {
    console.log('Mapped relationships:', fromRelationships?.map((rel: any) => ({
      relationshipId: rel.id,
      id: rel.from?.id,
      name: rel.name.toLowerCase(),
      primary: rel.primary
    })));
  }, [fromRelationships]);

  // Reset form when sheet opens in create mode
  useEffect(() => {
    if (open && mode === 'create') {
      form.reset({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        dependent: false,
        birthdate: undefined,
        grade: "",
        tags: [],
        photo: "",
        isPublic: false,
        bio: "",
        relationships: []
      });
      setError(null);
    } else if (open && person) {
      form.reset({
        firstName: person.first_name || "",
        lastName: person.last_name || "",
        phone: person.phone || "",
        email: person.email || "",
        dependent: person.dependent || false,
        birthdate: person.birthdate ? new Date(person.birthdate) : undefined,
        grade: person.grade || "",
        tags: person.tags || [],
        photo: person.photo || "",
        isPublic: person.is_public || false,
        bio: person.bio || "",
        relationships: deduplicateRelationships(fromRelationships || []).map((rel: any) => ({
          relationshipId: rel.id,
          id: rel.from?.id,
          name: rel.name.toLowerCase(),
          primary: rel.primary
        })) || []
      });
      setError(null);
    }
  }, [open, mode, person, fromRelationships, form]);

  // Tag handlers
  // const handleTagSelect = (event: any) => {
  //   const selectedTag = event.target.value;
  //   setSelectedTags((prevTags) => [...prevTags, selectedTag]);
  // };
  // const handleTagDelete = (tagToDelete: string) => {
  //   setSelectedTags((prevTags) =>
  //     prevTags.filter((tag) => tag !== tagToDelete),
  //   );
  // };



  // Fetch tags on mount
  // useEffect(() => {
  //   const getTags = async () => {
  //     const { data, error } = await supabase
  //       .from("tags")
  //       .select("name")
  //       .eq("account_id", account?.id);

  //     if (error) console.log("getTags", error);
  //     if (data) setTags(data);
  //   };

  //   getTags();
  // }, [account?.id, supabase]);

  console.log("FROM RELATIONSHIPS", fromRelationships)

  // Fetch people on mount
  useEffect(() => {
    const fetchPeople = async () => {
      const { data } = await supabase
        .from('people')
        .select('id, first_name, last_name, name')
        .eq('dependent', false)
        .eq('account_id', account?.id)

      
      if (data) setPeople(data)
    }
    
    fetchPeople()
  }, [account?.id, supabase])

  useEffect(() => {
    const subscription = form.watch((value) => {
      console.log('Form values changed:', value)
    })
    return () => subscription.unsubscribe()
  }, [form])



  const handleSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!account?.id) {
        throw new Error("Account ID is missing");
      }

      const baseSlug = slugify(`${values.firstName} ${values.lastName}`.trim() || "person");
      const { data: existing } = await supabase
        .from("people")
        .select("id, slug")
        .eq("account_id", account.id)
        .not("slug", "is", null);
      const existingSlugs = (existing ?? [])
        .filter((p: { id: string }) => p.id !== person?.id)
        .map((p: { slug: string }) => p.slug)
        .filter(Boolean);
      const slug = baseSlug ? ensureUniqueSlug(baseSlug, existingSlugs) : null;

      const personData = {
        account_id: account.id,
        first_name: values.firstName,
        last_name: values.lastName,
        name: `${values.firstName} ${values.lastName}`,
        email: values.email || null,
        phone: values.phone || null,
        birthdate: values.birthdate,
        grade: values.grade,
        tags: values.tags,
        dependent: values.dependent,
        photo: values.photo || null,
        is_public: values.isPublic,
        bio: values.bio || null,
        slug,
      };

      // Create or update person
      const { data: savedPerson, error: personError } = await supabase
        .from("people")
        .upsert([
          person?.id 
            ? { ...personData, id: person.id }
            : personData
        ])
        .select()
        .single();

      if (personError) {
        if (personError.code === '23505') {
          throw new Error("A person with this email already exists");
        }
        throw new Error(`Failed to save person: ${personError.message}`);
      }

      if (!savedPerson) {
        throw new Error("Failed to create/update person: No data returned");
      }

      // Handle relationships if person is dependent
      if (values.dependent) {
        // Use savedPerson.id instead of person?.id
        const { error: deleteError } = await supabase
          .from("relationships")
          .delete()
          .eq('relation_id', savedPerson.id);

        if (deleteError) {
          throw new Error(`Failed to update relationships: ${deleteError.message}`);
        }

        // Insert new relationships
        if (values.relationships?.length) {
          const relationshipData = values.relationships.map(rel => ({
            person_id: rel.id,
            relation_id: savedPerson.id, // Use savedPerson.id here
            name: rel.name,
            primary: rel.primary || false,
          }));

          const { error: insertError } = await supabase
            .from("relationships")
            .insert(relationshipData);

          if (insertError) {
            throw new Error(`Failed to create relationships: ${insertError.message}`);
          }
        }
      }

      toast.success(person ? "Person updated successfully" : "Person created successfully");
      
      form.reset({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        dependent: false,
        birthdate: undefined,
        grade: "",
        tags: [],
        photo: "",
        isPublic: false,
        relationships: []
      });
      
      // Close the sheet
      setOpen(false);
      
      // Refresh the page data
      router.refresh();

    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!person?.id) return

    try {
      setIsDeleting(true)

      const { error: relError } = await supabase
        .from("relationships")
        .delete()
        .or(`person_id.eq.${person.id},relation_id.eq.${person.id}`)

      if (relError) throw new Error(`Failed to remove relationships: ${relError.message}`)

      const { error: deleteError } = await supabase
        .from("people")
        .delete()
        .eq("id", person.id)

      if (deleteError) throw new Error(`Failed to delete person: ${deleteError.message}`)

      toast.success("Person deleted successfully")
      setOpen(false)
      router.push("/people")
      router.refresh()
    } catch (err) {
      console.error("Delete error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to delete person")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          {cta}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-md bg-white">
        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(handleSubmit)} 
            className="flex flex-col h-full"
          >
            <SheetHeader className="shrink-0 border-b px-4 py-3">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-6 px-4 py-4">
                  {form.formState.errors.root && (
                    <div className="rounded-md bg-red-50 p-4 text-sm text-red-500">
                      {form.formState.errors.root.message}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="dependent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Dependent</FormLabel>
                          <FormDescription>
                            Mark this person as a dependent
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter first name" 
                              {...field}
                              className={cn(
                                form.formState.errors.firstName && "border-red-500 focus-visible:ring-red-500"
                              )}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter last name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {!form.watch("dependent") && (
                    <>
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter phone number" 
                                {...field} 
                                value={field.value ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value
                                  field.onChange(value === '' ? null : value)
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {!form.watch("dependent") && (
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email {!form.watch("dependent") && <span className="text-red-500">*</span>}</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter email address" 
                                  type="email"
                                  {...field}
                                  value={field.value ?? ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    field.onChange(value === '' ? null : value);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="birthdate"
                    render={({ field }) => {
                     

                      return (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date of birth (optional)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <div className="flex flex-col space-y-2 p-2">
                                <Select
                                  onValueChange={(year) => {
                                    const newDate = new Date(field.value || new Date())
                                    newDate.setFullYear(parseInt(year))
                                    field.onChange(newDate)
                                    setSelectedMonth(newDate)
                                  }}
                                  value={field.value ? field.value.getFullYear().toString() : undefined}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Year" />
                                  </SelectTrigger>
                                  <SelectContent position="popper">
                                    {getYearRange().map((year) => (
                                      <SelectItem key={year} value={year.toString()}>
                                        {year}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  month={selectedMonth}
                                  onMonthChange={setSelectedMonth}
                                  disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                  }
                                  initialFocus
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormDescription>
                            Select a date of birth if known
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />

                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grade (1 thru 12)</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select grade..." />
                            </SelectTrigger>
                            <SelectContent>
                              {[...Array(12)].map((_, i) => (
                                <SelectItem key={i} value={(i + 1).toString()}>
                                  {i + 1}
                                </SelectItem>
                              ))}
                              <SelectItem value="Graduated">Graduated</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="photo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Photo</FormLabel>
                        <FormControl>
                          <ImageDropzone
                            value={field.value || null}
                            onChange={(url) => field.onChange(url ?? "")}
                            onFileSelect={async (file) => {
                              const ext = file.name.split(".").pop()
                              const fileName = `${account?.id}/${crypto.randomUUID()}.${ext}`
                              const { data, error } = await supabase.storage
                                .from("headshots")
                                .upload(fileName, file, { upsert: true })
                              if (error) throw error
                              const { data: urlData } = supabase.storage
                                .from("headshots")
                                .getPublicUrl(data.path)
                              toast.success("Photo uploaded")
                              return urlData.publicUrl
                            }}
                            onError={(msg) => toast.error(msg)}
                            placeholder="Drop image or click to upload"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isPublic"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Public Profile</FormLabel>
                          <FormDescription>
                            Show this person on your public team website
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Write a short bio..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("dependent") && (
                    <div className="space-y-4">
                      <div className="flex flex-col space-y-2">
                        <FormLabel>Relationships</FormLabel>
                        <FormDescription>
                          Add relationships to this person
                        </FormDescription>
                      </div>

                      {form.formState.errors.relationships && (
                        <p className="text-sm text-red-500">
                          {form.formState.errors.relationships.message}
                        </p>
                      )}
                      
                      {/* Show existing relationships as editable fields */}
                      {fields.map((field, index) => (
                        <div key={field.id} className="space-y-4 p-4 border rounded-md">
                          {/* Relationship Type */}
                          <FormField
                            control={form.control}
                            name={`relationships.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Relationship Type</FormLabel>
                                <Select
                                  value={field.value || undefined}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type">
                                      {field.value ? RELATIONSHIP_TYPES.find(type => type.id === field.value)?.label : "Select type"}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {RELATIONSHIP_TYPES.map((type) => (
                                      <SelectItem key={type.id} value={type.id}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Person Selection */}
                          <FormField
                            control={form.control}
                            name={`relationships.${index}.id`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Select Person</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          "w-full justify-between",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value
                                          ? people.find((person) => person.id === field.value)?.name
                                          : "Search by name..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[400px] p-0">
                                    <Command>
                                      <CommandInput placeholder="Search person..." />
                                      <CommandList>
                                        <CommandEmpty>No person found.</CommandEmpty>
                                        <CommandGroup>
                                          {people.map((person) => (
                                            <CommandItem
                                              value={person.name}
                                              key={person.id}
                                              className="mt-1 cursor-pointer pointer-events-auto opacity-100 data-[disabled]:!cursor-pointer data-[disabled]:!pointer-events-auto data-[disabled]:!opacity-100 aria-[disabled]:!cursor-pointer aria-[disabled]:!pointer-events-auto aria-[disabled]:!opacity-100"
                                              onSelect={() => {
                                                field.onChange(person.id);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  field.value === person.id ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {person.name}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Primary Contact Switch */}
                          <FormField
                            control={form.control}
                            name={`relationships.${index}.primary`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-2">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormLabel>Primary Contact</FormLabel>
                              </FormItem>
                            )}
                          />
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                          >
                            <XIcon className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => append({ id: "", name: "", primary: false })}
                      >
                        <PlusIcon className="mr-2 h-4 w-4" />
                        Add Relationship
                      </Button>
                    </div>
                  )}
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t bg-white px-4 py-3 space-y-3">
              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="w-full !bg-black hover:bg-gray-900 text-white"
              >
                {isSubmitting ? (
                  <LoadingDots color="white" />
                ) : (
                  person ? "Update Person" : "Create Person"
                )}
              </Button>
              {mode === "edit" && person && isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <LoadingDots color="red" />
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Person
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {person.first_name} {person.last_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this person and all their associated data including relationships, roster entries, and invoices. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

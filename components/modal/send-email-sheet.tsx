"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import LoadingDots from "@/components/icons/loading-dots";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/emails/rich-text-editor";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  sender: z.string().min(1, "Sender is required"),
  subject: z.string().min(1, "Subject is required"),
  preview: z.string().min(1, "Preview is required"),
  message: z.string().min(1, "Message is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface SendEmailSheetProps {
  people?: any[]; // Optional - can be selected within sheet
  account: any;
  cta: React.ReactNode;
  onClose?: () => void;
  context?: {
    type: 'team' | 'list' | 'manual' | 'broadcast';
    name?: string; // Team name, list name, etc.
  };
  // For recipient selection
  allPeople?: any[]; // All available people to choose from
  teams?: any[]; // Available teams
  lists?: any[]; // Available lists
  allowRecipientSelection?: boolean; // Enable recipient picker
}

export default function SendEmailSheet({ 
  people: initialPeople, 
  account, 
  cta,
  onClose,
  context,
  allPeople,
  teams,
  lists,
  allowRecipientSelection = false
}: SendEmailSheetProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  
  // Recipient selection state
  // If recipient selection is enabled, start with empty array. Otherwise use initial people.
  const [selectedRecipients, setSelectedRecipients] = useState<any[]>(
    allowRecipientSelection ? [] : (initialPeople || [])
  );
  const [recipientSelectionMode, setRecipientSelectionMode] = useState<'people' | 'team' | 'list'>('people');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [teamMembersWithGuardians, setTeamMembersWithGuardians] = useState<any[]>([]);
  const [listMembersWithGuardians, setListMembersWithGuardians] = useState<any[]>([]);
  
  // Use either initial people or selected recipients
  const people = allowRecipientSelection ? selectedRecipients : (initialPeople || []);

  // Generate description based on context
  const getRecipientDescription = () => {
    const count = people.length;
    const plural = count !== 1 ? 's' : '';
    
    // If recipient selection is enabled and no one selected yet
    if (allowRecipientSelection && count === 0) {
      return 'Select recipients below';
    }
    
    if (!context) {
      return `${count} selected recipient${plural}`;
    }
    
    switch (context.type) {
      case 'team':
        return context.name 
          ? `${count} member${plural} from ${context.name}`
          : `${count} team member${plural}`;
      case 'list':
        return context.name 
          ? `${count} contact${plural} from ${context.name} list`
          : `${count} list contact${plural}`;
      case 'broadcast':
        return `${count} recipient${plural} (broadcast)`;
      case 'manual':
      default:
        return `${count} selected recipient${plural}`;
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sender: account?.senders?.[0]?.email ? `${account.senders[0].name} <${account.senders[0].email}>` : "",
      subject: "",
      preview: "",
      message: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const emailData = {
        account,
        people,
        sender: values.sender,
        subject: values.subject,
        message: values.message,
        preview: values.preview,
      };

      const response = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const sentCount = result.sent_count || people.length;
      
      router.refresh();
      
      // Show success toast with count
      toast.success(`Successfully sent ${sentCount} email${sentCount !== 1 ? 's' : ''}!`);
      
      // Close the sheet (this will trigger handleOpenChange which resets the form)
      setOpen(false);
    } catch (error: any) {
      setError(error.message || "An unknown error occurred");
      toast.error(`Failed to send email: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      onClose?.();
      // Reset state when closing
      form.reset();
      if (allowRecipientSelection) {
        setSelectedRecipients([]);
        setSelectedTeamId('');
        setSelectedListId('');
        setSearchQuery('');
        setTeamMembersWithGuardians([]);
        setListMembersWithGuardians([]);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button>
          {cta}
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md bg-white flex flex-col p-2"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <div className="flex h-full flex-col">
              <SheetHeader className="p-6 animate-in fade-in-0 slide-in-from-top-2 duration-300 delay-100">
                <SheetTitle>Send Email</SheetTitle>
                <SheetDescription>
                  Sending to {getRecipientDescription()}
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="space-y-6 p-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
                  {error && (
                    <div className="rounded-md bg-red-50 p-4 text-sm text-red-500">
                      {error}
                    </div>
                  )}

                  {/* Recipient Selection (when enabled) */}
                  {allowRecipientSelection && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Select Recipients</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRecipients([])}
                          disabled={selectedRecipients.length === 0}
                        >
                          Clear All
                        </Button>
                      </div>

                      {/* Selection Mode Tabs */}
                      <div className="flex gap-2 border-b">
                        <button
                          type="button"
                          onClick={() => setRecipientSelectionMode('people')}
                          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            recipientSelectionMode === 'people'
                              ? 'border-primary text-primary'
                              : 'border-transparent text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          People
                        </button>
                        {teams && teams.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setRecipientSelectionMode('team')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                              recipientSelectionMode === 'team'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Teams
                          </button>
                        )}
                        {lists && lists.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setRecipientSelectionMode('list')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                              recipientSelectionMode === 'list'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Lists
                          </button>
                        )}
                      </div>

                      {/* People Selection */}
                      {recipientSelectionMode === 'people' && allPeople && (
                        <div className="space-y-2">
                          <Input
                            placeholder="Search people..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full"
                          />
                          <div className="border rounded-md max-h-48 overflow-y-auto">
                            {allPeople
                              .filter(p => 
                                p.email && (
                                  `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  p.email.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                              )
                              .map(person => {
                                const isSelected = selectedRecipients.some(r => r.id === person.id);
                                return (
                                  <div
                                    key={person.id}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedRecipients(prev => prev.filter(r => r.id !== person.id));
                                      } else {
                                        setSelectedRecipients(prev => [...prev, person]);
                                      }
                                    }}
                                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-accent ${
                                      isSelected ? 'bg-accent/50' : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}} // Handled by parent div
                                      className="rounded"
                                      aria-label={`Select ${person.first_name} ${person.last_name}`}
                                    />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium truncate">
                                        {person.first_name} {person.last_name}
                                      </span>
                                      <span className="text-xs text-muted-foreground truncate">
                                        {person.email}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const filteredPeople = allPeople.filter(p => 
                                p.email && (
                                  `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  p.email.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                              );
                              setSelectedRecipients(filteredPeople);
                            }}
                            className="w-full"
                          >
                            Select All Matching
                          </Button>
                        </div>
                      )}

                      {/* Team Selection */}
                      {recipientSelectionMode === 'team' && teams && (
                        <div className="space-y-2">
                          <Select 
                            value={selectedTeamId} 
                            onValueChange={async (teamId) => {
                              setSelectedTeamId(teamId);
                              setIsLoadingRecipients(true);
                              try {
                                const team = teams.find(t => t.id === teamId);
                                if (team?.rosters && Array.isArray(team.rosters)) {
                                  const teamPeople = team.rosters
                                    .map((r: any) => r.people)
                                    .filter((p: any) => p && p.id);
                                  
                                  // For each person, resolve their email contact
                                  const membersWithContacts: any[] = [];
                                  
                                  for (const person of teamPeople) {
                                    if (person.email && !person.dependent) {
                                      // Person has their own email
                                      membersWithContacts.push({
                                        ...person,
                                        displayName: `${person.first_name} ${person.last_name}`,
                                        contactEmail: person.email,
                                        isGuardian: false
                                      });
                                    } else if (person.dependent) {
                                      // Person is dependent, find their guardian(s)
                                      const { createClient } = await import('@/lib/supabase/client');
                                      const supabase = createClient();
                                      
                                      const { data: relationships } = await supabase
                                        .from('relationships')
                                        .select('*, people!relationships_person_id_fkey(*)')
                                        .eq('relation_id', person.id)
                                        .eq('primary', true);
                                      
                                      if (relationships && relationships.length > 0) {
                                        // Add each guardian as a contact for this person
                                        relationships.forEach((rel: any) => {
                                          if (rel.people?.email) {
                                            membersWithContacts.push({
                                              ...rel.people,
                                              displayName: `${person.first_name} ${person.last_name} (via ${rel.people.first_name} ${rel.people.last_name})`,
                                              contactEmail: rel.people.email,
                                              isGuardian: true,
                                              guardianFor: person
                                            });
                                          }
                                        });
                                      }
                                    }
                                  }
                                  
                                  setTeamMembersWithGuardians(membersWithContacts);
                                } else {
                                  setTeamMembersWithGuardians([]);
                                }
                              } finally {
                                setIsLoadingRecipients(false);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a team" />
                            </SelectTrigger>
                            <SelectContent>
                              {teams.map(team => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {isLoadingRecipients && (
                            <div className="flex items-center justify-center py-4">
                              <LoadingDots color="currentColor" />
                            </div>
                          )}
                          
                          {!isLoadingRecipients && teamMembersWithGuardians.length > 0 && (
                            <>
                              <div className="border rounded-md max-h-48 overflow-y-auto">
                                {teamMembersWithGuardians.map((member, index) => {
                                  const isSelected = selectedRecipients.some(r => r.id === member.id);
                                  return (
                                    <div
                                      key={`${member.id}-${index}`}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedRecipients(prev => prev.filter(r => r.id !== member.id));
                                        } else {
                                          setSelectedRecipients(prev => [...prev, member]);
                                        }
                                      }}
                                      className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-accent ${
                                        isSelected ? 'bg-accent/50' : ''
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="rounded"
                                        aria-label={`Select ${member.displayName}`}
                                      />
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium truncate">
                                          {member.displayName}
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate">
                                          {member.contactEmail}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const allSelected = teamMembersWithGuardians.every(m => 
                                    selectedRecipients.some(r => r.id === m.id)
                                  );
                                  if (allSelected) {
                                    // Deselect all team members
                                    setSelectedRecipients(prev => 
                                      prev.filter(r => !teamMembersWithGuardians.some(m => m.id === r.id))
                                    );
                                  } else {
                                    // Select all team members
                                    const uniqueMembers = teamMembersWithGuardians.filter(m =>
                                      !selectedRecipients.some(r => r.id === m.id)
                                    );
                                    setSelectedRecipients(prev => [...prev, ...uniqueMembers]);
                                  }
                                }}
                                className="w-full"
                              >
                                {teamMembersWithGuardians.every(m => selectedRecipients.some(r => r.id === m.id))
                                  ? 'Deselect All'
                                  : 'Select All'}
                              </Button>
                            </>
                          )}
                          
                          {!isLoadingRecipients && selectedTeamId && teamMembersWithGuardians.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No contacts found with email addresses
                            </p>
                          )}
                        </div>
                      )}

                      {/* List Selection */}
                      {recipientSelectionMode === 'list' && lists && (
                        <div className="space-y-2">
                          <Select 
                            value={selectedListId} 
                            onValueChange={async (listId) => {
                              setSelectedListId(listId);
                              setIsLoadingRecipients(true);
                              try {
                                const list = lists.find(l => l.id === listId);
                                if (list?.list_people && Array.isArray(list.list_people)) {
                                  const listPeople = list.list_people
                                    .map((lp: any) => lp.people)
                                    .filter((p: any) => p && p.id);
                                  
                                  // For each person, resolve their email contact
                                  const membersWithContacts: any[] = [];
                                  
                                  for (const person of listPeople) {
                                    if (person.email && !person.dependent) {
                                      // Person has their own email
                                      membersWithContacts.push({
                                        ...person,
                                        displayName: `${person.first_name} ${person.last_name}`,
                                        contactEmail: person.email,
                                        isGuardian: false
                                      });
                                    } else if (person.dependent) {
                                      // Person is dependent, find their guardian(s)
                                      const { createClient } = await import('@/lib/supabase/client');
                                      const supabase = createClient();
                                      
                                      const { data: relationships } = await supabase
                                        .from('relationships')
                                        .select('*, people!relationships_person_id_fkey(*)')
                                        .eq('relation_id', person.id)
                                        .eq('primary', true);
                                      
                                      if (relationships && relationships.length > 0) {
                                        // Add each guardian as a contact for this person
                                        relationships.forEach((rel: any) => {
                                          if (rel.people?.email) {
                                            membersWithContacts.push({
                                              ...rel.people,
                                              displayName: `${person.first_name} ${person.last_name} (via ${rel.people.first_name} ${rel.people.last_name})`,
                                              contactEmail: rel.people.email,
                                              isGuardian: true,
                                              guardianFor: person
                                            });
                                          }
                                        });
                                      }
                                    }
                                  }
                                  
                                  setListMembersWithGuardians(membersWithContacts);
                                } else {
                                  setListMembersWithGuardians([]);
                                }
                              } finally {
                                setIsLoadingRecipients(false);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a list" />
                            </SelectTrigger>
                            <SelectContent>
                              {lists.map(list => (
                                <SelectItem key={list.id} value={list.id}>
                                  {list.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {isLoadingRecipients && (
                            <div className="flex items-center justify-center py-4">
                              <LoadingDots color="currentColor" />
                            </div>
                          )}
                          
                          {!isLoadingRecipients && listMembersWithGuardians.length > 0 && (
                            <>
                              <div className="border rounded-md max-h-48 overflow-y-auto">
                                {listMembersWithGuardians.map((member, index) => {
                                  const isSelected = selectedRecipients.some(r => r.id === member.id);
                                  return (
                                    <div
                                      key={`${member.id}-${index}`}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedRecipients(prev => prev.filter(r => r.id !== member.id));
                                        } else {
                                          setSelectedRecipients(prev => [...prev, member]);
                                        }
                                      }}
                                      className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-accent ${
                                        isSelected ? 'bg-accent/50' : ''
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="rounded"
                                        aria-label={`Select ${member.displayName}`}
                                      />
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium truncate">
                                          {member.displayName}
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate">
                                          {member.contactEmail}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const allSelected = listMembersWithGuardians.every(m => 
                                    selectedRecipients.some(r => r.id === m.id)
                                  );
                                  if (allSelected) {
                                    // Deselect all list members
                                    setSelectedRecipients(prev => 
                                      prev.filter(r => !listMembersWithGuardians.some(m => m.id === r.id))
                                    );
                                  } else {
                                    // Select all list members
                                    const uniqueMembers = listMembersWithGuardians.filter(m =>
                                      !selectedRecipients.some(r => r.id === m.id)
                                    );
                                    setSelectedRecipients(prev => [...prev, ...uniqueMembers]);
                                  }
                                }}
                                className="w-full"
                              >
                                {listMembersWithGuardians.every(m => selectedRecipients.some(r => r.id === m.id))
                                  ? 'Deselect All'
                                  : 'Select All'}
                              </Button>
                            </>
                          )}
                          
                          {!isLoadingRecipients && selectedListId && listMembersWithGuardians.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No contacts found with email addresses
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recipients List */}
                  <div className="rounded-lg border bg-card">
                    <button
                      type="button"
                      onClick={() => setShowRecipients(!showRecipients)}
                      className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>Recipients ({people.length})</span>
                      </div>
                      <svg
                        className={`h-4 w-4 transition-transform ${showRecipients ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showRecipients && (
                      <div className="border-t max-h-48 overflow-y-auto">
                        {people.map((person, index) => (
                          <div
                            key={person.id || index}
                            className="flex items-center justify-between px-4 py-2 text-sm hover:bg-accent/50"
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">
                                {person.first_name} {person.last_name}
                              </span>
                              {person.email && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {person.email}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="sender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Send From</FormLabel>
                        {account?.senders && account.senders.length > 0 ? (
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="truncate text-left">
                                <SelectValue placeholder="Select sender email" className="truncate text-left" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-w-[400px]">
                              {account.senders.map((sender: any) => (
                                <SelectItem 
                                  key={sender.email} 
                                  value={`${sender.name} <${sender.email}>`}
                                  className="max-w-full text-left"
                                >
                                  <div className="flex flex-col truncate text-left">
                                    <span className="font-medium truncate text-left">{sender.name}</span>
                                    <span className="text-xs text-muted-foreground truncate text-left">{sender.email}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                            <p className="text-sm text-yellow-800 font-medium">
                              No sender emails configured
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              Please add a sender email in Settings before sending emails.
                            </p>
                          </div>
                        )}
                        <FormDescription>
                          Choose the email address to send from
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter email subject" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          The subject line of your email
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preview"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preview</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter email preview"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          A brief preview that appears in email clients
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <RichTextEditor
                            content={field.value}
                            onChange={field.onChange}
                            placeholder="Write your email message..."
                          />
                        </FormControl>
                        <FormDescription>
                          Use the toolbar to format text, add images, and insert links.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </ScrollArea>

              <div className="sticky bottom-0 bg-white p-6 border-t mt-auto animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-200">
                <Button 
                  type="submit"
                  disabled={
                    isSubmitting || 
                    !account?.senders || 
                    account.senders.length === 0 ||
                    people.length === 0
                  }
                  className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <LoadingDots color="#fff" />
                  ) : (
                    `Send Email${people.length > 0 ? ` to ${people.length} recipient${people.length !== 1 ? 's' : ''}` : ''}`
                  )}
                </Button>
                {(!account?.senders || account.senders.length === 0) && (
                  <p className="text-xs text-center text-yellow-600 mt-2">
                    Cannot send email without a sender address
                  </p>
                )}
                {people.length === 0 && allowRecipientSelection && (
                  <p className="text-xs text-center text-yellow-600 mt-2">
                    Please select at least one recipient
                  </p>
                )}
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
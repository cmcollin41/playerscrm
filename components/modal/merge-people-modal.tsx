"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GitMerge, User, Mail, Phone, Calendar, Tag } from "lucide-react";
import LoadingDots from "@/components/icons/loading-dots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MergePeopleModalProps {
  person1: any;
  person2: any;
  account: any;
  onClose: () => void;
}

interface MergeSelection {
  name: '1' | '2';
  email: '1' | '2';
  phone: '1' | '2';
  birthdate: '1' | '2';
  grade: '1' | '2';
  tags: '1' | '2' | 'both';
  dependent: '1' | '2';
  primary: '1' | '2'; // Which person to keep as the primary record
}

export default function MergePeopleModal({
  person1,
  person2,
  account,
  onClose,
}: MergePeopleModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<MergeSelection>({
    name: '1',
    email: '1',
    phone: '1',
    birthdate: '1',
    grade: '1',
    tags: 'both',
    dependent: '1',
    primary: '1',
  });

  const handleMerge = async () => {
    try {
      setIsSubmitting(true);

      // Determine which is primary and which is secondary
      const primaryPerson = mergeSelection.primary === '1' ? person1 : person2;
      const secondaryPerson = mergeSelection.primary === '1' ? person2 : person1;

      // Build merged data based on selections
      const mergedData = {
        first_name: mergeSelection.name === '1' ? person1.first_name : person2.first_name,
        last_name: mergeSelection.name === '1' ? person1.last_name : person2.last_name,
        name: mergeSelection.name === '1' ? person1.name : person2.name,
        email: mergeSelection.email === '1' ? person1.email : person2.email,
        phone: mergeSelection.phone === '1' ? person1.phone : person2.phone,
        birthdate: mergeSelection.birthdate === '1' ? person1.birthdate : person2.birthdate,
        grade: mergeSelection.grade === '1' ? person1.grade : person2.grade,
        dependent: mergeSelection.dependent === '1' ? person1.dependent : person2.dependent,
        tags: mergeSelection.tags === 'both' 
          ? Array.from(new Set([...(person1.tags || []), ...(person2.tags || [])]))
          : mergeSelection.tags === '1' ? person1.tags : person2.tags,
      };

      // Call merge API
      const response = await fetch('/api/merge-people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryPersonId: primaryPerson.id,
          secondaryPersonId: secondaryPerson.id,
          mergedData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to merge people');
      }

      toast.success("People merged successfully!");
      setOpen(false);
      onClose();
      router.refresh();
    } catch (error) {
      console.error('Merge error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to merge people');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSelection = (field: keyof MergeSelection, value: string) => {
    setMergeSelection(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const PersonComparisonCard = ({ person, number }: { person: any; number: '1' | '2' }) => (
    <Card className={mergeSelection.primary === number ? "border-2 border-blue-500" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            {person.name}
          </CardTitle>
          {mergeSelection.primary === number && (
            <Badge variant="default">Primary</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {person.dependent !== undefined && (
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Type</div>
              <div className="text-muted-foreground">
                {person.dependent ? "Dependent" : "Primary Contact"}
              </div>
            </div>
          </div>
        )}
        {person.email && (
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Email</div>
              <div className="text-muted-foreground">{person.email}</div>
            </div>
          </div>
        )}
        {person.phone && (
          <div className="flex items-start gap-2">
            <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Phone</div>
              <div className="text-muted-foreground">{person.phone}</div>
            </div>
          </div>
        )}
        {person.birthdate && (
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Birthdate</div>
              <div className="text-muted-foreground">
                {new Date(person.birthdate).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}
        {person.grade && (
          <div className="flex items-start gap-2">
            <div className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Grade</div>
              <div className="text-muted-foreground">{person.grade}</div>
            </div>
          </div>
        )}
        {person.tags && person.tags.length > 0 && (
          <div className="flex items-start gap-2">
            <Tag className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium mb-1">Tags</div>
              <div className="flex flex-wrap gap-1">
                {person.tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const MergeField = ({ 
    label, 
    field, 
    icon 
  }: { 
    label: string; 
    field: keyof MergeSelection;
    icon?: React.ReactNode;
  }) => {
    const person1Value = field === 'name' ? person1.name :
      field === 'tags' ? person1[field]?.length > 0 : person1[field];
    const person2Value = field === 'name' ? person2.name :
      field === 'tags' ? person2[field]?.length > 0 : person2[field];

    // Skip if both values are empty/null
    if (!person1Value && !person2Value) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        <RadioGroup
          value={mergeSelection[field] as string}
          onValueChange={(value) => updateSelection(field, value)}
          className="grid grid-cols-2 gap-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="1" id={`${field}-1`} disabled={!person1Value} />
            <Label 
              htmlFor={`${field}-1`} 
              className={`flex-1 cursor-pointer ${!person1Value ? 'text-muted-foreground' : ''}`}
            >
              {person1Value ? (
                field === 'dependent' ? (
                  person1.dependent ? "Dependent" : "Primary Contact"
                ) : field === 'birthdate' ? (
                  new Date(person1.birthdate).toLocaleDateString()
                ) : field === 'tags' ? (
                  <div className="flex flex-wrap gap-1">
                    {person1.tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                ) : (
                  String(person1[field === 'name' ? 'name' : field] || '')
                )
              ) : (
                <span className="text-muted-foreground italic">None</span>
              )}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="2" id={`${field}-2`} disabled={!person2Value} />
            <Label 
              htmlFor={`${field}-2`} 
              className={`flex-1 cursor-pointer ${!person2Value ? 'text-muted-foreground' : ''}`}
            >
              {person2Value ? (
                field === 'dependent' ? (
                  person2.dependent ? "Dependent" : "Primary Contact"
                ) : field === 'birthdate' ? (
                  new Date(person2.birthdate).toLocaleDateString()
                ) : field === 'tags' ? (
                  <div className="flex flex-wrap gap-1">
                    {person2.tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                ) : (
                  String(person2[field === 'name' ? 'name' : field] || '')
                )
              ) : (
                <span className="text-muted-foreground italic">None</span>
              )}
            </Label>
          </div>
          {field === 'tags' && person1Value && person2Value && (
            <div className="col-span-2 flex items-center space-x-2 pt-1">
              <RadioGroupItem value="both" id={`${field}-both`} />
              <Label htmlFor={`${field}-both`} className="flex-1 cursor-pointer">
                <Badge variant="outline" className="text-xs">Combine all tags</Badge>
              </Label>
            </div>
          )}
        </RadioGroup>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitMerge className="mr-2 h-4 w-4" />
          Merge Records
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge People Records</DialogTitle>
          <DialogDescription>
            Choose which information to keep when merging these two records. All
            relationships, team memberships, invoices, and emails will be transferred to
            the primary record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Primary Record Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Which record should be the primary?</Label>
            <p className="text-sm text-muted-foreground">
              The primary record will be kept and the other will be deleted after merging.
            </p>
            <RadioGroup
              value={mergeSelection.primary}
              onValueChange={(value) => updateSelection('primary', value)}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="1" id="primary-1" className="mt-1" />
                <Label htmlFor="primary-1" className="flex-1 cursor-pointer">
                  <PersonComparisonCard person={person1} number="1" />
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="2" id="primary-2" className="mt-1" />
                <Label htmlFor="primary-2" className="flex-1 cursor-pointer">
                  <PersonComparisonCard person={person2} number="2" />
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-4">Select data to keep</h3>
            <div className="space-y-4">
              <MergeField label="Name" field="name" icon={<User className="h-4 w-4" />} />
              <MergeField label="Email" field="email" icon={<Mail className="h-4 w-4" />} />
              <MergeField label="Phone" field="phone" icon={<Phone className="h-4 w-4" />} />
              <MergeField label="Birthdate" field="birthdate" icon={<Calendar className="h-4 w-4" />} />
              <MergeField label="Grade" field="grade" />
              <MergeField label="Type" field="dependent" icon={<User className="h-4 w-4" />} />
              <MergeField label="Tags" field="tags" icon={<Tag className="h-4 w-4" />} />
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="text-sm font-medium">What will be transferred:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>All relationships (parent/guardian connections)</li>
              <li>All team memberships and roster entries</li>
              <li>All invoices and payment history</li>
              <li>All email history and list memberships</li>
              <li>Stripe customer information (if any)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <LoadingDots color="white" />
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4" />
                Merge Records
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import RichTextEditor from "@/components/emails/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mail, Loader2 } from "lucide-react"

const formSchema = z.object({
  sender: z.string().min(1, "Sender is required"),
  subject: z.string().min(1, "Subject is required"),
  preview: z.string().optional(),
  content: z.string().min(1, "Message content is required"),
  template: z.enum(["basic", "html", "text"]).default("basic"),
})

type FormValues = z.infer<typeof formSchema>

export interface UnifiedComposerProps {
  /**
   * Recipients for the email
   * Can be individuals, team members, or list members
   */
  recipients: Array<{
    email: string
    person_id?: string
    first_name?: string
    last_name?: string
    name?: string
  }>

  /**
   * Type of email being sent
   */
  emailType?: "one-off" | "batch" | "broadcast" | "transactional"

  /**
   * Account information for sender details
   */
  account: {
    id: string
    name?: string
    senders?: Array<{
      name: string
      email: string
    }>
  }

  /**
   * Optional trigger element (defaults to button)
   */
  trigger?: React.ReactNode

  /**
   * Callback when email is successfully sent
   */
  onSuccess?: () => void

  /**
   * Callback when dialog closes
   */
  onClose?: () => void

  /**
   * Additional metadata to include with email
   */
  metadata?: {
    broadcast_id?: string
    invoice_id?: string
    team_id?: string
    list_id?: string
    [key: string]: any
  }

  /**
   * Default values for form
   */
  defaultValues?: Partial<FormValues>
}

export default function UnifiedComposer({
  recipients,
  emailType = "one-off",
  account,
  trigger,
  onSuccess,
  onClose,
  metadata = {},
  defaultValues,
}: UnifiedComposerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sender: account?.senders?.[0]?.email
        ? `${account.senders[0].name} <${account.senders[0].email}>`
        : "",
      subject: "",
      preview: "",
      content: "",
      template: "basic",
      ...defaultValues,
    },
  })

  const onSubmit = async (values: FormValues) => {
    if (recipients.length === 0) {
      toast.error("No recipients selected")
      return
    }

    setIsSubmitting(true)

    try {
      const emailData = {
        type: emailType,
        sender: values.sender,
        recipients,
        subject: values.subject,
        content: values.content,
        preview: values.preview,
        template: values.template,
        metadata,
        account_id: account.id,
        account,
      }

      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to send email")
      }

      toast.success(
        `Successfully sent ${result.data.sent_count} email(s)!`,
        {
          description:
            result.data.failed_count > 0
              ? `${result.data.failed_count} email(s) failed to send`
              : undefined,
        }
      )

      // Reset form and close dialog
      form.reset()
      setOpen(false)
      router.refresh()

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error("Error sending email:", error)
      toast.error("Failed to send email", {
        description: error.message || "An unknown error occurred",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen && onClose) {
      onClose()
    }
  }

  const recipientCount = recipients.length
  const recipientLabel =
    recipientCount === 1
      ? recipients[0].name || recipients[0].email
      : `${recipientCount} recipients`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="sm">
            <Mail className="mr-2 h-4 w-4" />
            Compose Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
          <DialogDescription>
            Send an email to <strong>{recipientLabel}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Sender */}
            <FormField
              control={form.control}
              name="sender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {account?.senders?.map((sender, index) => (
                        <SelectItem
                          key={index}
                          value={`${sender.name} <${sender.email}>`}
                        >
                          {sender.name} &lt;{sender.email}&gt;
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recipients Display */}
            <div className="space-y-2">
              <FormLabel>To</FormLabel>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
                {recipients.slice(0, 10).map((recipient, index) => (
                  <Badge key={index} variant="secondary">
                    {recipient.name || recipient.email}
                  </Badge>
                ))}
                {recipients.length > 10 && (
                  <Badge variant="outline">
                    +{recipients.length - 10} more
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Sending to {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Email subject..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview Text */}
            <FormField
              control={form.control}
              name="preview"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preview Text (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Text shown in email previews..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This appears in the inbox preview
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Message Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value}
                      onChange={field.onChange}
                      placeholder="Write your message..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


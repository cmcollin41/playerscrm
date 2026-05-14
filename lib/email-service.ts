/**
 * Unified Email Service
 * 
 * Handles all email sending through Resend with:
 * - Batch sending for efficiency
 * - Consistent database logging
 * - Template support
 * - Delivery tracking
 */

import React from "react"
import resend from "./resend"
import { createClient } from "@/lib/supabase/server"
import { BasicTemplate } from "@/components/emails/basic-template"
import { render } from "@react-email/render"

export type EmailType = "one-off" | "batch" | "broadcast" | "transactional"

export interface EmailRecipient {
  email: string
  person_id?: string
  first_name?: string
  last_name?: string
  name?: string
}

export interface EmailOptions {
  type: EmailType
  sender: string
  recipients: EmailRecipient[]
  subject: string
  content: string
  preview?: string
  template?: "basic" | "html" | "text"
  metadata?: {
    broadcast_id?: string
    invoice_id?: string
    team_id?: string
    list_id?: string
    [key: string]: any
  }
  scheduled_at?: string
  account_id: string
  account?: any // Account object for template rendering
}

export interface EmailResult {
  success: boolean
  data?: any
  error?: any
  sent_count?: number
  failed_count?: number
  email_ids?: string[]
}

/**
 * Send emails using Resend with batching support
 */
export async function sendEmails(options: EmailOptions): Promise<EmailResult> {
  const {
    type,
    sender,
    recipients,
    subject,
    content,
    preview,
    template = "basic",
    metadata = {},
    account_id,
    account
  } = options

  try {
    const supabase = await createClient()

    // Prepare email data based on template
    let emailHtml: string
    let emailText: string | undefined

    if (template === "basic") {
      // Use React Email template
      emailHtml = await render(
        React.createElement(BasicTemplate, {
          message: content,
          account: account,
          person: null,
          preview: preview || subject,
        })
      )
      emailText = content
    } else if (template === "html") {
      emailHtml = content
      emailText = undefined
    } else {
      // text only
      emailHtml = `<pre>${content}</pre>`
      emailText = content
    }

    // Split recipients into batches of 100 (Resend limit)
    const BATCH_SIZE = 100
    const batches: EmailRecipient[][] = []
    
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      batches.push(recipients.slice(i, i + BATCH_SIZE))
    }

    const allResults: any[] = []
    const allEmailLogs: any[] = []
    let totalSent = 0
    let totalFailed = 0

    // Process each batch
    for (const batch of batches) {
      try {
        // Use batch API if multiple recipients, otherwise single send
        if (batch.length === 1) {
          // Single send
          const recipient = batch[0]
          const { data, error } = await resend.emails.send({
            from: sender,
            to: recipient.email,
            subject: subject,
            html: emailHtml,
            text: emailText,
          })

          if (error) {
            console.error(`Error sending email to ${recipient.email}:`, error)
            totalFailed++
            continue
          }

          allResults.push(data)
          totalSent++

          // Log to database
          allEmailLogs.push({
            account_id,
            sender,
            recipient_id: recipient.person_id || null,
            subject,
            content,
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_id: data?.id,
            email_type: type,
            template_name: template,
            batch_id: null,
            broadcast_id: metadata.broadcast_id || null,
            click_count: 0,
          })
        } else {
          // Batch send
          const batchData = batch.map((recipient) => ({
            from: sender,
            to: recipient.email,
            subject: subject,
            html: emailHtml,
            text: emailText,
          }))

          const { data, error } = await resend.batch.send(batchData)

          if (error) {
            console.error("Error in batch send:", error)
            totalFailed += batch.length
            continue
          }

          if (data) {
            allResults.push(...(data.data || []))
            totalSent += (data.data || []).length

            // Log each email to database
            const emailLogs = batch.map((recipient, index) => {
              const resendData = data.data?.[index]
              return {
                account_id,
                sender,
                recipient_id: recipient.person_id || null,
                subject,
                content,
                status: "sent",
                sent_at: new Date().toISOString(),
                resend_id: resendData?.id || null,
                batch_id: null, // Resend batch API doesn't return a batch ID
                email_type: type,
                template_name: template,
                broadcast_id: metadata.broadcast_id || null,
                click_count: 0,
              }
            })

            allEmailLogs.push(...emailLogs)
          }
        }
      } catch (batchError) {
        console.error("Error processing batch:", batchError)
        totalFailed += batch.length
      }
    }

    // Insert all email logs to database
    if (allEmailLogs.length > 0) {
      const { error: logError, data: logData } = await supabase
        .from("emails")
        .insert(allEmailLogs)
        .select()

      if (logError) {
        console.error("❌ Error logging emails to database:", logError)
        console.error("Failed email logs:", JSON.stringify(allEmailLogs, null, 2))
        // Don't throw - email was sent successfully, just logging failed
      } else {
        console.log(`✅ Successfully logged ${allEmailLogs.length} emails to database`)
      }
    }

    // If this is a broadcast, increment the broadcast sent count
    if (metadata.broadcast_id && totalSent > 0) {
      for (let i = 0; i < totalSent; i++) {
        await supabase.rpc("increment_broadcast_stat", {
          p_broadcast_id: metadata.broadcast_id,
          p_stat_name: "sent"
        })
      }
    }

    return {
      success: totalSent > 0,
      data: allResults,
      sent_count: totalSent,
      failed_count: totalFailed,
      email_ids: allResults.map((r: any) => r.id).filter(Boolean),
    }
  } catch (error) {
    console.error("Error in sendEmails:", error)
    return {
      success: false,
      error,
      sent_count: 0,
      failed_count: recipients.length,
    }
  }
}

/**
 * Send a single transactional email (invoice, invite, etc.)
 */
export interface TransactionalAttachment {
  filename: string
  content: string
  contentType?: string
}

export async function sendTransactionalEmail(options: {
  sender: string
  to: string
  subject: string
  html: string
  text?: string
  account_id: string
  person_id?: string
  metadata?: any
  attachments?: TransactionalAttachment[]
}): Promise<EmailResult> {
  const { sender, to, subject, html, text, account_id, person_id, metadata = {}, attachments } = options

  try {
    const supabase = await createClient()

    const { data, error } = await resend.emails.send({
      from: sender,
      to,
      subject,
      html,
      text,
      ...(attachments && attachments.length > 0
        ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) }
        : {}),
    })

    if (error) {
      console.error("Error sending transactional email:", error)
      return {
        success: false,
        error,
        sent_count: 0,
        failed_count: 1,
      }
    }

    // Log to database
    await supabase.from("emails").insert({
      account_id,
      sender,
      recipient_id: person_id || null,
      subject,
      content: text || html,
      status: "sent",
      sent_at: new Date().toISOString(),
      resend_id: data?.id,
      email_type: "transactional",
      template_name: "html",
      batch_id: null,
      broadcast_id: metadata?.broadcast_id || null,
      click_count: 0,
    })

    return {
      success: true,
      data,
      sent_count: 1,
      failed_count: 0,
      email_ids: [data?.id].filter(Boolean),
    }
  } catch (error) {
    console.error("Error in sendTransactionalEmail:", error)
    return {
      success: false,
      error,
      sent_count: 0,
      failed_count: 1,
    }
  }
}

/**
 * Get email statistics for an account
 */
export async function getEmailAnalytics(account_id: string, days: number = 30) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .rpc("get_email_analytics", {
        p_account_id: account_id,
        p_days: days,
      })
      .single()

    if (error) {
      console.error("Error fetching email analytics:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error in getEmailAnalytics:", error)
    return null
  }
}


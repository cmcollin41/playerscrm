import * as React from "react"
import { Button, Link, Section, Text } from "@react-email/components"
import {
  DetailRows,
  EmailShell,
  LineItems,
  buttonStyle,
  colors,
  formatEmailDate,
  text,
} from "./email-shell"
import { formatDollars } from "@/lib/money"

export interface InvoiceEmailProps {
  accountName: string
  logoUrl?: string | null
  recipientName: string
  invoiceNumber: string
  amount: number
  dueDate?: string | null
  description?: string | null
  /** Who the invoice is for, when that differs from the recipient. */
  billedFor?: string | null
  paymentLink: string
}

export function InvoiceEmail({
  accountName,
  logoUrl,
  recipientName,
  invoiceNumber,
  amount,
  dueDate,
  description,
  billedFor,
  paymentLink,
}: InvoiceEmailProps) {
  const total = formatDollars(amount)
  const due = dueDate ? formatEmailDate(dueDate) : null

  const details = [{ label: "Invoice number", value: invoiceNumber }]
  if (billedFor) details.push({ label: "For", value: billedFor })
  if (due) details.push({ label: "Due date", value: due })

  return (
    <EmailShell
      accountName={accountName}
      logoUrl={logoUrl}
      label="Invoice"
      preview={`${total} due${
        due ? ` ${due}` : ""
      } — invoice ${invoiceNumber} from ${accountName}`}
      footer={`Questions about this invoice? Reply to this email to reach ${accountName}.`}
    >
      <Text style={text.label}>Amount due</Text>
      <Text
        style={{
          margin: "4px 0 2px",
          fontSize: "36px",
          lineHeight: "44px",
          fontWeight: 700,
          color: colors.ink,
        }}
      >
        {total}
      </Text>
      <Text style={{ ...text.small, margin: "0 0 24px" }}>
        {due ? `Due ${due}` : "Due on receipt"}
      </Text>

      <Text style={text.paragraph}>
        Hi {recipientName}, here&apos;s your invoice from {accountName}.
      </Text>

      <Section style={{ margin: "0 0 24px", textAlign: "center" }}>
        <Button href={paymentLink} style={buttonStyle(colors.green)}>
          Pay invoice
        </Button>
      </Section>

      <Section
        style={{
          backgroundColor: colors.panel,
          border: `1px solid ${colors.border}`,
          borderRadius: "8px",
          padding: "12px 16px",
          margin: "0 0 24px",
        }}
      >
        <DetailRows rows={details} />
      </Section>

      <LineItems
        description={description?.trim() || "Invoice"}
        amount={total}
        totalLabel="Amount due"
        total={total}
      />

      <Text style={{ ...text.small, margin: "28px 0 0" }}>
        Button not working? Copy this link into your browser:
        <br />
        <Link
          href={paymentLink}
          style={{ color: colors.muted, wordBreak: "break-all" }}
        >
          {paymentLink}
        </Link>
      </Text>
    </EmailShell>
  )
}

export function invoiceEmailText(props: InvoiceEmailProps): string {
  const total = formatDollars(props.amount)
  return [
    `Invoice from ${props.accountName}`,
    "",
    `Hi ${props.recipientName}, here's your invoice from ${props.accountName}.`,
    "",
    `Amount due: ${total}`,
    props.dueDate ? `Due date: ${formatEmailDate(props.dueDate)}` : null,
    `Invoice number: ${props.invoiceNumber}`,
    props.billedFor ? `For: ${props.billedFor}` : null,
    `Description: ${props.description?.trim() || "Invoice"}`,
    "",
    "Pay invoice:",
    props.paymentLink,
    "",
    `Questions about this invoice? Reply to this email to reach ${props.accountName}.`,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

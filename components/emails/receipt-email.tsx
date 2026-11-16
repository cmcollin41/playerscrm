import * as React from "react"
import { Button, Section, Text } from "@react-email/components"
import {
  DetailRows,
  EmailShell,
  LineItems,
  buttonStyle,
  colors,
  formatEmailDate,
  formatMoney,
  text,
} from "./email-shell"

export interface ReceiptEmailProps {
  accountName: string
  logoUrl?: string | null
  recipientName: string
  invoiceNumber: string
  amountPaid: number
  paidAt: string | Date
  description?: string | null
  billedFor?: string | null
  /** Stripe-hosted page with the downloadable receipt, when available. */
  receiptLink?: string | null
}

export function ReceiptEmail({
  accountName,
  logoUrl,
  recipientName,
  invoiceNumber,
  amountPaid,
  paidAt,
  description,
  billedFor,
  receiptLink,
}: ReceiptEmailProps) {
  const total = formatMoney(amountPaid)
  const paidOn = formatEmailDate(paidAt)

  const details = [
    { label: "Receipt for invoice", value: invoiceNumber },
    { label: "Date paid", value: paidOn },
  ]
  if (billedFor) details.splice(1, 0, { label: "For", value: billedFor })

  return (
    <EmailShell
      accountName={accountName}
      logoUrl={logoUrl}
      label="Receipt"
      preview={`Receipt for your ${total} payment to ${accountName}`}
      footer={`Keep this email for your records. Questions? Reply to reach ${accountName}.`}
    >
      <Section
        style={{
          backgroundColor: colors.greenTint,
          border: `1px solid ${colors.greenBorder}`,
          borderRadius: "8px",
          padding: "16px",
          margin: "0 0 24px",
          textAlign: "center",
        }}
      >
        <Text style={{ ...text.label, color: colors.green }}>
          &#10003; Payment received
        </Text>
        <Text
          style={{
            margin: "4px 0 0",
            fontSize: "32px",
            lineHeight: "40px",
            fontWeight: 700,
            color: colors.ink,
          }}
        >
          {total}
        </Text>
        <Text style={{ ...text.small, margin: "2px 0 0" }}>Paid {paidOn}</Text>
      </Section>

      <Text style={text.paragraph}>
        Hi {recipientName}, thanks for your payment to {accountName}. This
        invoice is paid in full — nothing more is due.
      </Text>

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
        totalLabel="Total paid"
        total={total}
      />

      {receiptLink ? (
        <Section style={{ margin: "28px 0 0", textAlign: "center" }}>
          <Button href={receiptLink} style={buttonStyle(colors.ink)}>
            View or download receipt
          </Button>
        </Section>
      ) : null}
    </EmailShell>
  )
}

export function receiptEmailText(props: ReceiptEmailProps): string {
  return [
    `Receipt from ${props.accountName}`,
    "",
    `Hi ${props.recipientName}, thanks for your payment to ${props.accountName}. This invoice is paid in full - nothing more is due.`,
    "",
    `Amount paid: ${formatMoney(props.amountPaid)}`,
    `Date paid: ${formatEmailDate(props.paidAt)}`,
    `Invoice number: ${props.invoiceNumber}`,
    props.billedFor ? `For: ${props.billedFor}` : null,
    `Description: ${props.description?.trim() || "Invoice"}`,
    props.receiptLink ? "" : null,
    props.receiptLink ? "View or download receipt:" : null,
    props.receiptLink || null,
    "",
    `Keep this email for your records. Questions? Reply to reach ${props.accountName}.`,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

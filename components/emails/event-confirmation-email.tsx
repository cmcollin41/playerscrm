import * as React from "react"
import { Button, Section, Text } from "@react-email/components"
import {
  DetailRows,
  EmailShell,
  buttonStyle,
  colors,
  text,
} from "./email-shell"

export interface EventConfirmationEmailProps {
  accountName: string
  logoUrl?: string | null
  recipientName: string
  eventName: string
  /** Pre-formatted start date, e.g. "Monday, June 8, 2026". */
  eventDate?: string | null
  /** Comma-separated names of everyone registered. */
  registeredNames?: string | null
  eventUrl?: string | null
}

export function EventConfirmationEmail({
  accountName,
  logoUrl,
  recipientName,
  eventName,
  eventDate,
  registeredNames,
  eventUrl,
}: EventConfirmationEmailProps) {
  const details = [{ label: "Event", value: eventName }]
  if (eventDate) details.push({ label: "Starts", value: eventDate })
  if (registeredNames) {
    details.push({ label: "Registered", value: registeredNames })
  }

  return (
    <EmailShell
      accountName={accountName}
      logoUrl={logoUrl}
      label="Registration"
      preview={`You're registered for ${eventName}${
        eventDate ? ` on ${eventDate}` : ""
      }`}
      footer={`Questions about the event? Reply to this email to reach ${accountName}.`}
    >
      <Text style={{ ...text.label, color: colors.green }}>
        &#10003; Registration confirmed
      </Text>
      <Text style={{ ...text.heading, margin: "4px 0 16px" }}>
        You&apos;re registered for {eventName}
      </Text>
      <Text style={text.paragraph}>
        Hi {recipientName}, thanks for registering. Your spot is confirmed —
        here are the details.
      </Text>

      <Section
        style={{
          backgroundColor: colors.panel,
          border: `1px solid ${colors.border}`,
          borderRadius: "8px",
          padding: "12px 16px",
          margin: "0 0 8px",
        }}
      >
        <DetailRows rows={details} />
      </Section>

      {eventUrl ? (
        <Section style={{ margin: "24px 0 0", textAlign: "center" }}>
          <Button href={eventUrl} style={buttonStyle(colors.ink)}>
            View event details
          </Button>
        </Section>
      ) : null}
    </EmailShell>
  )
}

export function eventConfirmationEmailText(
  props: EventConfirmationEmailProps,
): string {
  return [
    `You're registered for ${props.eventName}`,
    "",
    `Hi ${props.recipientName}, thanks for registering. Your spot is confirmed.`,
    "",
    `Event: ${props.eventName}`,
    props.eventDate ? `Starts: ${props.eventDate}` : null,
    props.registeredNames ? `Registered: ${props.registeredNames}` : null,
    props.eventUrl ? "" : null,
    props.eventUrl ? `View event details: ${props.eventUrl}` : null,
    "",
    `Questions about the event? Reply to this email to reach ${props.accountName}.`,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

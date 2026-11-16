import * as React from "react"
import { Button, Link, Section, Text } from "@react-email/components"
import { EmailShell, buttonStyle, colors, text } from "./email-shell"

export interface InviteEmailProps {
  accountName: string
  logoUrl?: string | null
  firstName?: string | null
  /** Person who sent the invite, when known. */
  inviterName?: string | null
  signupUrl: string
  /** Shown for people who may already have a login. */
  signInUrl?: string | null
}

export function InviteEmail({
  accountName,
  logoUrl,
  firstName,
  inviterName,
  signupUrl,
  signInUrl,
}: InviteEmailProps) {
  return (
    <EmailShell
      accountName={accountName}
      logoUrl={logoUrl}
      label="Invitation"
      preview={`You're invited to join ${accountName}`}
      footer={`This invitation was sent by ${accountName}. If you weren't expecting it, you can ignore this email.`}
    >
      <Text style={text.heading}>Join {accountName}</Text>
      <Text style={text.paragraph}>
        Hi{firstName ? ` ${firstName}` : ""},{" "}
        {inviterName ? (
          <>
            <strong>{inviterName}</strong> has invited you
          </>
        ) : (
          <>you&apos;ve been invited</>
        )}{" "}
        to join <strong>{accountName}</strong>. Create your account to get
        started.
      </Text>

      <Section style={{ margin: "8px 0 24px", textAlign: "center" }}>
        <Button href={signupUrl} style={buttonStyle(colors.ink)}>
          Accept invitation
        </Button>
      </Section>

      {signInUrl ? (
        <Text style={text.paragraph}>
          Already have an account?{" "}
          <Link href={signInUrl} style={{ color: colors.ink, fontWeight: 600 }}>
            Sign in instead
          </Link>
          .
        </Text>
      ) : null}

      <Text style={text.small}>
        Button not working? Copy this link into your browser:
        <br />
        <Link
          href={signupUrl}
          style={{ color: colors.muted, wordBreak: "break-all" }}
        >
          {signupUrl}
        </Link>
      </Text>
    </EmailShell>
  )
}

export function inviteEmailText(props: InviteEmailProps): string {
  const who = props.inviterName
    ? `${props.inviterName} has invited you`
    : "You've been invited"
  return [
    `Hi${props.firstName ? ` ${props.firstName}` : ""},`,
    "",
    `${who} to join ${props.accountName}. Create your account to get started:`,
    props.signupUrl,
    props.signInUrl ? "" : null,
    props.signInUrl
      ? `Already have an account? Sign in: ${props.signInUrl}`
      : null,
    "",
    `This invitation was sent by ${props.accountName}. If you weren't expecting it, you can ignore this email.`,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

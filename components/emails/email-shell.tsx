import * as React from "react"
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

export const colors = {
  page: "#f4f4f5",
  card: "#ffffff",
  border: "#e4e4e7",
  ink: "#18181b",
  body: "#3f3f46",
  muted: "#71717a",
  faint: "#a1a1aa",
  panel: "#fafafa",
  green: "#15803d",
  greenTint: "#f0fdf4",
  greenBorder: "#bbf7d0",
}

export const text = {
  paragraph: {
    margin: "0 0 16px",
    fontSize: "15px",
    lineHeight: "24px",
    color: colors.body,
  } as React.CSSProperties,
  small: {
    margin: "0",
    fontSize: "13px",
    lineHeight: "20px",
    color: colors.muted,
  } as React.CSSProperties,
  heading: {
    margin: "0 0 8px",
    fontSize: "22px",
    lineHeight: "30px",
    fontWeight: 700,
    color: colors.ink,
  } as React.CSSProperties,
  label: {
    margin: "0",
    fontSize: "11px",
    lineHeight: "16px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: colors.muted,
  } as React.CSSProperties,
}

export function buttonStyle(background: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "13px 28px",
    borderRadius: "8px",
    backgroundColor: background,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
  }
}

/**
 * No per-account timezone is stored; render dates in Mountain time so they
 * match local wall-clock terms rather than the server's UTC.
 */
export function formatEmailDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  })
}

interface EmailShellProps {
  accountName: string
  logoUrl?: string | null
  /** Inbox preview line. */
  preview: string
  /** Document type shown opposite the sender, e.g. "Invoice". */
  label?: string
  /** Closing line under the card. */
  footer?: string
  children: React.ReactNode
}

/**
 * Shared frame for every transactional email: sender on the left, document
 * type on the right, one white card, quiet footer.
 */
export function EmailShell({
  accountName,
  logoUrl,
  preview,
  label,
  footer,
  children,
}: EmailShellProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "32px 12px",
          backgroundColor: colors.page,
          fontFamily: FONT,
        }}
      >
        <Container style={{ maxWidth: "560px", margin: "0 auto" }}>
          <Section style={{ padding: "0 4px 16px" }}>
            <table
              width="100%"
              cellPadding={0}
              cellSpacing={0}
              role="presentation"
            >
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "middle" }}>
                    {logoUrl ? (
                      <Img
                        src={logoUrl}
                        alt={accountName}
                        height={36}
                        style={{
                          display: "block",
                          height: "36px",
                          width: "auto",
                        }}
                      />
                    ) : (
                      <Text
                        style={{
                          margin: 0,
                          fontSize: "17px",
                          lineHeight: "24px",
                          fontWeight: 700,
                          color: colors.ink,
                        }}
                      >
                        {accountName}
                      </Text>
                    )}
                  </td>
                  {label ? (
                    <td style={{ verticalAlign: "middle", textAlign: "right" }}>
                      <Text style={text.label}>{label}</Text>
                    </td>
                  ) : null}
                </tr>
              </tbody>
            </table>
          </Section>

          <Section
            style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              padding: "32px",
            }}
          >
            {children}
          </Section>

          <Section style={{ padding: "20px 4px 0" }}>
            <Text
              style={{
                ...text.small,
                textAlign: "center",
                color: colors.faint,
              }}
            >
              {footer ?? `Sent by ${accountName}`}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

interface DetailRow {
  label: string
  value: string
}

/** Two-column label/value list used for invoice and receipt metadata. */
export function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td
              style={{
                padding: "5px 0",
                fontSize: "14px",
                lineHeight: "20px",
                color: colors.muted,
              }}
            >
              {row.label}
            </td>
            <td
              style={{
                padding: "5px 0",
                fontSize: "14px",
                lineHeight: "20px",
                color: colors.ink,
                textAlign: "right",
                fontWeight: 500,
              }}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface LineItemsProps {
  description: string
  amount: string
  totalLabel: string
  total: string
}

/** Single line item plus a total row, ruled like a paper invoice. */
export function LineItems({
  description,
  amount,
  totalLabel,
  total,
}: LineItemsProps) {
  const head: React.CSSProperties = {
    ...text.label,
    padding: "0 0 8px",
    borderBottom: `1px solid ${colors.border}`,
  }
  const cell: React.CSSProperties = {
    padding: "12px 0",
    fontSize: "14px",
    lineHeight: "20px",
    color: colors.ink,
    borderBottom: `1px solid ${colors.border}`,
    verticalAlign: "top",
  }
  const totalCell: React.CSSProperties = {
    padding: "12px 0 0",
    fontSize: "15px",
    lineHeight: "22px",
    fontWeight: 700,
    color: colors.ink,
  }

  return (
    <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
      <tbody>
        <tr>
          <td style={head}>Description</td>
          <td style={{ ...head, textAlign: "right" }}>Amount</td>
        </tr>
        <tr>
          <td style={cell}>{description}</td>
          <td
            style={{
              ...cell,
              textAlign: "right",
              whiteSpace: "nowrap",
              paddingLeft: "16px",
            }}
          >
            {amount}
          </td>
        </tr>
        <tr>
          <td style={totalCell}>{totalLabel}</td>
          <td style={{ ...totalCell, textAlign: "right" }}>{total}</td>
        </tr>
      </tbody>
    </table>
  )
}

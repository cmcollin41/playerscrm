import * as React from "react"
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
} from "@react-email/components"

interface EmailTemplateProps {
  account?: any
  person?: any
  preview?: string
  message: string
}

export const BasicTemplate: React.FC<Readonly<EmailTemplateProps>> = ({
  account,
  person: _person,
  preview,
  message,
}) => (
  <Html>
    <Head>
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
      <style>{`
        /* Email client resets */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; max-width: 100%; }
        body { margin: 0; padding: 0; width: 100% !important; }
      `}</style>
    </Head>
    {preview && <Preview>{preview}</Preview>}
    <Tailwind>
      <Body className="bg-white font-sans">
        <Container
          className="max-w-[600px] px-4 py-8"
          style={{ maxWidth: "600px", margin: "0" }}
        >
          <Section>
            <div dangerouslySetInnerHTML={{ __html: message }} />
          </Section>

          {account?.name && (
            <Section className="mt-8 border-t border-gray-200 pt-4 text-center">
              <p className="m-0 text-xs text-gray-400">{account.name}</p>
            </Section>
          )}
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

import type { ReactElement } from "react"
import { render } from "@react-email/render"

interface RenderedEmail {
  html: string
  text: string
}

/**
 * Pair a rendered React Email template with its hand-written plain-text
 * part. The text is written per template because auto-converting the HTML
 * runs table cells together.
 */
export async function renderEmail(
  element: ReactElement,
  text: string,
): Promise<RenderedEmail> {
  return { html: await render(element), text: text.trim() }
}

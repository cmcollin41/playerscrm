import sanitizeHtml from "sanitize-html"

/**
 * Sanitize a partner-supplied product description so it can be rendered
 * with `dangerouslySetInnerHTML` on the storefront. Printify/Printful let
 * merchants write rich HTML in their product descriptions — we want the
 * formatting (paragraphs, lists, bold, links) but not any script, iframe,
 * or style injection.
 *
 * The allowlist is the conservative Printify/Printful overlap: text
 * formatting + links. No images (those would bypass our CDN allowlist),
 * no embeds, no inline styles.
 */
export function sanitizeProductDescription(html: string | null | undefined): string {
  if (!html) return ""
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "ul",
      "ol",
      "li",
      "a",
      "span",
      "blockquote",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "code",
    ],
    allowedAttributes: {
      a: ["href"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
  })
}

export function productDescriptionToPlainText(
  html: string | null | undefined,
): string {
  if (!html) return ""
  const stripped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
  return stripped.replace(/\s+/g, " ").trim()
}

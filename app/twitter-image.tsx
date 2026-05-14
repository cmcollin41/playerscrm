// Twitter card uses the same render function as the OG card. Constants
// must be declared inline (not re-exported) so Next.js can statically
// resolve the runtime — re-exports trip the static analyzer and fall
// back to the edge runtime, which breaks the fs.readFileSync call
// inside opengraph-image.tsx.
import OpengraphImage from "./opengraph-image"

export const runtime = "nodejs"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt =
  "Athletes App — the operating system for your sports program"

export default OpengraphImage

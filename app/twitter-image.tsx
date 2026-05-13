// Twitter card uses the same image as the OG card. Re-export from
// opengraph-image so any future tweaks land in both at once.
export {
  default,
  runtime,
  size,
  contentType,
  alt,
} from "./opengraph-image"

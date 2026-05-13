import "@/styles/globals.css";
import "@/styles/slick.css";
import "@/styles/slick-theme.css";

import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import { Metadata } from "next";
import { ModalProvider } from "@/components/modal/provider";
import { inter, cal } from "@/styles/fonts";

const title = "Athletes App — the operating system for sports programs";
const description =
  "The all-in-one platform for sports programs: rosters, events, payments, public profiles, and parent communications. Built for clubs, high schools, and youth programs.";

const image = "/og-image.png";

export const metadata: Metadata = {
  title,
  description,
  icons: ["/athletes-logo.png"],
  openGraph: {
    title,
    description,
    images: [image],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  },
  metadataBase: new URL("https://athletes.app"),
};

export default async function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${cal.variable}`}>
      <head>
        <link
          href="https://releases.transloadit.com/uppy/v3.13.1/uppy.min.css"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <ModalProvider>{props.children}</ModalProvider>
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}

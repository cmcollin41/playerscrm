import "@/styles/globals.css";
import "@/styles/slick.css";
import "@/styles/slick-theme.css";

import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import { Metadata } from "next";
import { ModalProvider } from "@/components/modal/provider";


const title = "Provo Basketball";
const description = "A CRM for your athletes and parents.";

const image = "/og-image.png";

export const metadata: Metadata = {
  title,
  description,
  icons: ["/logo.svg"],
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
    creator: "@provobasketball",
  },
  metadataBase: new URL("https://app.provobasketball.com"),
};

export default async function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://releases.transloadit.com/uppy/v3.13.1/uppy.min.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <ModalProvider>{props.children}</ModalProvider>
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}

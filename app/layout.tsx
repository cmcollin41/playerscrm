import "@/styles/globals.css";
import "@/styles/slick.css";
import "@/styles/slick-theme.css";

import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import { Metadata } from "next";
import { ModalProvider } from "@/components/modal/provider";
import { inter, cal } from "@/styles/fonts";

const defaultTitle =
  "Athletes App — the operating system for your sports program";
const description =
  "The all-in-one platform for sports programs: rosters, events, payments, public profiles, and parent communications. Built for clubs, high schools, and youth programs.";

export const metadata: Metadata = {
  metadataBase: new URL("https://athletes.app"),
  title: {
    default: defaultTitle,
    template: "%s · Athletes App",
  },
  description,
  applicationName: "Athletes App",
  keywords: [
    "sports CRM",
    "team management",
    "athlete registration",
    "club management software",
    "youth sports platform",
    "team website builder",
    "sports payments",
    "roster management",
  ],
  icons: {
    icon: "/athletes-logo.png",
    apple: "/athletes-logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://athletes.app",
    siteName: "Athletes App",
    title: defaultTitle,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
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

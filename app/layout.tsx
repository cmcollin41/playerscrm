import "@/styles/globals.css";
import "@/styles/slick.css";
import "@/styles/slick-theme.css";

import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import { Metadata } from "next";
import { ModalProvider } from "@/components/modal/provider";
import { inter, cal } from "@/styles/fonts";

const defaultTitle =
  "Varsity Habits — the operating system for your sports program";
const description =
  "The all-in-one platform for sports programs: rosters, events, payments, public profiles, and parent communications. Built for clubs and schools.";

export const metadata: Metadata = {
  metadataBase: new URL("https://varsityhabits.com"),
  title: {
    default: defaultTitle,
    template: "%s · Varsity Habits",
  },
  description,
  applicationName: "Varsity Habits",
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
    icon: "/vh.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://varsityhabits.com",
    siteName: "Varsity Habits",
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

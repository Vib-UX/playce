import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://playces.fun"),
  title: {
    default: "Playces — Show up. Play. Earn.",
    template: "%s · Playces",
  },
  description:
    "Playces turns real-world venues into interactive social arenas. Check in, play mini-games, rep your favorite chains, unlock airdrops, and collect onchain rewards.",
  keywords: [
    "Playces",
    "events",
    "check-in",
    "mini-games",
    "airdrops",
    "onchain rewards",
    "geofencing",
    "embedded wallet",
  ],
  openGraph: {
    title: "Playces — Show up. Play. Earn.",
    description:
      "Check in at venues, play onchain mini-games like the 67, rep your chain, and earn rewards + airdrops.",
    type: "website",
    siteName: "Playces",
    url: "https://playces.fun",
    images: [
      {
        url: "/cover.jpg",
        width: 1200,
        height: 630,
        alt: "Playces — turn venues into onchain arenas.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Playces — Show up. Play. Earn.",
    description:
      "Check in at venues, play onchain mini-games like the 67, rep your chain, and earn rewards + airdrops.",
    images: ["/cover.jpg"],
  },
  applicationName: "Playces",
  appleWebApp: {
    capable: true,
    title: "Playces",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0912" },
  ],
  // Let content extend under the notch / home indicator so the safe-area
  // insets used across the app take effect when installed to the home screen.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}

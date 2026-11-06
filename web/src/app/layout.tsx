import type { Metadata } from "next";
import { Fragment_Mono, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SourceSwitch } from "@/components/source-switch";
import { NavLinks } from "@/components/nav-links";
import { currentSource } from "@/lib/server/data";
import { hasData } from "@/lib/receipts/store";
import "./globals.css";

const ui = Schibsted_Grotesk({ variable: "--font-ui", subsets: ["latin"] });
const receipt = Fragment_Mono({ variable: "--font-receipt", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Receipts",
  description: "See what your AI coding spend actually bought.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const source = await currentSource();
  const hasLocal = hasData("local");
  return (
    <html lang="en" className={`${ui.variable} ${receipt.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>
          <header className="border-b border-border/80 bg-background/90 backdrop-blur sticky top-0 z-30">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <Logo />
                <span className="text-[17px]">Receipts</span>
              </Link>
              <NavLinks />
              <div className="ml-auto flex items-center gap-3">
                <Link href="/how" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  How it works
                </Link>
                <SourceSwitch source={source} hasLocal={hasLocal} />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
          <footer className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-6 gap-y-1 px-4 pb-8 pt-4 text-sm text-muted-foreground sm:px-6">
            <span>Your prompts never leave this laptop.</span>
            <Link href="/how" className="hover:text-foreground">
              How it works
            </Link>
            <Link href="/verify" className="hover:text-foreground">
              Check a receipt
            </Link>
          </footer>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}

function Logo() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true" className="text-primary">
      <path
        d="M1 1h16v18l-2.7-1.6L11.6 19l-2.6-1.6L6.4 19l-2.7-1.6L1 19z"
        fill="var(--paper)"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M4.5 6h9M4.5 9h9M4.5 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

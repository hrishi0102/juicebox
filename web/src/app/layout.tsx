import type { Metadata } from "next";
import { Archivo, Commissioner, Martian_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ZeroGProvider } from "@/components/zero-g";
import { DemoBanner } from "@/components/demo";
import { currentSource, zeroGAllowed } from "@/lib/server/data";
import "./globals.css";

// Archivo (variable width) for the app, Martian Mono for the receipt paper, hashes and keys, and
// Commissioner for AI Wrapped only.
const ui = Archivo({ variable: "--font-ui", subsets: ["latin"], axes: ["wdth"] });
const receipt = Martian_Mono({ variable: "--font-receipt", subsets: ["latin"], axes: ["wdth"] });
const fun = Commissioner({ variable: "--font-fun", subsets: ["latin"], axes: ["FLAR", "VOLM"] });

export const metadata: Metadata = {
  title: "Receipts",
  description: "What did your AI spend get done? Each person's laptop writes a signed weekly receipt; the company sees everyone's.",
};

export const dynamic = "force-dynamic";

// Each part of the app (company, my week, for fun, public pages) brings its own header in its
// own layout. This one only holds what they share: fonts, the 0G session and the demo banner.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const source = await currentSource();
  return (
    <html lang="en" className={`${ui.variable} ${receipt.variable} ${fun.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>
          <ZeroGProvider allowed={await zeroGAllowed()}>
            {source === "demo" && <DemoBanner />}
            {children}
          </ZeroGProvider>
        </TooltipProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}

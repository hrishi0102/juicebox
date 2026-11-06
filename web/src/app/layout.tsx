import type { Metadata } from "next";
import { Fragment_Mono, Schibsted_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ZeroGProvider } from "@/components/zero-g";
import { DemoBanner } from "@/components/demo";
import { currentSource, zeroGAllowed } from "@/lib/server/data";
import "./globals.css";

const ui = Schibsted_Grotesk({ variable: "--font-ui", subsets: ["latin"] });
const receipt = Fragment_Mono({ variable: "--font-receipt", subsets: ["latin"], weight: "400" });

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
    <html lang="en" className={`${ui.variable} ${receipt.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>
          <ZeroGProvider allowed={await zeroGAllowed()}>
            {source === "demo" && <DemoBanner />}
            {children}
          </ZeroGProvider>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}

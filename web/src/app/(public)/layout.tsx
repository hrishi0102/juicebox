import { PublicFrame } from "@/components/public-frame";

// The front door, the demo picker, and pages anyone can open with a link (a shared receipt, the
// receipt checker, how it works). Nobody signs in here. The front door brings its own header.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicFrame>{children}</PublicFrame>;
}

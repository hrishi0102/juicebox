import { VerifyForm } from "@/components/verify-form";

export default function VerifyPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Check a receipt</h1>
        <p className="mt-2 text-muted-foreground">
          Anyone can check a receipt without trusting us: the numbers must match the owner&apos;s EIP-712 signature, and the evidence and judge records
          must match the Merkle roots inside the signed part. Paste a downloaded receipt, or the Arkiv entity key of a shared one.
        </p>
      </div>
      <VerifyForm />
    </div>
  );
}

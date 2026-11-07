import { VerifyForm } from "@/components/verify-form";

export default function VerifyPage() {
  return (
    <div className="wrapw pt-11 max-[760px]:pt-7">
      <div className="check-grid">
        <div className="min-w-0">
          <h1 className="disp h-page">Check a receipt</h1>
          <p className="lede mt-3.5">
            Anyone can check a receipt without trusting us: the numbers must match the owner&apos;s EIP-712 signature, and the evidence and judge records
            must match the Merkle roots inside the signed part. Paste a downloaded receipt, or the Arkiv entity key of a shared one.
          </p>
          <VerifyForm />
        </div>
        <aside className="pnl mt-2" aria-labelledby="what-h">
          <div className="pnl-h">
            <h2 className="pnl-t" id="what-h">
              What gets checked
            </h2>
          </div>
          <div className="aside-row">
            <b>The signature</b>
            <p>Every number must match the owner&apos;s EIP-712 signature. Change one cent and it fails.</p>
          </div>
          <div className="aside-row">
            <b>The roots</b>
            <p>The pull requests and private AI records must match the Merkle roots inside the signed part.</p>
          </div>
          <div className="aside-row">
            <b>The record</b>
            <p>For an Arkiv key: who owns it, who paid for it, and whether it is read-only.</p>
          </div>
          <div className="aside-row">
            <b>Where to find one</b>
            <p>A shared link ends in the entity key. The author can also download the receipt file after signing.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

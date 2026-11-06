import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { FlowSteps } from "@/components/flow-steps";
import { buttonVariants } from "@/components/ui/button";
import { arkivWriterAddress } from "@/lib/receipts/arkiv";
import { arkivAddressUrl, DEMO_SEALED, swarmProofPath, zgProofPath } from "@/lib/proof-urls";
import { providersFor } from "@/lib/server/zerog-providers";

// The front door. Two sides of one product (the company, and each employee on their laptop), one
// side product for anyone (AI Wrapped), the demo company to look around, and what it runs on, each
// with a live place to check it.
export default async function FrontDoor() {
  const [provider] = await providersFor();
  const writer = arkivWriterAddress();
  return (
    <div className="space-y-12 py-4">
      <section className="max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">Receipts</p>
        <h1 className="mt-1 text-balance text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl">What did your AI spend get done?</h1>
        <p className="mt-5 text-pretty text-lg text-muted-foreground">
          Every week, each person&apos;s laptop turns their Claude Code and Codex sessions into a short list of what got done, written by a private AI
          on 0G and signed with their own key. They send it to the company, which sees everyone&apos;s week and the pull requests behind it. Prompts
          never leave the laptop.
        </p>
      </section>

      <section aria-label="The two sides" className="grid gap-5 md:grid-cols-2">
        <Door
          eyebrow="For companies"
          title="See what everyone got done"
          body="Everyone's signed week, by team and by person, with the pull requests behind it and where the AI money went. Leads sign in with GitHub; your company is your GitHub org."
          steps={["Set up once", "Sign in with GitHub", "See everyone's week"]}
          href="/company"
          cta="Open the company page"
          color="var(--c-researched)"
        />
        <Door
          eyebrow="For employees"
          title="Send your weekly receipt"
          body="Runs on your laptop. A private AI on 0G writes your week from your sessions, paid from your own 0G credits. You sign the whole receipt and send it."
          steps={["Write", "Sign", "Send"]}
          href="/me"
          cta="Open my week"
          color="var(--c-built)"
        />
      </section>

      <section aria-labelledby="runs-on">
        <h2 id="runs-on" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What it runs on, and where to check it
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <Service
            name="0G"
            color="var(--c-researched)"
            body="A private AI in a hardware enclave reads each session and writes the week, paid from the employee's own 0G credits."
            link={provider ? { href: zgProofPath(provider), label: "0G's TEE check of the provider" } : undefined}
          />
          <Service
            name="Arkiv"
            color="var(--c-figured)"
            body="Every receipt sent is a read-only record on Arkiv, owned by the person who signed it. The company wallet only pays the fee."
            link={writer ? { href: arkivAddressUrl(writer), label: "Every record it wrote, on the Arkiv explorer", external: true } : undefined}
          />
          <Service
            name="Swarm"
            color="var(--c-wrote)"
            body="Each week's full list is encrypted on the laptop and kept on Swarm, where only the company's key opens it."
            link={{ href: swarmProofPath(DEMO_SEALED.swarm, DEMO_SEALED.entity), label: "One encrypted week, fetched live" }}
          />
        </div>
      </section>

      <section aria-label="More" className="grid gap-4 md:grid-cols-3">
        <Small title="Just for fun" body="AI Wrapped: how you talk to AI, for anyone. Nothing to do with receipts, never sent to a company." href="/wrapped" cta="Open AI Wrapped" />
        <Small title="Just looking?" body="Try the demo company Acme: 12 made-up people, five weeks of signed receipts." href="/demo" cta="Try the demo" />
        <Small title="Got a receipt link?" body="Anyone can check a receipt's signature and numbers, without trusting us." href="/verify" cta="Check a receipt" />
      </section>
    </div>
  );
}

function Door({ eyebrow, title, body, steps, href, cta, color }: { eyebrow: string; title: string; body: string; steps: string[]; href: string; cta: string; color: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-7">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color }}>
        <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">{body}</p>
      <div className="mt-5">
        <FlowSteps label={`${eyebrow}: steps`} steps={steps.map((label) => ({ label }))} />
      </div>
      <div className="mt-6">
        <Link href={href} className={buttonVariants({ size: "lg" })}>
          {cta}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function Service({ name, color, body, link }: { name: string; color: string; body: string; link?: { href: string; label: string; external?: boolean } }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-lg font-semibold" style={{ color }}>
        {name}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {link &&
        (link.external ? (
          <a href={link.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {link.label} <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : (
          <Link href={link.href} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            {link.label}
          </Link>
        ))}
    </div>
  );
}

function Small({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="rounded-xl border border-border p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Link href={href} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
        {cta}
      </Link>
    </div>
  );
}

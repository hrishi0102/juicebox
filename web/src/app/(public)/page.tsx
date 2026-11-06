import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FlowSteps } from "@/components/flow-steps";
import { buttonVariants } from "@/components/ui/button";

// The front door. Two sides of one product (the company, and each employee on their laptop), one
// side product for anyone (AI Wrapped and week cards), and the demo company to look around.
export default function FrontDoor() {
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
          body="Runs on your laptop. A private AI on 0G writes your week from your sessions, paid from your own 0G credits. You check what your company will see, sign it, and send it."
          steps={["Write", "Review", "Sign", "Send"]}
          href="/me"
          cta="Open my week"
          color="var(--c-built)"
        />
      </section>

      <section aria-label="More" className="grid gap-4 md:grid-cols-3">
        <Small title="Just for fun" body="AI Wrapped and a card of your week, for anyone. Not signed, never sent to a company." href="/wrapped" cta="Open AI Wrapped" />
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

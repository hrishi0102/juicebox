import { EnterDemo } from "@/components/demo";
import { DEMO_ROLES } from "@/lib/demo-roles";

export const metadata = { title: "Try the demo · Receipts" };

// Pick who you want to be at the demo company. Each role opens its own part of the app.
export default function DemoPicker() {
  const [lead, engineer, link, fun] = DEMO_ROLES;
  return (
    <div className="space-y-10 py-4">
      <section className="max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">Demo</p>
        <h1 className="mt-1 text-balance text-5xl font-semibold leading-[1.04] tracking-tight">Try the demo company</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Acme has 12 made-up people in three teams (Payments, Platform, Mobile), with five weeks of signed receipts on Arkiv and this week&apos;s lists
          sealed on Swarm. Pick who you want to be. A banner stays on top so you can switch, or leave the demo.
        </p>
      </section>

      <section aria-label="The main product" className="grid gap-5 md:grid-cols-2">
        <Role role={lead} big />
        <Role role={engineer} big />
      </section>
      <section aria-label="Also" className="grid gap-5 md:grid-cols-2">
        <Role role={link} />
        <Role role={fun} />
      </section>
    </div>
  );
}

function Role({ role, big }: { role: (typeof DEMO_ROLES)[number]; big?: boolean }) {
  return (
    <EnterDemo
      href={role.href}
      className={`group flex w-full flex-col items-start rounded-2xl border border-border bg-card text-left transition-colors hover:border-primary disabled:opacity-60 ${big ? "p-6 sm:p-7" : "p-5"}`}
    >
      <span className={`${big ? "text-2xl" : "text-lg"} font-semibold tracking-tight`}>{role.title}</span>
      <span className="mt-1.5 text-[15px] text-muted-foreground">{role.what}</span>
      <span className="mt-4 text-sm font-medium text-primary group-hover:underline">Open it</span>
    </EnterDemo>
  );
}

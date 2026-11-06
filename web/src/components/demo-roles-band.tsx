import { EnterDemo } from "@/components/demo";
import { DEMO_ROLES } from "@/lib/demo-roles";

const TAG: Record<string, string> = { lead: "Company", engineer: "My week" };
const GO: Record<string, string> = { lead: "Open the company page", engineer: "Open my week", link: "Open the shared link", fun: "Open AI Wrapped" };

/** "Look around Acme": pick who you want to be at the demo company. Each role opens its own space. */
export function DemoRolesBand({ id, heading = "h2", flush }: { id?: string; heading?: "h1" | "h2"; flush?: boolean }) {
  const [lead, engineer, link, fun] = DEMO_ROLES;
  const H = heading;
  return (
    <section id={id} className={`fd-band ${flush ? "fd-band-flush" : ""}`} aria-labelledby="demo-h">
      <div className="fd-wrap">
        <div className="fd-sec-head">
          <H id="demo-h" className="disp h-sec">
            Look around Acme
          </H>
          <p>
            Acme has 12 made-up people in three teams: Payments, Platform and Mobile. Five weeks of signed receipts are on Arkiv and this week&apos;s lists
            are sealed on Swarm. Pick who you want to be.
          </p>
        </div>
        <div className="fd-roles">
          <Role role={lead} big />
          <Role role={engineer} big />
          <Role role={link} />
          <Role role={fun} />
        </div>
        <p className="fd-band-note">A strip stays at the top of every demo page, so you can switch roles or leave the demo at any time.</p>
      </div>
    </section>
  );
}

function Role({ role, big }: { role: (typeof DEMO_ROLES)[number]; big?: boolean }) {
  return (
    <EnterDemo href={role.href} className={`fd-role ${big ? "big" : "small"}`}>
      {TAG[role.id] && <span className="fd-role-tag">{TAG[role.id]}</span>}
      <span className="fd-role-t">{role.title}</span>
      <span className="fd-role-d">{role.what}</span>
      <span className="fd-role-go">{GO[role.id]}</span>
    </EnterDemo>
  );
}

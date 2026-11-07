import { ChevronDown, Eye, Laptop, Lock } from "lucide-react";
import { ARKIV_SCHEMA_NAME } from "@/lib/receipts/arkiv";

/** Everything that leaves the laptop: where it goes and who can read it. Shared by the front door and How it works. */
export const FLOWS: [string, string, string][] = [
  ["Raw logs and prompts", "Nowhere. They stay in ~/.claude and ~/.codex on your laptop.", "Only you"],
  ["Session titles, file names, folders", "A local file in ~/.receipts, outside any repo", "Only you"],
  [
    "One session's trimmed prompts and the AI's last answers, when you click Write my week",
    "0G Private Computer in private mode, paid from your own 0G account: only models running inside a TEE can answer, and the TEE signature of every answer is checked",
    "The model inside a TEE. It reaches it over HTTPS through 0G's router, which is not end-to-end sealed today, so 0G's router could read it in transit",
  ],
  ["The list's titles, for the weekly summary", "The same private 0G model", "The same: the model in a TEE, and 0G's router in transit"],
  ["PR numbers and repo names", "GitHub API, with your own token", "GitHub (it already has them)"],
  ["Your signed totals, when you send your receipt", `Arkiv testnet, schema ${ARKIV_SCHEMA_NAME}, read-only and owned by you`, "Anyone. That is the point: the numbers can be checked"],
  ["Your list, PRs and AI records, when you send your receipt", "Swarm testnet, encrypted on your laptop; the key is sealed to your company's key on Arkiv", "Your company"],
  ["Your AI Wrapped card (numbers only)", "Nowhere, unless you post it", "Whoever you show it to"],
];

export function FlowsTable() {
  return (
    <div className="flows-box">
      <table className="flows" aria-label="What leaves your laptop, in full">
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Where it goes</th>
            <th scope="col">Who can read it</th>
          </tr>
        </thead>
        <tbody>
          {FLOWS.map(([a, b, c]) => (
            <tr key={a}>
              <td>{a}</td>
              <td>{b}</td>
              <td>{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The same week seen three ways, then the full table behind a disclosure (open on How it works). */
export function LeavesLaptop({ tableOpen }: { tableOpen?: boolean }) {
  return (
    <>
      <div className="fd-leaves">
        <Leave icon={<Laptop className="size-5" aria-hidden="true" />} title="Stays on your laptop" what="Only you can read these." items={["Raw logs in ~/.claude and ~/.codex", "Your prompts and the AI's answers", "Session titles, file names and folders"]} />
        <Leave
          icon={<Lock className="size-5" aria-hidden="true" />}
          title="Sealed for your company"
          what="Encrypted on your laptop, kept on Swarm. Only your company's key opens it."
          items={["The list of what you got done", "The pull requests behind it", "The private AI's records"]}
        />
        <Leave
          icon={<Eye className="size-5" aria-hidden="true" />}
          title="Public, so anyone can check"
          what="Signed totals on Arkiv. That is the point: the numbers can be checked."
          items={["Things done, by category", "AI spend, by tool", "Merged PRs and pushes to main"]}
        />
      </div>
      <p className="fd-footnote">
        To write your week, the private AI sees a trimmed summary of each session: what you asked and what the AI said at the end. The model runs inside a
        hardware enclave on 0G. Requests reach it through 0G&apos;s router, which is not end-to-end sealed today.
      </p>
      {tableOpen ? (
        <div className="mt-5">
          <FlowsTable />
        </div>
      ) : (
        <details className="fd-disclose">
          <summary>
            <span className="when-closed">See the full table</span>
            <span className="when-open">Hide the full table</span>
            <ChevronDown className="chev size-4" aria-hidden="true" />
          </summary>
          <FlowsTable />
        </details>
      )}
    </>
  );
}

function Leave({ icon, title, what, items }: { icon: React.ReactNode; title: string; what: string; items: string[] }) {
  return (
    <div className="fd-leave">
      <h3 className="fd-leave-h">
        {icon}
        {title}
      </h3>
      <p>{what}</p>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

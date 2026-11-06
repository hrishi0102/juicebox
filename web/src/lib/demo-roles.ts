// Who you can be at the demo company, Acme. Shared by the /demo page (server) and the demo banner
// (client), so it lives in a plain module.
export const DEMO_ROLES = [
  { id: "lead", href: "/company", title: "Be Acme's engineering lead", short: "the lead", what: "See everyone's signed week, the teams and the pull requests behind them." },
  { id: "engineer", href: "/me", title: "Be an engineer on Payments", short: "an engineer", what: "Write your week with the private AI, review what Acme will see, sign it and send it." },
  { id: "link", href: "/demo/link", title: "Be someone with a public link", short: "someone with a link", what: "What anyone sees: the signed totals and the checks, but not the list." },
  { id: "fun", href: "/wrapped", title: "Just for fun", short: "just for fun", what: "AI Wrapped and a week card for the demo person. Never sent to any company." },
] as const;

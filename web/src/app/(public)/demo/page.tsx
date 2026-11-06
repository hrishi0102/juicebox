import { DemoRolesBand } from "@/components/demo-roles-band";

export const metadata = { title: "Try the demo · Receipts" };

// Pick who you want to be at the demo company. Each role opens its own part of the app.
export default function DemoPicker() {
  return (
    <div className="fd">
      <DemoRolesBand heading="h1" flush />
    </div>
  );
}

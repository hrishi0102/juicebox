import Link from "next/link";
import { targetHow, type EmployeeTarget } from "@/lib/server/employee";

/** "You are @login. Your receipts go to Payments at Acme." Changing it is one click away. */
export function IdentityLine({ login, target }: { login?: string; target: EmployeeTarget }) {
  return (
    <p className="text-sm text-[var(--mute)]">
      {login ? (
        <>
          You are <span className="font-medium text-[var(--ink)]">@{login}</span> on GitHub.{" "}
        </>
      ) : (
        <>GitHub is not connected yet. </>
      )}
      {target.from === "default" ? (
        <>
          You have not joined your company yet.{" "}
          <Link href="/me/setup" className="quiet">
            Join it
          </Link>
        </>
      ) : (
        <>
          Your receipts go to{" "}
          <span className="font-medium text-[var(--ink)]">
            {target.teamName} at {target.orgName}
          </span>{" "}
          ({targetHow(target)}).{" "}
          {target.from !== "demo" && (
            <Link href="/me/setup" className="quiet">
              Change
            </Link>
          )}
        </>
      )}
    </p>
  );
}

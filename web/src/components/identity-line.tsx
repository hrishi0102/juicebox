import Link from "next/link";
import { targetHow, type EmployeeTarget } from "@/lib/server/employee";

/** "You are @login. Your receipts go to Payments at Acme." Changing it is one click away. */
export function IdentityLine({ login, target }: { login?: string; target: EmployeeTarget }) {
  return (
    <p className="text-sm text-muted-foreground">
      {login ? (
        <>
          You are <span className="font-medium text-foreground">@{login}</span> on GitHub.{" "}
        </>
      ) : (
        <>GitHub is not connected yet. </>
      )}
      {target.from === "default" ? (
        <>
          You have not joined your company yet.{" "}
          <Link href="/me/setup" className="text-primary hover:underline">
            Join it
          </Link>
        </>
      ) : (
        <>
          Your receipts go to{" "}
          <span className="font-medium text-foreground">
            {target.teamName} at {target.orgName}
          </span>{" "}
          ({targetHow(target)}).{" "}
          {target.from !== "demo" && (
            <Link href="/me/setup" className="text-primary hover:underline">
              Change
            </Link>
          )}
        </>
      )}
    </p>
  );
}

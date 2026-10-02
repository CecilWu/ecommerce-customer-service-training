import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth";
import { ApprenticeWorkspace } from "./ApprenticeWorkspace";

export default async function ApprenticeLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["APPRENTICE"]);

  return (
    <main className="role-theme role-apprentice">
      <AppHeader roleLabel="徒弟端" hideWorkspaceLink />
      <ApprenticeWorkspace>{children}</ApprenticeWorkspace>
    </main>
  );
}

import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth";
import { MentorSidebar } from "./MentorSidebar";

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["MASTER"]);

  return (
    <main className="role-theme role-mentor">
      <AppHeader roleLabel="师父端" />
      <div className="admin-shell">
        <MentorSidebar />
        <section className="admin-content">{children}</section>
      </div>
    </main>
  );
}

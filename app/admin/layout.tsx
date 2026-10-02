import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["ADMIN"]);

  return (
    <main className="role-theme role-admin">
      <AppHeader roleLabel="管理员" />
      <div className="admin-shell">
        <AdminSidebar />
        <section className="admin-content">{children}</section>
      </div>
    </main>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { ApprenticeSidebar } from "./ApprenticeSidebar";

export function ApprenticeWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = pathname.startsWith("/apprentice/training/");

  return (
    <div className={`admin-shell apprentice-shell ${immersive ? "apprentice-shell-immersive" : ""}`}>
      {immersive ? null : <ApprenticeSidebar />}
      <section className={`admin-content ${immersive ? "apprentice-training-content" : ""}`}>{children}</section>
    </div>
  );
}

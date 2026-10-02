"use client";

import { usePathname } from "next/navigation";

export function DeveloperFooter() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <footer className="developer-footer">
      <span>
        开发者：吴晓波{" "}
        <a href="https://www.5xiaobo.com" target="_blank" rel="noreferrer">
          www.5xiaobo.com
        </a>
      </span>
      <span>版本号：20260707</span>
      <span>浙ICP备14009446号</span>
      <span>浙公网安备33042102000238号</span>
    </footer>
  );
}

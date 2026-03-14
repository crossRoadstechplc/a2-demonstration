import type { ReactNode } from "react";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen px-3 py-3 md:px-4 md:py-4">
      <div className="mx-auto flex max-w-[1850px] gap-3 md:gap-4">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />
          <div className="dashboard-page">{children}</div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const DEFAULT_PRIMARY = "#059669";
const DEFAULT_PRIMARY_HOVER = "#047857";
const DEFAULT_SECONDARY = "#047857";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: company } = useQuery<{ primary_color: string | null; secondary_color: string | null }>({
    queryKey: ["company"],
    queryFn: async () => {
      const res = await api.get("/company");
      return res.data;
    },
    retry: false,
  });

  const primary = (company?.primary_color?.trim() || DEFAULT_PRIMARY).replace(/^#?/, "#");
  const secondary = (company?.secondary_color?.trim() || DEFAULT_SECONDARY).replace(/^#?/, "#");
  const primaryHover = secondary !== primary ? secondary : DEFAULT_PRIMARY_HOVER;

  const style = {
    ["--brand-primary" as string]: primary,
    ["--brand-primary-hover" as string]: primaryHover,
    ["--brand-secondary" as string]: secondary,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen flex bg-page text-slate-900 dark:text-slate-100" style={style}>
      {/* Mobile overlay when sidebar open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 p-4 md:p-6 min-h-0">
          <div className="mx-auto max-w-6xl space-y-4 w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}


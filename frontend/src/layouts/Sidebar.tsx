import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";
import { useFeatureFlags } from "@/features/feature-flags/useFeatureFlags";

const accountingNavItems: { to: string; label: string; key: string }[] = [
  { to: "/invoices", label: "Invoices", key: "invoices" },
  { to: "/customers", label: "Customers", key: "customers" },
  { to: "/statements", label: "Statements", key: "statements" },
  { to: "/expenses", label: "Expenses", key: "expenses" },
  { to: "/reports", label: "Reports", key: "reports" },
  { to: "/banking", label: "Banking", key: "banking" },
  { to: "/payslips", label: "Payslips", key: "payslips" },
  { to: "/accounts", label: "Chart of accounts", key: "accounts" },
];

const salesNavItems: { to: string; label: string; key: string }[] = [
  { to: "/sales/leads", label: "Leads", key: "leads" },
  { to: "/sales/proposals", label: "Proposals", key: "proposals" },
  { to: "/sales/contracts", label: "Contracts", key: "contracts" },
  { to: "/sales/pitch-decks", label: "Pitch decks", key: "pitch_decks" },
  { to: "/sales/pipeline", label: "Pipeline", key: "pipeline" },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { user } = useAuthStore();
  const role = user?.role;
  const { isEnabled } = useFeatureFlags();

  const { data: company } = useQuery<{ name: string; logo_url: string | null }>({
    queryKey: ["company"],
    queryFn: async () => {
      const res = await api.get("/company");
      return res.data;
    },
    retry: false,
  });
  const companyName = company?.name ?? "Company";
  const logoUrl = company?.logo_url?.trim();

  const navItems: { to: string; label: string }[] = [];
  if (role && ["admin", "accountant", "viewer", "hr", "sales", "superadmin"].includes(role) && isEnabled("dashboard")) {
    navItems.push({ to: "/dashboard", label: "Dashboard" });
  }
  if (role && ["admin", "accountant", "viewer", "superadmin"].includes(role)) {
    accountingNavItems
      .filter((item) => isEnabled(item.key))
      .filter((item) => item.key !== "payslips" || (role !== "viewer")) // Payslips: accountant/admin only
      .forEach((item) => navItems.push({ to: item.to, label: item.label }));
  }
  if (role && ["admin", "sales", "superadmin"].includes(role)) {
    salesNavItems.filter((item) => isEnabled(item.key)).forEach((item) => navItems.push({ to: item.to, label: item.label }));
  }
  if (role && ["admin", "hr", "superadmin"].includes(role) && isEnabled("hr")) {
    navItems.push({ to: "/employees", label: "HR" });
  }
  if (role && ["admin", "superadmin"].includes(role) && isEnabled("settings")) {
    navItems.push({ to: "/settings", label: "Settings" });
  }
  if (role && ["admin", "superadmin"].includes(role) && isEnabled("team")) {
    navItems.push({ to: "/team", label: "Team" });
  }
  if (role === "employee" && isEnabled("portal")) {
    navItems.push({ to: "/portal", label: "My portal" });
  }
  if (role === "superadmin") {
    navItems.push({ to: "/superadmin", label: "Superadmin" });
  }
  if (role && role !== "superadmin" && isEnabled("profile")) {
    navItems.push({ to: "/profile", label: "Profile" });
  }

  const navContent = (
    <>
      <div className="h-14 sm:h-16 flex items-center justify-between gap-3 px-4 md:px-6 border-b border-slate-200 dark:border-slate-700 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded object-contain bg-slate-50/80 dark:bg-slate-700/50"
            />
          ) : null}
          <div className="flex flex-col justify-center min-w-0">
            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate leading-tight">
              {companyName}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
              Powered by SmartSeen
            </span>
          </div>
        </div>
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onMobileClose}
            className={({ isActive }) =>
              [
                "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] md:min-h-0 md:py-2",
                isActive
                  ? "bg-brand-primary text-white hover:bg-brand-primary-hover"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop: always visible from md up */}
      <aside className="hidden md:flex md:flex-col w-64 border-r border-slate-200 dark:border-slate-700 bg-sidebar shrink-0 shadow-apple">
        {navContent}
      </aside>
      {/* Mobile: slide-out drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] flex flex-col border-r border-slate-200 dark:border-slate-700 bg-sidebar shadow-xl transition-transform duration-200 ease-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        {navContent}
      </aside>
    </>
  );
}


import { useNavigate } from "react-router-dom";
import { CompanySwitcher } from "@/components/common/CompanySwitcher";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useAuthStore } from "@/store/authStore";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <header className="flex items-center justify-between h-14 sm:h-16 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 sm:px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 -ml-1"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <CompanySwitcher />
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <ThemeToggle />
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] md:min-h-0 shadow-apple"
        >
          Logout
        </button>
      </div>
    </header>
  );
}


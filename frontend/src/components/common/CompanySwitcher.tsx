import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

interface TenantSummary {
  id: number;
  name: string;
  slug: string;
  status: string;
}

function decodeAccessToken(token: string): { tenantId: number } | null {
  try {
    const [, payloadPart] = token.split(".");
    const payloadJson = atob(payloadPart);
    const payload = JSON.parse(payloadJson) as { tenant_id?: number };
    if (payload.tenant_id == null) return null;
    return { tenantId: Number(payload.tenant_id) };
  } catch {
    return null;
  }
}

export function CompanySwitcher() {
  const { user, tenantId, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isSuperadmin = user?.role === "superadmin";

  const { data: tenants = [] } = useQuery<TenantSummary[]>({
    queryKey: ["admin", "tenants"],
    queryFn: async () => {
      const res = await api.get("/admin/tenants");
      return res.data;
    },
    enabled: isSuperadmin,
  });

  const currentTenantId = tenantId ? Number(tenantId) : null;
  const currentTenant = tenants.find((t) => t.id === currentTenantId);
  const currentName = currentTenant?.name ?? (currentTenantId ? `Company #${currentTenantId}` : "Select company");

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const handleSelect = async (tenant: TenantSummary) => {
    if (tenant.id === currentTenantId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await api.post("/admin/switch-tenant", { tenant_id: tenant.id });
      const newToken = res.data?.access_token;
      if (typeof newToken !== "string") throw new Error("Invalid response");
      const decoded = decodeAccessToken(newToken);
      if (!decoded) throw new Error("Invalid token");
      setAuth({
        accessToken: newToken,
        tenantId: String(decoded.tenantId),
      });
      setOpen(false);
      queryClient.clear();
      navigate("/superadmin", { replace: true });
    } catch {
      setSwitching(false);
    } finally {
      setSwitching(false);
    }
  };

  if (!isSuperadmin) return null;

  return (
    <div className="relative min-w-0 max-w-[200px] sm:max-w-[240px]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className="inline-flex items-center gap-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 min-h-[44px] md:min-h-[36px] text-left text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-70"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Switch company"
      >
        <span className="truncate">{currentName}</span>
        <span className="shrink-0 text-slate-400" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {tenants.map((t) => (
            <li key={t.id} role="option" aria-selected={t.id === currentTenantId}>
              <button
                type="button"
                onClick={() => handleSelect(t)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 ${
                  t.id === currentTenantId ? "bg-emerald-50 text-emerald-800 font-medium" : "text-slate-700"
                }`}
              >
                <span className="block truncate">{t.name}</span>
                {t.status !== "active" && (
                  <span className="block truncate text-xs text-amber-600">{t.status}</span>
                )}
              </button>
            </li>
          ))}
          {tenants.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">No companies</li>
          )}
        </ul>
      )}
    </div>
  );
}

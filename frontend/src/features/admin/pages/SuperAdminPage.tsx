import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

interface TenantSummary {
  id: number;
  name: string;
  slug: string;
  status: "active" | "suspended";
}

interface TenantUserInfo {
  id: number;
  user_id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_owner: boolean;
}

interface FeatureFlagItem {
  key: string;
  enabled: boolean;
  description?: string | null;
}

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  invoices: "Invoices",
  expenses: "Expenses",
  reports: "Reports",
  banking: "Banking",
  accounts: "Chart of accounts",
  leads: "Leads",
  proposals: "Proposals",
  contracts: "Contracts",
  pitch_decks: "Pitch decks",
  pipeline: "Pipeline",
  hr: "HR (Employees)",
  settings: "Settings",
  team: "Team",
  profile: "Profile",
  portal: "Employee portal",
};

/** Group flags for the UI: Accounting and Sales show sub-selection below a heading. */
const FEATURE_GROUPS: { heading: string; keys: string[] }[] = [
  { heading: "Accounting", keys: ["invoices", "expenses", "reports", "banking", "accounts"] },
  { heading: "Sales", keys: ["leads", "proposals", "contracts", "pitch_decks", "pipeline"] },
  { heading: "Other", keys: ["dashboard", "hr", "settings", "team", "profile", "portal"] },
];

type SuperAdminTab = "feature-unlock" | "tenants";

export function SuperAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SuperAdminTab>("feature-unlock");
  const [manageTenant, setManageTenant] = useState<TenantSummary | null>(null);
  const [resettingUser, setResettingUser] = useState<{ user: TenantUserInfo; tenant: TenantSummary } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data, isLoading, isError } = useQuery<TenantSummary[]>({
    queryKey: ["superadmin", "tenants"],
    queryFn: async () => {
      const res = await api.get("/admin/tenants");
      return res.data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ tenantId, status }: { tenantId: number; status: "active" | "suspended" }) => {
      await api.patch(`/admin/tenants/${tenantId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
      setManageTenant(null);
    },
  });

  const resetPassword = useMutation({
    mutationFn: async ({
      tenantId,
      userId,
      newPassword,
    }: {
      tenantId: number;
      userId: number;
      newPassword: string;
    }) => {
      await api.post("/admin/reset-password", {
        tenant_id: tenantId,
        user_id: userId,
        new_password: newPassword,
      });
    },
    onSuccess: () => {
      setResettingUser(null);
      setNewPassword("");
      if (manageTenant) {
        queryClient.invalidateQueries({ queryKey: ["superadmin", "tenant-users", manageTenant.id] });
      }
    },
  });

  const { data: featureFlags = [], isLoading: flagsLoading } = useQuery<FeatureFlagItem[]>({
    queryKey: ["admin", "feature-flags"],
    queryFn: async () => {
      const res = await api.get("/admin/feature-flags");
      return res.data;
    },
  });

  const updateFlag = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      await api.patch(`/admin/feature-flags/${key}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    },
  });

  const tenants = data ?? [];
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const suspendedTenants = tenants.filter((t) => t.status === "suspended").length;

  const tabs = [
    { id: "feature-unlock" as const, label: "Feature Unlock" },
    { id: "tenants" as const, label: "Tenants" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Superadmin</h1>
        <p className="text-sm text-muted-foreground">
          Feature flags and tenant management for SmartSeen.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-1" aria-label="Superadmin sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-brand-primary text-brand-primary bg-slate-50 dark:bg-slate-800/50 dark:text-brand-primary"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "feature-unlock" && (
      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Enable or disable platform features for all tenants. Disabled features are hidden from the sidebar and inaccessible until turned on.
        </p>
        {flagsLoading ? (
          <p className="text-sm text-muted-foreground">Loading feature flags…</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple-md">
            {FEATURE_GROUPS.map((group) => {
              const flagsInGroup = featureFlags.filter((f) => group.keys.includes(f.key));
              if (flagsInGroup.length === 0) return null;
              return (
                <div key={group.heading} className="border-b border-slate-200 last:border-b-0">
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{group.heading}</h3>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {flagsInGroup.map((flag) => (
                      <li key={flag.key} className="flex items-center justify-between gap-4 px-4 py-2.5 pl-6">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{FEATURE_LABELS[flag.key] ?? flag.key}</p>
                          {flag.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{flag.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={flag.enabled}
                          aria-label={`${flag.enabled ? "Disable" : "Enable"} ${flag.key}`}
                          disabled={updateFlag.isPending && (updateFlag.variables?.key === flag.key)}
                          onClick={() => updateFlag.mutate({ key: flag.key, enabled: !flag.enabled })}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 ${
                            flag.enabled ? "bg-brand-primary" : "bg-slate-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                              flag.enabled ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {activeTab === "tenants" && (
      <section className="space-y-4">
      {isLoading && <p className="text-sm text-muted-foreground">Loading tenants…</p>}
      {isError && (
        <p className="text-sm text-red-500">
          Failed to load tenants. Ensure you are logged in as a superadmin and
          that the backend is running.
        </p>
      )}

      {!isLoading && !isError && totalTenants > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total tenants
            </p>
            <p className="mt-2 text-2xl font-semibold">{totalTenants}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Active
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">{activeTenants}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Suspended
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-600">{suspendedTenants}</p>
          </div>
        </div>
      )}

      {tenants.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Slug</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{tenant.name}</td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{tenant.slug}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        tenant.status === "active"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus.mutate({
                            tenantId: tenant.id,
                            status: tenant.status === "active" ? "suspended" : "active",
                          })
                        }
                        disabled={updateStatus.isPending}
                        className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                      >
                        {tenant.status === "active" ? "Suspend" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setManageTenant(tenant)}
                        className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        Manage users
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !isError && totalTenants === 0 && (
        <p className="text-sm text-muted-foreground">No tenants found yet.</p>
      )}
      </section>
      )}

      {manageTenant && (
        <ManageTenantUsersModal
          tenant={manageTenant}
          onClose={() => setManageTenant(null)}
          onResetPassword={(user) => setResettingUser({ user, tenant: manageTenant })}
        />
      )}

      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser.user}
          tenant={resettingUser.tenant}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          onClose={() => {
            setResettingUser(null);
            setNewPassword("");
          }}
          onSubmit={() => {
            resetPassword.mutate({
              tenantId: resettingUser.tenant.id,
              userId: resettingUser.user.user_id,
              newPassword,
            });
          }}
          isSubmitting={resetPassword.isPending}
        />
      )}
    </div>
  );
}

function ManageTenantUsersModal({
  tenant,
  onClose,
  onResetPassword,
}: {
  tenant: TenantSummary;
  onClose: () => void;
  onResetPassword: (user: TenantUserInfo) => void;
}) {
  const { data: users, isLoading } = useQuery<TenantUserInfo[]>({
    queryKey: ["superadmin", "tenant-users", tenant.id],
    queryFn: async () => {
      const res = await api.get(`/admin/tenants/${tenant.id}/users`);
      return res.data;
    },
    enabled: !!tenant.id,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-apple-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-lg font-semibold">Users: {tenant.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading users…</p>
        ) : (
          <div className="max-h-96 overflow-y-auto py-2">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Email</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Role</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="py-2 font-medium">{u.email}</td>
                    <td className="py-2 text-muted-foreground">{u.full_name ?? ""}</td>
                    <td className="py-2">
                      <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-200">{u.role}</span>
                      {u.is_owner && (
                        <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          owner
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => onResetPassword(u)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Reset password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ResetPasswordModal({
  user,
  tenant,
  newPassword,
  setNewPassword,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  user: TenantUserInfo;
  tenant: TenantSummary;
  newPassword: string;
  setNewPassword: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-apple-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Reset password</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.email} ({tenant.name})
        </p>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Enter new password"
            autoComplete="new-password"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!newPassword.trim() || isSubmitting}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

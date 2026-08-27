import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

interface CompanyUserRead {
  id: number;
  user_id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_owner: boolean;
}

const ROLES = ["admin", "accountant", "hr", "viewer", "sales", "employee"] as const;

export function TeamPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<CompanyUserRead | null>(null);
  const [removingUser, setRemovingUser] = useState<CompanyUserRead | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [editRole, setEditRole] = useState<string>("viewer");

  const { data: users, isLoading, isError } = useQuery<CompanyUserRead[]>({
    queryKey: ["company", "users"],
    queryFn: async () => {
      const res = await api.get("/company/users");
      return res.data;
    },
  });

  const createUser = useMutation({
    mutationFn: async (payload: { email: string; full_name?: string; password: string; role: string }) => {
      const res = await api.post("/company/users", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", "users"] });
      setShowForm(false);
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("viewer");
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ tenantUserId, role }: { tenantUserId: number; role: string }) => {
      await api.patch(`/company/users/${tenantUserId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", "users"] });
      setEditingUser(null);
    },
  });

  const removeUser = useMutation({
    mutationFn: async (tenantUserId: number) => {
      await api.delete(`/company/users/${tenantUserId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", "users"] });
      setRemovingUser(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate({
      email: email.trim(),
      full_name: fullName.trim() || undefined,
      password,
      role: role || "viewer",
    });
  };

  const handleEditRole = () => {
    if (!editingUser) return;
    updateUserRole.mutate({ tenantUserId: editingUser.id, role: editRole });
  };

  const handleRemoveConfirm = () => {
    if (!removingUser) return;
    removeUser.mutate(removingUser.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage users in your company. New users are added as employees automatically. Only company admins can add or change users.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add user
        </button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading users…</p>}
      {isError && (
        <p className="text-sm text-red-500">
          Failed to load users. Ensure you are logged in as a company admin.
        </p>
      )}

      {users && users.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium">{u.email}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.full_name ?? ""}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-800 dark:text-slate-200">{u.role}</span>
                  </td>
                  <td className="px-4 py-2">{u.is_owner ? "Yes" : ""}</td>
                  <td className="px-4 py-2">
                    {!u.is_owner && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(u);
                            setEditRole(u.role);
                          }}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Edit role
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemovingUser(u)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {users && users.length === 0 && !isLoading && !isError && (
        <p className="text-sm text-muted-foreground">No users yet. Add a user to get started.</p>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Add user</h2>
            <p className="mt-1 text-xs text-slate-500">They will be added as an employee automatically.</p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="user@company.com"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Full name (optional)
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Jane Doe"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="••••••••"
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Role
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              {createUser.isError && (
                <p className="text-sm text-red-500">
                  {(createUser.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                    "Failed to create user"}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUser.isPending || !email.trim() || !password}
                  className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {createUser.isPending ? "Creating…" : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingUser(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Edit role</h2>
            <p className="mt-1 text-sm text-slate-600">{editingUser.email}</p>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Role
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            {updateUserRole.isError && (
              <p className="mt-2 text-sm text-red-500">
                {(updateUserRole.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to update"}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditRole}
                disabled={updateUserRole.isPending || editRole === editingUser.role}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {updateUserRole.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {removingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRemovingUser(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Remove from company</h2>
            <p className="mt-2 text-sm text-slate-600">
              Remove <strong>{removingUser.email}</strong> from this company? They will no longer be able to sign in to this company. Their employee record is kept for history.
            </p>
            {removeUser.isError && (
              <p className="mt-2 text-sm text-red-500">
                {(removeUser.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to remove"}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemovingUser(null)}
                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveConfirm}
                disabled={removeUser.isPending}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removeUser.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

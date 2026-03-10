import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/axios";

interface Customer {
  id: number;
  name: string;
  email: string | null;
  address: string | null;
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await api.get("/customers/");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; email?: string; address?: string }) => {
      await api.post("/customers/", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCreateOpen(false);
      setFormName("");
      setFormEmail("");
      setFormAddress("");
      setFormError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: { name?: string; email?: string; address?: string } }) => {
      await api.patch(`/customers/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setEditingId(null);
      setFormError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeleteConfirmId(null);
    },
  });

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setFormName(c.name);
    setFormEmail(c.email ?? "");
    setFormAddress(c.address ?? "");
    setFormError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    createMutation.mutate({
      name,
      email: formEmail.trim() || undefined,
      address: formAddress.trim() || undefined,
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId == null) return;
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    updateMutation.mutate({
      id: editingId,
      body: {
        name,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Customers</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Manage customer details. Use them when creating invoices or view their statements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setFormName("");
            setFormEmail("");
            setFormAddress("");
            setFormError(null);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-hover"
        >
          + Add customer
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading customers…</div>
        ) : !customers?.length ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            No customers yet. Add one to use when creating invoices.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60">
                <tr>
                  <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Address</th>
                  <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pl-4 font-medium text-slate-800 dark:text-slate-200">{c.name}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{c.email ?? "—"}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={c.address ?? undefined}>{c.address ?? "—"}</td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/statements?customer_id=${c.id}`}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                        >
                          Statement
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(c.id)}
                          className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setCreateOpen(false)}>
          <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New customer</h2>
            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="Acme Inc"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="billing@acme.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="123 Main St"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEditingId(null)}>
          <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit customer</h2>
            <form onSubmit={handleUpdateSubmit} className="mt-4 space-y-4">
              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="Acme Inc"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="billing@acme.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="123 Main St"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={updateMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirmId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Delete customer?</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This cannot be undone. Invoices linked to this customer will keep the customer name but will no longer reference the customer record.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

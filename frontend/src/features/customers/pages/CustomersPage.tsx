import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/axios";
import type { CustomerPayload, CustomerType } from "@/features/invoices/components/CreateCustomerModal";

interface Customer {
  id: number;
  customer_type: CustomerType;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_name: string | null;
  registration_number: string | null;
  vat_number: string | null;
  id_number: string | null;
}

const emptyForm = () => ({
  customerType: "company" as CustomerType,
  name: "",
  email: "",
  phone: "",
  address: "",
  contactName: "",
  registrationNumber: "",
  vatNumber: "",
  idNumber: "",
});

const inputClass =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100";

function CustomerFormFields({
  form,
  setForm,
}: {
  form: ReturnType<typeof emptyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
}) {
  const isCompany = form.customerType === "company";
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Billed as *</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, customerType: "company" }))}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              isCompany
                ? "border-brand-primary bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
            }`}
          >
            Company
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, customerType: "individual" }))}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              !isCompany
                ? "border-brand-primary bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
            }`}
          >
            Individual
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
          {isCompany ? "Company name *" : "Full name *"}
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={inputClass}
          placeholder={isCompany ? "Acme (Pty) Ltd" : "Jane Smith"}
        />
      </div>
      {isCompany && (
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Contact person</label>
          <input
            type="text"
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            className={inputClass}
            placeholder="Accounts payable contact"
          />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
            placeholder={isCompany ? "billing@acme.com" : "jane@email.com"}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className={inputClass}
            placeholder="+27 …"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Billing address</label>
        <textarea
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          rows={2}
          className={inputClass}
          placeholder="Street, city, postal code"
        />
      </div>
      {isCompany ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Registration number
            </label>
            <input
              type="text"
              value={form.registrationNumber}
              onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
              className={inputClass}
              placeholder="CIPC / company reg."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">VAT number</label>
            <input
              type="text"
              value={form.vatNumber}
              onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
              className={inputClass}
              placeholder="VAT / tax number"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              ID / passport number
            </label>
            <input
              type="text"
              value={form.idNumber}
              onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
              className={inputClass}
              placeholder="National ID or passport"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">VAT number</label>
            <input
              type="text"
              value={form.vatNumber}
              onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
              className={inputClass}
              placeholder="If VAT-registered"
            />
          </div>
        </div>
      )}
    </>
  );
}

function formToPayload(form: ReturnType<typeof emptyForm>): CustomerPayload {
  const isCompany = form.customerType === "company";
  return {
    customer_type: form.customerType,
    name: form.name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    address: form.address.trim() || undefined,
    contact_name: isCompany ? form.contactName.trim() || undefined : undefined,
    registration_number: isCompany ? form.registrationNumber.trim() || undefined : undefined,
    vat_number: form.vatNumber.trim() || undefined,
    id_number: !isCompany ? form.idNumber.trim() || undefined : undefined,
  };
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await api.get("/customers/");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: CustomerPayload) => {
      await api.post("/customers/", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCreateOpen(false);
      setForm(emptyForm());
      setFormError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: CustomerPayload }) => {
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
    setForm({
      customerType: c.customer_type === "individual" ? "individual" : "company",
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: c.address ?? "",
      contactName: c.contact_name ?? "",
      registrationNumber: c.registration_number ?? "",
      vatNumber: c.vat_number ?? "",
      idNumber: c.id_number ?? "",
    });
    setFormError(null);
  };

  const validateAndBuild = (): CustomerPayload | null => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError(form.customerType === "company" ? "Company name is required." : "Full name is required.");
      return null;
    }
    return formToPayload(form);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = validateAndBuild();
    if (!body) return;
    createMutation.mutate(body);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId == null) return;
    const body = validateAndBuild();
    if (!body) return;
    updateMutation.mutate({ id: editingId, body });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Customers</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Manage billing details for individuals and companies. Use them when creating invoices or view their statements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setForm(emptyForm());
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
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">VAT / Reg</th>
                  <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pl-4 font-medium text-slate-800 dark:text-slate-200">
                      <div>{c.name}</div>
                      {c.customer_type === "company" && c.contact_name && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">{c.contact_name}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 capitalize">
                      {c.customer_type === "individual" ? "Individual" : "Company"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{c.email ?? "—"}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{c.phone ?? "—"}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {c.vat_number || c.registration_number || c.id_number || "—"}
                    </td>
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

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setCreateOpen(false)}>
          <div
            className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New customer</h2>
            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
              <CustomerFormFields form={form} setForm={setForm} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEditingId(null)}>
          <div
            className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit customer</h2>
            <form onSubmit={handleUpdateSubmit} className="mt-4 space-y-4">
              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
              <CustomerFormFields form={form} setForm={setForm} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={updateMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

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

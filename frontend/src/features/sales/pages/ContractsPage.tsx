import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";
import { formatAmount } from "@/lib/currency";

const contractSchema = z.object({
  proposal_id: z.coerce.number().int().positive().optional().nullable(),
  lead_id: z.coerce.number().int().positive().optional().nullable(),
  title: z.string().min(1, "Title is required"),
  party_name: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  value: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().optional(),
  document_url: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

type ContractFormValues = z.infer<typeof contractSchema>;

interface Contract {
  id: number;
  proposal_id: number | null;
  lead_id: number | null;
  title: string;
  party_name: string | null;
  start_date: string | null;
  end_date: string | null;
  value: number | null;
  currency: string | null;
  document_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: number;
  name: string;
}

const STATUS_OPTIONS = ["draft", "active", "expired"];

export function ContractsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ["sales", "contracts"],
    queryFn: async () => {
      const res = await api.get("/sales/contracts");
      return res.data;
    },
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["sales", "leads"],
    queryFn: async () => {
      const res = await api.get("/sales/leads");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ContractFormValues) => {
      const res = await api.post("/sales/contracts", {
        ...values,
        start_date: values.start_date || undefined,
        end_date: values.end_date || undefined,
        value: values.value ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "contracts"] });
      setModalOpen(false);
      reset(defaultValues);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: ContractFormValues }) => {
      const res = await api.put(`/sales/contracts/${id}`, {
        ...values,
        start_date: values.start_date || undefined,
        end_date: values.end_date || undefined,
        value: values.value ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "contracts"] });
      setModalOpen(false);
      setEditingId(null);
      reset(defaultValues);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sales/contracts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "contracts"] }),
  });

  const defaultValues: ContractFormValues = {
    proposal_id: undefined,
    lead_id: undefined,
    title: "",
    party_name: "",
    start_date: "",
    end_date: "",
    value: undefined,
    currency: "ZAR",
    document_url: "",
    status: "draft",
    notes: "",
  };

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues,
  });

  const openCreate = () => {
    setEditingId(null);
    reset(defaultValues);
    setModalOpen(true);
  };

  const openEdit = (c: Contract) => {
    setEditingId(c.id);
    reset({
      proposal_id: c.proposal_id ?? undefined,
      lead_id: c.lead_id ?? undefined,
      title: c.title,
      party_name: c.party_name ?? "",
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      value: c.value ?? undefined,
      currency: c.currency ?? "ZAR",
      document_url: c.document_url ?? "",
      status: c.status,
      notes: c.notes ?? "",
    });
    setModalOpen(true);
  };

  const onSubmit = (values: ContractFormValues) => {
    if (editingId != null) {
      updateMutation.mutate({ id: editingId, values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Contracts</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Store and manage signed contracts. Link to deals and renewals.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-hover"
        >
          + Add contract
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading…</div>
        ) : !contracts?.length ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">No contracts yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60">
                <tr>
                  <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Title</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Party</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Period</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Value</th>
                  <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pl-4 font-medium text-slate-800 dark:text-slate-200">{c.title}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{c.party_name ?? ""}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {c.start_date ?? ""} {c.end_date ? `→ ${c.end_date}` : ""}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{c.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800 dark:text-slate-200">
                      {c.value != null ? formatAmount(c.value, c.currency ?? "ZAR") : ""}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {c.document_url && (
                        <a href={c.document_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-primary hover:underline mr-2">View</a>
                      )}
                      <button type="button" onClick={() => openEdit(c)} className="text-xs font-medium text-brand-primary hover:underline mr-2">Edit</button>
                      <button type="button" onClick={() => window.confirm("Delete this contract?") && deleteMutation.mutate(c.id)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 dark:border-slate-600 px-6 py-4 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingId != null ? "Edit contract" : "Add contract"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input {...register("title")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                {errors.title && <p className="mt-0.5 text-xs text-red-500">{errors.title.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Party name</label>
                <input {...register("party_name")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" placeholder="Customer or lead name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lead</label>
                <select {...register("lead_id")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  <option value="">None</option>
                  {(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start date</label>
                  <input type="date" {...register("start_date")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End date</label>
                  <input type="date" {...register("end_date")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Value</label>
                  <input type="number" step="0.01" min={0} {...register("value")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Currency</label>
                  <select {...register("currency")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    <option value="ZAR">ZAR</option>
                    <option value="USD">USD</option>
                    <option value="LSL">LSL</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select {...register("status")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Document URL</label>
                <input type="url" {...register("document_url")} placeholder="https://..." className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea {...register("notes")} rows={2} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50">
                  {editingId != null ? "Save" : "Add contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

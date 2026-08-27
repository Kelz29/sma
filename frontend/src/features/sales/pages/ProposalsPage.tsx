import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";
import { formatAmount } from "@/lib/currency";

const proposalSchema = z.object({
  lead_id: z.coerce.number().int().positive().optional().nullable(),
  title: z.string().min(1, "Title is required"),
  status: z.string().optional(),
  value: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

type ProposalFormValues = z.infer<typeof proposalSchema>;

interface Proposal {
  id: number;
  lead_id: number | null;
  title: string;
  status: string;
  value: number | null;
  currency: string | null;
  notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: number;
  name: string;
}

const STATUS_OPTIONS = ["draft", "sent", "accepted", "declined"];

export function ProposalsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: proposals, isLoading } = useQuery<Proposal[]>({
    queryKey: ["sales", "proposals"],
    queryFn: async () => {
      const res = await api.get("/sales/proposals");
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
    mutationFn: async (values: ProposalFormValues) => {
      const res = await api.post("/sales/proposals", {
        ...values,
        lead_id: values.lead_id ?? undefined,
        value: values.value ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "proposals"] });
      setModalOpen(false);
      reset(defaultValues);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: ProposalFormValues }) => {
      const res = await api.put(`/sales/proposals/${id}`, {
        ...values,
        lead_id: values.lead_id ?? undefined,
        value: values.value ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "proposals"] });
      setModalOpen(false);
      setEditingId(null);
      reset(defaultValues);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sales/proposals/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "proposals"] }),
  });

  const defaultValues: ProposalFormValues = {
    lead_id: undefined,
    title: "",
    status: "draft",
    value: undefined,
    currency: "ZAR",
    notes: "",
  };

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues,
  });

  const openCreate = () => {
    setEditingId(null);
    reset(defaultValues);
    setModalOpen(true);
  };

  const openEdit = (p: Proposal) => {
    setEditingId(p.id);
    reset({
      lead_id: p.lead_id ?? undefined,
      title: p.title,
      status: p.status,
      value: p.value ?? undefined,
      currency: p.currency ?? "ZAR",
      notes: p.notes ?? "",
    });
    setModalOpen(true);
  };

  const onSubmit = (values: ProposalFormValues) => {
    if (editingId != null) {
      updateMutation.mutate({ id: editingId, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const getLeadName = (leadId: number | null) => {
    if (leadId == null) return "";
    return leads?.find((l) => l.id === leadId)?.name ?? `Lead #${leadId}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Proposals</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Create and send proposals. Track versions and acceptance status.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-hover"
        >
          + Add proposal
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading…</div>
        ) : !proposals?.length ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">No proposals yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60">
                <tr>
                  <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Title</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lead</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Value</th>
                  <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proposals.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pl-4 font-medium text-slate-800 dark:text-slate-200">{p.title}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{getLeadName(p.lead_id)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{p.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800 dark:text-slate-200">
                      {p.value != null ? formatAmount(p.value, p.currency ?? "ZAR") : ""}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button type="button" onClick={() => openEdit(p)} className="text-xs font-medium text-brand-primary hover:underline mr-2">Edit</button>
                      <button type="button" onClick={() => window.confirm("Delete this proposal?") && deleteMutation.mutate(p.id)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
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
          <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 dark:border-slate-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingId != null ? "Edit proposal" : "Add proposal"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input {...register("title")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                {errors.title && <p className="mt-0.5 text-xs text-red-500">{errors.title.message}</p>}
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select {...register("status")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Value</label>
                <input type="number" step="0.01" min={0} {...register("value")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea {...register("notes")} rows={2} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50">
                  {editingId != null ? "Save" : "Add proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

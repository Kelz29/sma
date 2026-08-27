import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";
import { formatAmount } from "@/lib/currency";

const dealSchema = z.object({
  lead_id: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().min(1, "Deal name is required"),
  stage: z.string().optional(),
  value: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().optional(),
  expected_close_date: z.string().optional(),
  notes: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

interface Deal {
  id: number;
  lead_id: number | null;
  name: string;
  stage: string;
  value: number | null;
  currency: string | null;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: number;
  name: string;
}

const STAGE_OPTIONS = ["qualified", "proposal", "negotiation", "won", "lost"];

export function PipelinePage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("");

  const { data: deals, isLoading } = useQuery<Deal[]>({
    queryKey: ["sales", "pipeline"],
    queryFn: async () => {
      const res = await api.get("/sales/pipeline");
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
    mutationFn: async (values: DealFormValues) => {
      const res = await api.post("/sales/pipeline", {
        ...values,
        lead_id: values.lead_id ?? undefined,
        value: values.value ?? undefined,
        expected_close_date: values.expected_close_date || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "pipeline"] });
      setModalOpen(false);
      reset(defaultValues);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: DealFormValues }) => {
      const res = await api.put(`/sales/pipeline/${id}`, {
        ...values,
        lead_id: values.lead_id ?? undefined,
        value: values.value ?? undefined,
        expected_close_date: values.expected_close_date || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "pipeline"] });
      setModalOpen(false);
      setEditingId(null);
      reset(defaultValues);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sales/pipeline/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "pipeline"] }),
  });

  const defaultValues: DealFormValues = {
    lead_id: undefined,
    name: "",
    stage: "qualified",
    value: undefined,
    currency: "ZAR",
    expected_close_date: "",
    notes: "",
  };

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues,
  });

  const openCreate = () => {
    setEditingId(null);
    reset(defaultValues);
    setModalOpen(true);
  };

  const openEdit = (d: Deal) => {
    setEditingId(d.id);
    reset({
      lead_id: d.lead_id ?? undefined,
      name: d.name,
      stage: d.stage,
      value: d.value ?? undefined,
      currency: d.currency ?? "ZAR",
      expected_close_date: d.expected_close_date ?? "",
      notes: d.notes ?? "",
    });
    setModalOpen(true);
  };

  const onSubmit = (values: DealFormValues) => {
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

  const filteredDeals = stageFilter ? (deals ?? []).filter((d) => d.stage === stageFilter) : (deals ?? []);
  const totalValue = filteredDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Sales pipeline</h1>
          <p className="mt-0.5 text-sm text-slate-500">View and move deals through stages. Forecast by stage and value.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-hover"
        >
          + Add deal
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/60 px-4 py-3 flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter by stage</span>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200"
        >
          <option value="">All stages</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {filteredDeals.length > 0 && (
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Total value: {formatAmount(totalValue, "ZAR")} ({filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""})
          </span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading…</div>
        ) : !filteredDeals.length ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            {stageFilter ? "No deals in this stage." : "No deals yet. Add a deal to get started."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60">
                <tr>
                  <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deal</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lead</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stage</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Expected close</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Value</th>
                  <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredDeals.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pl-4 font-medium text-slate-800 dark:text-slate-200">{d.name}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{getLeadName(d.lead_id)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        d.stage === "won" ? "bg-green-100 text-green-800" :
                        d.stage === "lost" ? "bg-red-100 text-red-800" :
                        "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}>
                        {d.stage}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{d.expected_close_date ?? ""}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800 dark:text-slate-200">
                      {d.value != null ? formatAmount(d.value, d.currency ?? "ZAR") : ""}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button type="button" onClick={() => openEdit(d)} className="text-xs font-medium text-brand-primary hover:underline mr-2">Edit</button>
                      <button type="button" onClick={() => window.confirm("Delete this deal?") && deleteMutation.mutate(d.id)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingId != null ? "Edit deal" : "Add deal"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deal name *</label>
                <input {...register("name")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                {errors.name && <p className="mt-0.5 text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lead</label>
                <select {...register("lead_id")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  <option value="">None</option>
                  {(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stage</label>
                <select {...register("stage")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expected close date</label>
                <input type="date" {...register("expected_close_date")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea {...register("notes")} rows={2} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50">
                  {editingId != null ? "Save" : "Add deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

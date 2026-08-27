import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";
import { formatAmount } from "@/lib/currency";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  estimated_value: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

interface Lead {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ["new", "contacted", "qualified", "lost"];
const SOURCE_OPTIONS = ["website", "referral", "cold outreach", "event", "other"];

export function LeadsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["sales", "leads"],
    queryFn: async () => {
      const res = await api.get("/sales/leads");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const res = await api.post("/sales/leads", {
        ...values,
        email: values.email || undefined,
        estimated_value: values.estimated_value ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "leads"] });
      setModalOpen(false);
      reset(defaultValues);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: LeadFormValues }) => {
      const res = await api.put(`/sales/leads/${id}`, {
        ...values,
        email: values.email || undefined,
        estimated_value: values.estimated_value ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "leads"] });
      setModalOpen(false);
      setEditingId(null);
      reset(defaultValues);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sales/leads/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "leads"] }),
  });

  const defaultValues: LeadFormValues = {
    name: "",
    email: "",
    company: "",
    phone: "",
    source: "",
    status: "new",
    estimated_value: undefined,
    notes: "",
  };

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues,
  });

  const openCreate = () => {
    setEditingId(null);
    reset(defaultValues);
    setModalOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingId(lead.id);
    reset({
      name: lead.name,
      email: lead.email ?? "",
      company: lead.company ?? "",
      phone: lead.phone ?? "",
      source: lead.source ?? "",
      status: lead.status,
      estimated_value: lead.estimated_value ?? undefined,
      notes: lead.notes ?? "",
    });
    setModalOpen(true);
  };

  const onSubmit = (values: LeadFormValues) => {
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Sales leads</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Manage and qualify leads. Track source, status, and follow ups.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-hover"
        >
          + Add lead
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading…</div>
        ) : !leads?.length ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">No leads yet. Add your first lead to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60">
                <tr>
                  <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Company</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Source</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Value</th>
                  <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pl-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{lead.name}</div>
                      {lead.email && <div className="text-xs text-slate-500 dark:text-slate-400">{lead.email}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{lead.company ?? ""}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{lead.source ?? ""}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800 dark:text-slate-200">
                      {lead.estimated_value != null ? formatAmount(lead.estimated_value, "ZAR") : ""}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button type="button" onClick={() => openEdit(lead)} className="text-xs font-medium text-brand-primary hover:underline mr-2">Edit</button>
                      <button
                        type="button"
                        onClick={() => window.confirm("Delete this lead?") && deleteMutation.mutate(lead.id)}
                        className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                      >
                        Delete
                      </button>
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingId != null ? "Edit lead" : "Add lead"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                <input {...register("name")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                {errors.name && <p className="mt-0.5 text-xs text-red-500 dark:text-red-400">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input type="email" {...register("email")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input {...register("phone")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
                <input {...register("company")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source</label>
                  <select {...register("source")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    <option value=""></option>
                    {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select {...register("status")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estimated value</label>
                <input type="number" step="0.01" min={0} {...register("estimated_value")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea {...register("notes")} rows={2} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50">
                  {editingId != null ? "Save" : "Add lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";

const pitchDeckSchema = z.object({
  lead_id: z.coerce.number().int().positive().optional().nullable(),
  deal_id: z.coerce.number().int().positive().optional().nullable(),
  title: z.string().min(1, "Title is required"),
  file_url: z.string().optional(),
  notes: z.string().optional(),
});

type PitchDeckFormValues = z.infer<typeof pitchDeckSchema>;

interface PitchDeck {
  id: number;
  lead_id: number | null;
  deal_id: number | null;
  title: string;
  file_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: number;
  name: string;
}

interface Deal {
  id: number;
  name: string;
}

export function PitchDecksPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: decks, isLoading } = useQuery<PitchDeck[]>({
    queryKey: ["sales", "pitch-decks"],
    queryFn: async () => {
      const res = await api.get("/sales/pitch-decks");
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

  const { data: deals } = useQuery<Deal[]>({
    queryKey: ["sales", "pipeline"],
    queryFn: async () => {
      const res = await api.get("/sales/pipeline");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: PitchDeckFormValues) => {
      const res = await api.post("/sales/pitch-decks", {
        ...values,
        lead_id: values.lead_id ?? undefined,
        deal_id: values.deal_id ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "pitch-decks"] });
      setModalOpen(false);
      reset(defaultValues);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: PitchDeckFormValues }) => {
      const res = await api.put(`/sales/pitch-decks/${id}`, {
        ...values,
        lead_id: values.lead_id ?? undefined,
        deal_id: values.deal_id ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "pitch-decks"] });
      setModalOpen(false);
      setEditingId(null);
      reset(defaultValues);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sales/pitch-decks/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "pitch-decks"] }),
  });

  const defaultValues: PitchDeckFormValues = {
    lead_id: undefined,
    deal_id: undefined,
    title: "",
    file_url: "",
    notes: "",
  };

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PitchDeckFormValues>({
    resolver: zodResolver(pitchDeckSchema),
    defaultValues,
  });

  const openCreate = () => {
    setEditingId(null);
    reset(defaultValues);
    setModalOpen(true);
  };

  const openEdit = (d: PitchDeck) => {
    setEditingId(d.id);
    reset({
      lead_id: d.lead_id ?? undefined,
      deal_id: d.deal_id ?? undefined,
      title: d.title,
      file_url: d.file_url ?? "",
      notes: d.notes ?? "",
    });
    setModalOpen(true);
  };

  const onSubmit = (values: PitchDeckFormValues) => {
    if (editingId != null) {
      updateMutation.mutate({ id: editingId, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const getLeadName = (id: number | null) => (id == null ? "—" : leads?.find((l) => l.id === id)?.name ?? `Lead #${id}`);
  const getDealName = (id: number | null) => (id == null ? "—" : deals?.find((d) => d.id === id)?.name ?? `Deal #${id}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Pitch decks</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Central place for pitch decks and sales collateral.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-hover"
        >
          + Add pitch deck
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading…</div>
        ) : !decks?.length ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">No pitch decks yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60">
                <tr>
                  <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Title</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lead</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deal</th>
                  <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {decks.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pl-4 font-medium text-slate-800 dark:text-slate-200">{d.title}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{getLeadName(d.lead_id)}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{getDealName(d.deal_id)}</td>
                    <td className="py-3 pr-4 text-right">
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-primary hover:underline mr-2">Open</a>
                      )}
                      <button type="button" onClick={() => openEdit(d)} className="text-xs font-medium text-brand-primary hover:underline mr-2">Edit</button>
                      <button type="button" onClick={() => window.confirm("Delete this pitch deck?") && deleteMutation.mutate(d.id)} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">Delete</button>
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingId != null ? "Edit pitch deck" : "Add pitch deck"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input {...register("title")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
                {errors.title && <p className="mt-0.5 text-xs text-red-500 dark:text-red-400">{errors.title.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">File URL</label>
                <input type="url" {...register("file_url")} placeholder="https://..." className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lead</label>
                <select {...register("lead_id")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  <option value="">— None —</option>
                  {(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deal</label>
                <select {...register("deal_id")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  <option value="">— None —</option>
                  {(deals ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea {...register("notes")} rows={2} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50">
                  {editingId != null ? "Save" : "Add pitch deck"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

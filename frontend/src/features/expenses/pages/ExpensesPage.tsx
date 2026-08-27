import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";
import { BASE_CURRENCY_CODE, formatAmount } from "@/lib/currency";

const expenseSchema = z.object({
  vendor_id: z.number().int().optional().nullable(),
  category_id: z.number().int().optional().nullable(),
  description: z.string().min(1),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  tax_amount: z.coerce.number().min(0).default(0),
  currency: z.string().min(1).default(BASE_CURRENCY_CODE),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface Expense extends ExpenseFormValues {
  id: number;
  status: string;
}

interface Vendor {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

interface ReceiptUpload {
  id: number;
  expense_id: number | null;
  file_name: string;
  content_type: string;
  extracted_data: {
    merchant?: string;
    amount?: number;
    date?: string;
    currency?: string;
    suggested_category?: string;
    confidence?: string;
  } | null;
  uploaded_at: string;
}

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractOnUpload, setExtractOnUpload] = useState(true);
  const [createFromReceiptModal, setCreateFromReceiptModal] = useState<ReceiptUpload | null>(null);

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await api.get("/expenses/");
      return res.data;
    },
  });

  const { data: receipts } = useQuery<ReceiptUpload[]>({
    queryKey: ["expenses", "receipts"],
    queryFn: async () => {
      const res = await api.get("/expenses/receipts", { params: { unattached_only: true } });
      return res.data;
    },
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: async () => {
      const res = await api.get("/expenses/vendors");
      return res.data;
    },
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["expenseCategories"],
    queryFn: async () => {
      const res = await api.get("/expenses/categories");
      return res.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, extract }: { file: File; extract: boolean }) => {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post(
        `/expenses/receipts/upload?extract=${extract}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", "receipts"] });
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (receiptId: number) => {
      const res = await api.post(`/expenses/receipts/${receiptId}/extract`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", "receipts"] });
      if (createFromReceiptModal) {
        queryClient.invalidateQueries({ queryKey: ["expenses", "receipts"] });
      }
    },
  });

  const createFromReceiptMutation = useMutation({
    mutationFn: async (body: {
      receipt_id: number;
      vendor_id?: number;
      category_id?: number;
      description?: string;
      date?: string;
      amount?: number;
      tax_amount?: number;
      currency?: string;
    }) => {
      const res = await api.post("/expenses/from-receipt", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", "receipts"] });
      setCreateFromReceiptModal(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      await api.post("/expenses/", values);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      currency: BASE_CURRENCY_CODE,
      tax_amount: 0,
    },
  });

  const onSubmit = async (values: ExpenseFormValues) => {
    await createMutation.mutateAsync(values);
    reset({
      date: new Date().toISOString().slice(0, 10),
      currency: BASE_CURRENCY_CODE,
      tax_amount: 0,
    });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate({ file, extract: extractOnUpload });
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track spend, upload receipts, capture on mobile, and categorize with AI extraction.
          </p>
        </div>
      </div>

      {/* Upload receipts: desktop + mobile capture */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Upload receipts</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {uploadMutation.isPending ? "Uploading…" : "Upload receipt"}
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            On mobile, this opens the camera. On desktop, choose a file.
          </span>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={extractOnUpload}
              onChange={(e) => setExtractOnUpload(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Extract data with AI on upload
          </label>
        </div>
      </div>

      {/* Unattached receipts: create expense or re-extract */}
      {receipts && receipts.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-600">
            Receipts not yet linked to an expense
          </h2>
          <ul className="divide-y divide-slate-100">
            {receipts.map((rec) => (
              <li key={rec.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{rec.file_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(rec.uploaded_at).toLocaleString()}</p>
                  {rec.extracted_data && (
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {rec.extracted_data.merchant && <span>{rec.extracted_data.merchant}</span>}
                      {rec.extracted_data.amount != null && (
                        <span className="ml-2 font-medium">
                          {Number(rec.extracted_data.amount).toFixed(2)}{" "}
                          {rec.extracted_data.currency || BASE_CURRENCY_CODE}
                        </span>
                      )}
                      {rec.extracted_data.suggested_category && (
                        <span className="ml-2 rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {rec.extracted_data.suggested_category}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await api.get(`/expenses/receipts/${rec.id}/file`, { responseType: "blob" });
                      const url = URL.createObjectURL(res.data as Blob);
                      window.open(url, "_blank");
                      setTimeout(() => URL.revokeObjectURL(url), 60000);
                    }}
                    className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => extractMutation.mutate(rec.id)}
                    disabled={extractMutation.isPending}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                  >
                    Extract again
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateFromReceiptModal(rec)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Create expense
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Expenses</h2>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-left">Vendor</th>
                  <th className="py-2 text-left">Description</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-left">Category</th>
                  <th className="py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses?.map((exp) => (
                  <tr key={exp.id} className="border-b border-slate-100 last:border-none">
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{exp.date}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">
                      {vendors?.find((v) => v.id === exp.vendor_id)?.name ?? ""}
                    </td>
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">{exp.description}</td>
                    <td className="py-2 pr-4 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatAmount(Number(exp.amount), exp.currency ?? BASE_CURRENCY_CODE)}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">
                      {categories?.find((c) => c.id === exp.category_id)?.name ?? ""}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="capitalize rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {exp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">New expense (manual)</h2>
          </div>
          <form className="p-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  {...register("date")}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Vendor</label>
                <select
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  {...register("vendor_id", { valueAsNumber: true })}
                >
                  <option value="">Select vendor</option>
                  {vendors?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Category</label>
                <select
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  {...register("category_id", { valueAsNumber: true })}
                >
                  <option value="">Select category</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  {...register("amount")}
                />
                {errors.amount && (
                  <p className="mt-0.5 text-xs text-red-500">{errors.amount.message}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Currency</label>
              <select
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                {...register("currency")}
              >
                <option value="ZAR">ZAR (Rand)</option>
                <option value="LSL">LSL (Loti)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                {...register("description")}
              />
              {errors.description && (
                <p className="mt-0.5 text-xs text-red-500">{errors.description.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Save expense"}
            </button>
          </form>
        </div>
      </div>

      {createFromReceiptModal && (
        <CreateExpenseFromReceiptModal
          receipt={createFromReceiptModal}
          categories={categories ?? []}
          vendors={vendors ?? []}
          onClose={() => setCreateFromReceiptModal(null)}
          onSubmit={(body) => createFromReceiptMutation.mutate(body)}
          isSubmitting={createFromReceiptMutation.isPending}
        />
      )}
    </div>
  );
}

function CreateExpenseFromReceiptModal({
  receipt,
  categories,
  vendors,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  receipt: ReceiptUpload;
  categories: Category[];
  vendors: Vendor[];
  onClose: () => void;
  onSubmit: (body: {
    receipt_id: number;
    vendor_id?: number;
    category_id?: number;
    description?: string;
    date?: string;
    amount?: number;
    tax_amount?: number;
    currency?: string;
  }) => void;
  isSubmitting: boolean;
}) {
  const ext = receipt.extracted_data || {};
  const suggestedCategory = ext.suggested_category;
  const matchedCategoryId = suggestedCategory
    ? categories.find((c) => c.name.toLowerCase().includes(suggestedCategory.toLowerCase()))?.id
    : null;
  const [description, setDescription] = useState(ext.merchant || receipt.file_name || "");
  const [amount, setAmount] = useState(String(ext.amount ?? ""));
  const [date, setDate] = useState(ext.date || new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState(ext.currency || BASE_CURRENCY_CODE);
  const [categoryId, setCategoryId] = useState<string>(matchedCategoryId ? String(matchedCategoryId) : "");
  const [vendorId, setVendorId] = useState<string>("");

  const effectiveCategoryId = categoryId ? Number(categoryId) : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!description.trim() || Number.isNaN(amt) || amt <= 0) return;
    onSubmit({
      receipt_id: receipt.id,
      description: description.trim(),
      amount: amt,
      date: date || undefined,
      currency: currency || undefined,
      category_id: effectiveCategoryId,
      vendor_id: vendorId ? Number(vendorId) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Create expense from receipt</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description *</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="ZAR">ZAR (Rand)</option>
                <option value="LSL">LSL (Loti)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {matchedCategoryId === c.id ? " (suggested)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Vendor</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? "Creating…" : "Create expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

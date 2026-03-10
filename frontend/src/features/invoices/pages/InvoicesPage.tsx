import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";
import { BASE_CURRENCY_CODE, formatAmount } from "@/lib/currency";
import { CreateCustomerModal, type CustomerOption } from "../components/CreateCustomerModal";

export type PdfTheme = "classic" | "modern" | "minimal" | "elegant" | "bold" | "professional";
export type PdfDoctype = "invoice" | "quotation";

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  vat_rate: z.coerce.number().min(0).max(100).optional().nullable(),
});

const invoiceSchema = z.object({
  customer_id: z.union([z.number(), z.literal("")]).optional(),
  customer_name: z.string().optional(),
  customer_email: z.preprocess((v) => (v === "" ? undefined : v), z.string().email().optional().or(z.literal(""))),
  invoice_number: z.coerce.number().int().positive().optional().nullable(),
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  currency: z.string().min(1).default(BASE_CURRENCY_CODE),
  vat_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  vat_country: z.preprocess((v) => (v === "" ? undefined : v), z.string().length(2).optional()),
  notes: z.string().optional().nullable(),
  is_recurring: z.boolean().default(false),
  recurring_interval_days: z.coerce.number().int().positive().optional().nullable(),
  lines: z.array(lineSchema).min(1, "Add at least one line item"),
}).refine(
  (data) => {
    const hasId = data.customer_id !== undefined && data.customer_id !== "";
    const hasName = data.customer_name != null && String(data.customer_name).trim().length > 0;
    return hasId || hasName;
  },
  { message: "Select a customer or enter a name", path: ["customer_name"] }
);

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface InvoiceSummary {
  id: number;
  invoice_number: number;
  customer_name: string;
  issue_date: string;
  total: number;
  currency: string;
  status: string;
}

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const [pdfTheme, setPdfTheme] = useState<PdfTheme>("classic");
  const [pdfDoctype, setPdfDoctype] = useState<PdfDoctype>("invoice");
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const isEditing = editingInvoiceId !== null;
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showBranding, setShowBranding] = useState(false);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);
  const [makeRecurringInvoiceId, setMakeRecurringInvoiceId] = useState<number | null>(null);
  const [recurringIntervalDays, setRecurringIntervalDays] = useState(30);

  const { data: customers } = useQuery<CustomerOption[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await api.get("/customers/");
      return res.data;
    },
  });

  interface LineItemTemplateOption {
    id: number;
    description: string;
    default_quantity: number;
    unit_price: number;
    vat_rate: number | null;
  }
  const { data: lineItemTemplates = [] } = useQuery<LineItemTemplateOption[]>({
    queryKey: ["line-item-templates"],
    queryFn: async () => {
      const res = await api.get("/line-item-templates/");
      return res.data;
    },
  });

  const { data: previewHtml } = useQuery<string>({
    queryKey: ["invoices", "preview", pdfTheme, pdfDoctype],
    queryFn: async () => {
      const res = await api.get("/invoices/preview", {
        params: { theme: pdfTheme, doctype: pdfDoctype },
        responseType: "text",
      });
      return res.data as string;
    },
    enabled: showPreview,
  });

  const { data: viewHtml, isLoading: viewHtmlLoading } = useQuery<string>({
    queryKey: ["invoices", "view", viewingInvoiceId, pdfTheme, pdfDoctype],
    queryFn: async () => {
      const res = await api.get(`/invoices/${viewingInvoiceId}/html`, {
        params: { theme: pdfTheme, doctype: pdfDoctype },
        responseType: "text",
      });
      return res.data as string;
    },
    enabled: viewingInvoiceId != null,
  });

  const { data: company } = useQuery<{
    name: string;
    logo_url: string | null;
    address: string | null;
    footer_text: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_branch_code: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  }>({
    queryKey: ["company"],
    queryFn: async () => {
      const res = await api.get("/company");
      return res.data;
    },
  });

  const [companyForm, setCompanyForm] = useState({
    logo_url: "",
    address: "",
    footer_text: "",
    bank_name: "",
    bank_account_number: "",
    bank_branch_code: "",
    primary_color: "",
    secondary_color: "",
  });
  const [companySaved, setCompanySaved] = useState(false);
  const updateCompanyMutation = useMutation({
    mutationFn: async (values: {
      logo_url?: string;
      address?: string;
      footer_text?: string;
      bank_name?: string;
      bank_account_number?: string;
      bank_branch_code?: string;
      primary_color?: string;
      secondary_color?: string;
    }) => {
      await api.patch("/company", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", "preview"] });
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 3000);
    },
  });

  useEffect(() => {
    if (company) {
      setCompanyForm({
        logo_url: company.logo_url ?? "",
        address: company.address ?? "",
        footer_text: company.footer_text ?? "",
        bank_name: company.bank_name ?? "",
        bank_account_number: company.bank_account_number ?? "",
        bank_branch_code: company.bank_branch_code ?? "",
        primary_color: company.primary_color ?? "",
        secondary_color: company.secondary_color ?? "",
      });
    }
  }, [company]);

  const saveCompanyBranding = () => {
    updateCompanyMutation.mutate({
      logo_url: companyForm.logo_url || undefined,
      address: companyForm.address || undefined,
      footer_text: companyForm.footer_text || undefined,
      bank_name: companyForm.bank_name || undefined,
      bank_account_number: companyForm.bank_account_number || undefined,
      bank_branch_code: companyForm.bank_branch_code || undefined,
      primary_color: companyForm.primary_color || undefined,
      secondary_color: companyForm.secondary_color || undefined,
    });
  };

  const { data, isLoading } = useQuery<InvoiceSummary[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await api.get("/invoices/");
      return res.data;
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (body: { name: string; email?: string; address?: string }) => {
      const res = await api.post("/customers/", body);
      return res.data as CustomerOption;
    },
    onSuccess: (data) => {
      // Optimistically add the new customer so the invoice form's select has an option for it
      // (otherwise the select has no matching option and can reset to "One-time customer" on submit)
      queryClient.setQueryData<CustomerOption[]>(["customers"], (old) =>
        old ? [...old, data].sort((a, b) => a.name.localeCompare(b.name)) : [data]
      );
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      const lines = values.lines
        .filter((l) => (l.description ?? "").toString().trim() !== "")
        .map((l) => ({
          description: (l.description ?? "").toString().trim(),
          quantity: Number(l.quantity) || 0,
          unit_price: Number(l.unit_price) ?? 0,
          vat_rate: l.vat_rate != null && l.vat_rate !== "" ? Number(l.vat_rate) : undefined,
        }));
      if (lines.length === 0) {
        throw new Error("Add at least one line item with a description.");
      }
      const payload: Record<string, unknown> = {
        issue_date: values.issue_date,
        currency: values.currency ?? BASE_CURRENCY_CODE,
        is_recurring: values.is_recurring ?? false,
        lines,
      };
      if (values.due_date && String(values.due_date).trim()) {
        payload.due_date = values.due_date;
      }
      if (values.vat_rate != null && values.vat_rate !== "") {
        payload.vat_rate = Number(values.vat_rate);
      }
      if (values.vat_country && String(values.vat_country).trim().length === 2) {
        payload.vat_country = String(values.vat_country).trim().toUpperCase();
      }
      if (values.notes != null && String(values.notes).trim()) {
        payload.notes = values.notes.trim();
      }
      if (values.recurring_interval_days != null && values.recurring_interval_days > 0) {
        payload.recurring_interval_days = Number(values.recurring_interval_days);
      }
      const customerId = values.customer_id;
      if (customerId !== undefined && customerId !== "" && customerId != null) {
        payload.customer_id = Number(customerId);
      } else {
        const name = (values.customer_name ?? "").toString().trim();
        if (!name) throw new Error("Select a customer or enter a customer name.");
        payload.customer_name = name;
        const email = (values.customer_email as string)?.toString().trim();
        if (email) payload.customer_email = email;
      }
      if (values.invoice_number != null && values.invoice_number > 0) {
        payload.invoice_number = Number(values.invoice_number);
      }
      const res = await api.post("/invoices/", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setNewInvoiceOpen(false);
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async (args: { id: number; values: InvoiceFormValues }) => {
      const { id, values } = args;
      const lines = values.lines
        .filter((l) => (l.description ?? "").toString().trim() !== "")
        .map((l) => ({
          description: (l.description ?? "").toString().trim(),
          quantity: Number(l.quantity) || 0,
          unit_price: Number(l.unit_price) ?? 0,
          vat_rate: l.vat_rate != null && l.vat_rate !== "" ? Number(l.vat_rate) : undefined,
        }));
      const payload: Record<string, unknown> = {
        issue_date: values.issue_date,
        currency: values.currency ?? BASE_CURRENCY_CODE,
        is_recurring: values.is_recurring ?? false,
        lines,
      };
      if (values.due_date && String(values.due_date).trim()) {
        payload.due_date = values.due_date;
      }
      if (values.vat_rate != null && values.vat_rate !== "") {
        payload.vat_rate = Number(values.vat_rate);
      }
      if (values.vat_country && String(values.vat_country).trim().length === 2) {
        payload.vat_country = String(values.vat_country).trim().toUpperCase();
      }
      if (values.notes != null) {
        payload.notes = String(values.notes).trim() || undefined;
      }
      if (values.recurring_interval_days != null && values.recurring_interval_days > 0) {
        payload.recurring_interval_days = Number(values.recurring_interval_days);
      }
      const name = (values.customer_name ?? "").toString().trim();
      if (name) {
        payload.customer_name = name;
        const email = (values.customer_email as string)?.toString().trim();
        if (email) payload.customer_email = email;
      }
      const res = await api.put(`/invoices/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setNewInvoiceOpen(false);
      setEditingInvoiceId(null);
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.put(`/invoices/${id}`, { status: "paid" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/invoices/${id}/duplicate`);
      return res.data as { id: number };
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setEmailMessage({ type: "success", text: "Invoice duplicated. Edit the new draft if needed." });
      setTimeout(() => setEmailMessage(null), 4000);
    },
  });

  const makeRecurringMutation = useMutation({
    mutationFn: async ({ id, recurring_interval_days }: { id: number; recurring_interval_days: number }) => {
      await api.put(`/invoices/${id}`, { is_recurring: true, recurring_interval_days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setMakeRecurringInvoiceId(null);
      setEmailMessage({ type: "success", text: "Invoice set as recurring." });
      setTimeout(() => setEmailMessage(null), 4000);
    },
  });

  const saveLineAsTemplateMutation = useMutation({
    mutationFn: async (line: { description: string; quantity: number; unit_price: number; vat_rate?: number | null }) => {
      await api.post("/line-item-templates/", {
        description: line.description.trim(),
        default_quantity: line.quantity,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["line-item-templates"] });
      setEmailMessage({ type: "success", text: "Line saved for reuse." });
      setTimeout(() => setEmailMessage(null), 3000);
    },
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: "",
      customer_name: "",
      customer_email: "",
      invoice_number: undefined,
      currency: BASE_CURRENCY_CODE,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: "",
      lines: [{ description: "", quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const selectedCustomerId = watch("customer_id");

  const onSubmit = async (values: InvoiceFormValues) => {
    try {
      if (isEditing && editingInvoiceId != null) {
        await updateInvoiceMutation.mutateAsync({ id: editingInvoiceId, values });
      } else {
        await createMutation.mutateAsync(values);
        reset({
          customer_id: "",
          customer_name: "",
          customer_email: "",
          invoice_number: undefined,
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: "",
          currency: BASE_CURRENCY_CODE,
          vat_rate: undefined,
          vat_country: "",
          notes: "",
          is_recurring: false,
          recurring_interval_days: undefined,
          lines: [{ description: "", quantity: 1, unit_price: 0, vat_rate: undefined }],
        });
      }
    } catch {
      // Error shown via createMutation.isError
    }
  };

  const handleCustomerCreated = (customer: CustomerOption) => {
    setValue("customer_id", customer.id);
    setValue("customer_name", "");
    setValue("customer_email", "");
    setCreateCustomerOpen(false);
  };

  const downloadPdf = async (invoiceId: number) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}/pdf`, {
        params: { theme: pdfTheme, doctype: pdfDoctype },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfDoctype}-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setEmailMessage({ type: "error", text: "PDF download failed." });
    }
  };

  const emailInvoice = async (invoiceId: number) => {
    setEmailMessage(null);
    try {
      await api.post(`/invoices/${invoiceId}/email`, { theme: pdfTheme, doctype: pdfDoctype });
      setEmailMessage({ type: "success", text: "Email sent to customer." });
      setTimeout(() => setEmailMessage(null), 4000);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Email failed.";
      setEmailMessage({ type: "error", text: typeof msg === "string" ? msg : "Email failed." });
    }
  };

  const isOneTimeCustomer = selectedCustomerId === "" || selectedCustomerId === undefined;

  const openNewInvoiceModal = () => {
    setEditingInvoiceId(null);
    reset({
      customer_id: "",
      customer_name: "",
      customer_email: "",
      invoice_number: undefined,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: "",
      currency: BASE_CURRENCY_CODE,
      vat_rate: undefined,
      vat_country: "",
      notes: "",
      is_recurring: false,
      recurring_interval_days: undefined,
      lines: [{ description: "", quantity: 1, unit_price: 0, vat_rate: undefined }],
    });
    setNewInvoiceOpen(true);
  };

  const openEditInvoice = async (invoiceId: number) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      const inv = res.data as {
        id: number;
        customer_name: string | null;
        customer_email: string | null;
        issue_date: string;
        due_date: string | null;
        currency: string;
        vat_rate: number | null;
        vat_country: string | null;
        notes: string | null;
        is_recurring: boolean;
        recurring_interval_days: number | null;
        lines: { description: string; quantity: number; unit_price: number; vat_rate: number | null }[];
      };

      reset({
        customer_id: "",
        customer_name: inv.customer_name ?? "",
        customer_email: inv.customer_email ?? "",
        issue_date: inv.issue_date,
        due_date: inv.due_date ?? "",
        currency: inv.currency || BASE_CURRENCY_CODE,
        vat_rate: inv.vat_rate ?? undefined,
        vat_country: inv.vat_country ?? "",
        notes: inv.notes ?? "",
        is_recurring: inv.is_recurring,
        recurring_interval_days: inv.recurring_interval_days ?? undefined,
        lines: inv.lines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          vat_rate: l.vat_rate != null ? Number(l.vat_rate) : undefined,
        })),
      });

      setEditingInvoiceId(invoiceId);
      setNewInvoiceOpen(true);
    } catch {
      // ignore for now; could show a toast
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header: title + primary action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Invoices</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Create and manage invoices. Download PDF or email to customers.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewInvoiceModal}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
        >
          + New invoice
        </button>
      </div>

      {/* Compact design bar: theme + doctype + optional preview */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Document style</span>
            <select
              value={pdfDoctype}
              onChange={(e) => setPdfDoctype(e.target.value as PdfDoctype)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-primary"
            >
              <option value="invoice">Invoice</option>
              <option value="quotation">Quotation</option>
            </select>
            <select
              value={pdfTheme}
              onChange={(e) => setPdfTheme(e.target.value as PdfTheme)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-primary"
            >
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="minimal">Minimal</option>
              <option value="elegant">Elegant</option>
              <option value="bold">Bold</option>
              <option value="professional">Professional</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
            <button
              type="button"
              onClick={() => setShowBranding((b) => !b)}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {showBranding ? "Hide branding" : "Company branding"}
            </button>
          </div>
        </div>
        {showPreview && (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-card overflow-hidden shadow-apple">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-600">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Document preview</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!previewHtml) return;
                    const w = window.open("", "_blank");
                    if (w) {
                      w.document.write(previewHtml);
                      w.document.close();
                    }
                  }}
                  disabled={!previewHtml}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Open in new tab
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-100/50 dark:bg-slate-200 max-h-[85vh] overflow-auto flex justify-center">
              {previewHtml ? (
                <div className="bg-white dark:bg-white dark:border dark:border-slate-300 shadow-apple-lg rounded-lg overflow-hidden flex-shrink-0" style={{ width: "min(720px, 100%)", minWidth: 320 }}>
                  <iframe
                    title="Preview"
                    srcDoc={previewHtml}
                    className="border-0 rounded-lg w-full block"
                    style={{ height: 1100, minHeight: 800 }}
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Loading preview…</div>
              )}
            </div>
          </div>
        )}
        {showBranding && (
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-card p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Logo URL</label>
              <input
                type="url"
                value={companyForm.logo_url}
                onChange={(e) => setCompanyForm((f) => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Address</label>
              <textarea
                value={companyForm.address}
                onChange={(e) => setCompanyForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St"
                rows={2}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Footer text</label>
              <textarea
                value={companyForm.footer_text}
                onChange={(e) => setCompanyForm((f) => ({ ...f, footer_text: e.target.value }))}
                placeholder="Thank you for your business."
                rows={2}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-3">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Banking (shown on invoice PDF)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Bank name</label>
                  <input
                    type="text"
                    value={companyForm.bank_name}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, bank_name: e.target.value }))}
                    placeholder="e.g. FNB"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Account number</label>
                  <input
                    type="text"
                    value={companyForm.bank_account_number}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, bank_account_number: e.target.value }))}
                    placeholder="1234567890"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Branch code</label>
                  <input
                    type="text"
                    value={companyForm.bank_branch_code}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, bank_branch_code: e.target.value }))}
                    placeholder="250655"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-600 pt-3">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Colour palette (invoice themes)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Primary colour</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={companyForm.primary_color || "#059669"}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, primary_color: e.target.value }))}
                      className="h-9 w-12 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={companyForm.primary_color}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, primary_color: e.target.value }))}
                      placeholder="#059669"
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Secondary colour</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={companyForm.secondary_color || "#047857"}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, secondary_color: e.target.value }))}
                      className="h-9 w-12 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={companyForm.secondary_color}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, secondary_color: e.target.value }))}
                      placeholder="#047857"
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={saveCompanyBranding}
              disabled={updateCompanyMutation.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Save branding
            </button>
            {companySaved && <span className="ml-2 text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>}
          </div>
        )}
      </div>

      {/* Invoices table — primary content */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
        {emailMessage && (
          <div
            className={`mx-4 mt-3 rounded-lg px-3 py-2 text-sm ${
              emailMessage.type === "success" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200" : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
            }`}
          >
            {emailMessage.text}
          </div>
        )}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading invoices…</div>
          ) : !Array.isArray(data) || data.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              No invoices yet. Click <strong className="text-slate-700 dark:text-slate-300">New invoice</strong> to create one.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60">
                <tr>
<th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Number</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Issue date</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.map((inv, index) => (
                  <tr key={inv?.id ?? index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pl-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {String(inv?.invoice_number ?? "").padStart(5, "0")}
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{inv?.customer_name ?? ""}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{inv?.issue_date ?? ""}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800 dark:text-slate-200">
                      {formatAmount(Number(inv?.total ?? 0), inv?.currency ?? BASE_CURRENCY_CODE)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {inv?.status ?? ""}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => inv?.id != null && openEditInvoice(inv.id)}
                          className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => inv?.id != null && duplicateMutation.mutate(inv.id)}
                          disabled={duplicateMutation.isPending}
                          className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-50"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => inv?.id != null && setMakeRecurringInvoiceId(inv.id)}
                          className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300"
                        >
                          Make recurring
                        </button>
                        <button
                          type="button"
                          onClick={() => inv?.id != null && setViewingInvoiceId(inv.id)}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => inv?.id != null && markDoneMutation.mutate(inv.id)}
                          disabled={!inv || inv.status === "paid" || markDoneMutation.isPending}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 disabled:opacity-50"
                        >
                          Mark as done
                        </button>
                        <button
                          type="button"
                          onClick={() => inv?.id != null && downloadPdf(inv.id)}
                          className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => inv?.id != null && emailInvoice(inv.id)}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                        >
                          Email
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Make recurring modal */}
      {makeRecurringInvoiceId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setMakeRecurringInvoiceId(null)}>
          <div
            className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Make invoice recurring</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Set how often this invoice repeats (in days).</p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Interval (days)</label>
              <input
                type="number"
                min={1}
                value={recurringIntervalDays}
                onChange={(e) => setRecurringIntervalDays(Number(e.target.value) || 30)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMakeRecurringInvoiceId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  makeRecurringMutation.mutate({ id: makeRecurringInvoiceId, recurring_interval_days: recurringIntervalDays });
                }}
                disabled={makeRecurringMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg disabled:opacity-50"
              >
                {makeRecurringMutation.isPending ? "Saving…" : "Make recurring"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View invoice / quotation modal */}
      {viewingInvoiceId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setViewingInvoiceId(null)}>
          <div
            className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {pdfDoctype === "quotation" ? "Quotation" : "Invoice"} preview
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => viewingInvoiceId != null && downloadPdf(viewingInvoiceId)}
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Download PDF
                </button>
                <button type="button" onClick={() => setViewingInvoiceId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Close">✕</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4 bg-slate-100 dark:bg-slate-200 overflow-auto flex justify-center">
              {viewHtmlLoading ? (
                <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400 text-sm">Loading…</div>
              ) : viewHtml ? (
                <div className="bg-white dark:bg-white dark:border dark:border-slate-300 shadow-apple-lg rounded-lg overflow-hidden flex-shrink-0" style={{ width: "min(720px, 100%)", minWidth: 320 }}>
                  <iframe
                    title="Invoice view"
                    srcDoc={viewHtml}
                    className="border-0 rounded-lg w-full block"
                    style={{ height: 900, minHeight: 700 }}
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* New invoice modal */}
      {newInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setNewInvoiceOpen(false)}>
          <div
            className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{isEditing ? "Edit invoice" : "New invoice"}</h2>
              <button type="button" onClick={() => setNewInvoiceOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Close">✕</button>
            </div>
            <form className="p-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {createMutation.isError && !isEditing && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {(() => {
                    const err = createMutation.error as { response?: { data?: { detail?: string } }; message?: string } | undefined;
                    const detail = err?.response?.data?.detail;
                    return typeof detail === "string" ? detail : detail && Array.isArray(detail) ? detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join(". ") : err?.message ?? "Failed to create invoice. Check details and try again.";
                  })()}
                </p>
              )}
              {updateInvoiceMutation.isError && isEditing && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {(() => {
                    const err = updateInvoiceMutation.error as { response?: { data?: { detail?: string | { msg?: string }[] } }; message?: string } | undefined;
                    const detail = err?.response?.data?.detail;
                    if (typeof detail === "string") return detail;
                    if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join(". ") || "Failed to update invoice.";
                    return err?.message ?? "Failed to update invoice. Check details and try again.";
                  })()}
                </p>
              )}

              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invoice number (optional)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Leave blank for auto"
                    {...register("invoice_number")}
                    className="w-full max-w-[140px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">If blank, the next number is used automatically.</p>
                </div>
              )}

              {/* Customer (read-only when editing, selectable when creating) */}
              {!isEditing ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Customer</label>
                    <button
                      type="button"
                      onClick={() => setCreateCustomerOpen(true)}
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      + New customer
                    </button>
                  </div>
                  <select
                    {...register("customer_id")}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="">— One-time customer (enter below) —</option>
                    {(customers ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.email ? ` · ${c.email}` : ""}
                      </option>
                    ))}
                  </select>
                  {isOneTimeCustomer && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name *</label>
                        <input
                          {...register("customer_name")}
                          placeholder="Acme Inc"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary"
                        />
                        {errors.customer_name && <p className="mt-0.5 text-xs text-red-500 dark:text-red-400">{errors.customer_name.message}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
                        <input
                          type="email"
                          {...register("customer_email")}
                          placeholder="billing@acme.com"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Customer</label>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {watch("customer_name") || "Customer on invoice"}
                    {watch("customer_email") ? <span className="text-slate-500 dark:text-slate-400"> · {watch("customer_email")}</span> : null}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Customer details are fixed for existing invoices.</p>
                </div>
              )}

              {isEditing && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40 p-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Document style / layout</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Choose how this invoice appears when viewing or downloading as PDF.</p>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Type</label>
                      <select
                        value={pdfDoctype}
                        onChange={(e) => setPdfDoctype(e.target.value as PdfDoctype)}
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-primary"
                      >
                        <option value="invoice">Invoice</option>
                        <option value="quotation">Quotation</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Theme</label>
                      <select
                        value={pdfTheme}
                        onChange={(e) => setPdfTheme(e.target.value as PdfTheme)}
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-primary"
                      >
                        <option value="classic">Classic</option>
                        <option value="modern">Modern</option>
                        <option value="minimal">Minimal</option>
                        <option value="elegant">Elegant</option>
                        <option value="bold">Bold</option>
                        <option value="professional">Professional</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Issue date *</label>
                  <input type="date" {...register("issue_date")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary" />
                  {errors.issue_date && <p className="mt-0.5 text-xs text-red-500">{errors.issue_date.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due date</label>
                  <input type="date" {...register("due_date")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select {...register("currency")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    <option value="ZAR">ZAR (Rand)</option>
                    <option value="LSL">LSL (Loti)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VAT %</label>
                  <input type="number" step="0.01" min={0} max={100} {...register("vat_rate")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Line items</label>
                  <div className="flex items-center gap-2">
                    {lineItemTemplates.length > 0 && (
                      <select
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary"
                        value=""
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) return;
                          e.target.value = "";
                          const t = lineItemTemplates.find((x) => x.id === Number(id));
                          if (t) {
                            append({
                              description: t.description,
                              quantity: Number(t.default_quantity) || 1,
                              unit_price: Number(t.unit_price) ?? 0,
                              vat_rate: t.vat_rate != null ? Number(t.vat_rate) : undefined,
                            });
                          }
                        }}
                      >
                        <option value="">Add from saved…</option>
                        {lineItemTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.description} — {formatAmount(Number(t.unit_price), BASE_CURRENCY_CODE)}
                          </option>
                        ))}
                      </select>
                    )}
                    <button type="button" onClick={() => append({ description: "", quantity: 1, unit_price: 0, vat_rate: undefined })} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">+ Add line</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const lineVal = watch(`lines.${index}`);
                    const desc = (lineVal?.description ?? "").toString().trim();
                    return (
                      <div key={field.id} className="flex gap-2 items-end flex-wrap">
                        <input placeholder="Description" className="flex-[2] min-w-[140px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" {...register(`lines.${index}.description` as const)} />
                        <input type="number" step="0.01" min={0.01} placeholder="Qty" className="w-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm text-slate-900 dark:text-slate-100" {...register(`lines.${index}.quantity` as const)} />
                        <input type="number" step="0.01" min={0} placeholder="Price" className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm text-slate-900 dark:text-slate-100" {...register(`lines.${index}.unit_price` as const)} />
                        <input type="number" step="0.01" min={0} max={100} placeholder="VAT%" className="w-14 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm text-slate-900 dark:text-slate-100" {...register(`lines.${index}.vat_rate` as const)} />
                        {desc && (
                          <button
                            type="button"
                            onClick={() => {
                              const q = Number(lineVal?.quantity) || 1;
                              const p = Number(lineVal?.unit_price) ?? 0;
                              const v = lineVal?.vat_rate != null && lineVal?.vat_rate !== "" ? Number(lineVal.vat_rate) : undefined;
                              saveLineAsTemplateMutation.mutate({ description: desc, quantity: q, unit_price: p, vat_rate: v });
                            }}
                            disabled={saveLineAsTemplateMutation.isPending}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs"
                            title="Save as reusable line item"
                          >
                            Save
                          </button>
                        )}
                        <button type="button" onClick={() => remove(index)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs">Remove</button>
                      </div>
                    );
                  })}
                </div>
                {(errors.lines?.root ?? errors.lines) && <p className="mt-1 text-xs text-red-500 dark:text-red-400">Add at least one line item.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea {...register("notes")} rows={2} placeholder="Payment terms, thank you message…" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                <button type="button" onClick={() => setNewInvoiceOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (!isEditing && createMutation.isPending) ||
                    (isEditing && updateInvoiceMutation.isPending)
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                >
                  {isEditing
                    ? updateInvoiceMutation.isPending || isSubmitting
                      ? "Saving…"
                      : "Save changes"
                    : createMutation.isPending || isSubmitting
                    ? "Creating…"
                    : "Create invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CreateCustomerModal
        open={createCustomerOpen}
        onClose={() => setCreateCustomerOpen(false)}
        onCreated={handleCustomerCreated}
        createCustomer={async (data) => {
          const c = await createCustomerMutation.mutateAsync(data);
          return c;
        }}
      />
    </div>
  );
}

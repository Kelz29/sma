import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

interface CompanyData {
  name: string;
  logo_url: string | null;
  address: string | null;
  footer_text: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  default_currency: string | null;
  default_vat_rate: number | null;
  default_vat_country: string | null;
  company_registration_number: string | null;
  company_registration_country: string | null;
  cipc_document_url: string | null;
}

const CURRENCIES = [
  { value: "ZAR", label: "ZAR (South African Rand)" },
  { value: "LSL", label: "LSL (Lesotho Loti)" },
  { value: "USD", label: "USD (US Dollar)" },
  { value: "EUR", label: "EUR (Euro)" },
  { value: "GBP", label: "GBP (British Pound)" },
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const { data: company, isLoading, isError } = useQuery<CompanyData>({
    queryKey: ["company"],
    queryFn: async () => {
      const res = await api.get("/company");
      return res.data;
    },
  });

  const [form, setForm] = useState<CompanyData>({
    name: "",
    logo_url: null,
    address: null,
    footer_text: null,
    bank_name: null,
    bank_account_number: null,
    bank_branch_code: null,
    primary_color: null,
    secondary_color: null,
    default_currency: null,
    default_vat_rate: null,
    default_vat_country: null,
    company_registration_number: null,
    company_registration_country: null,
    cipc_document_url: null,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        logo_url: company.logo_url ?? null,
        address: company.address ?? null,
        footer_text: company.footer_text ?? null,
        bank_name: company.bank_name ?? null,
        bank_account_number: company.bank_account_number ?? null,
        bank_branch_code: company.bank_branch_code ?? null,
        primary_color: company.primary_color ?? null,
        secondary_color: company.secondary_color ?? null,
        default_currency: company.default_currency ?? null,
        default_vat_rate: company.default_vat_rate ?? null,
        default_vat_country: company.default_vat_country ?? null,
        company_registration_number: company.company_registration_number ?? null,
        company_registration_country: company.company_registration_country ?? null,
        cipc_document_url: company.cipc_document_url ?? null,
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async (values: Partial<CompanyData>) => {
      await api.patch("/company", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      name: form.name || undefined,
      logo_url: form.logo_url ?? undefined,
      address: form.address ?? undefined,
      footer_text: form.footer_text ?? undefined,
      bank_name: form.bank_name ?? undefined,
      bank_account_number: form.bank_account_number ?? undefined,
      bank_branch_code: form.bank_branch_code ?? undefined,
      primary_color: form.primary_color ?? undefined,
      secondary_color: form.secondary_color ?? undefined,
      default_currency: form.default_currency ?? undefined,
      default_vat_rate: form.default_vat_rate ?? undefined,
      default_vat_country: form.default_vat_country ?? undefined,
      company_registration_number: form.company_registration_number ?? undefined,
      company_registration_country: form.company_registration_country ?? undefined,
      cipc_document_url: form.cipc_document_url ?? undefined,
    });
  };

  const update = (key: keyof CompanyData, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [key]: value === "" ? null : value }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load company settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Company settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure your company profile, branding, banking, and defaults for invoices and documents.
        </p>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Only company admins can edit these settings. You can view the current configuration below.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Company profile */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-6 shadow-apple">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
            Company profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                disabled={!isAdmin}
                placeholder="Your Company (Pty) Ltd"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Logo URL</label>
              <input
                type="url"
                value={form.logo_url ?? ""}
                onChange={(e) => update("logo_url", e.target.value || null)}
                disabled={!isAdmin}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
              {form.logo_url && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={form.logo_url}
                    alt="Logo preview"
                    className="h-10 w-auto max-w-[120px] object-contain rounded border border-slate-200"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
              <textarea
                value={form.address ?? ""}
                onChange={(e) => update("address", e.target.value || null)}
                disabled={!isAdmin}
                placeholder="123 Main St, City, Country"
                rows={2}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Footer text (invoices)</label>
              <textarea
                value={form.footer_text ?? ""}
                onChange={(e) => update("footer_text", e.target.value || null)}
                disabled={!isAdmin}
                placeholder="Thank you for your business."
                rows={2}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>
          </div>
        </section>

        {/* Company registration (e.g. CIPC) */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-6 shadow-apple">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
            Company registration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Registration details and CIPC (or equivalent) document confirming your registered company.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Registration number</label>
              <input
                type="text"
                value={form.company_registration_number ?? ""}
                onChange={(e) => update("company_registration_number", e.target.value || null)}
                disabled={!isAdmin}
                placeholder="e.g. 2021/123456/07"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Registration country</label>
              <input
                type="text"
                maxLength={2}
                value={form.company_registration_country ?? ""}
                onChange={(e) => update("company_registration_country", e.target.value.toUpperCase().slice(0, 2) || null)}
                disabled={!isAdmin}
                placeholder="e.g. ZA"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CIPC document (URL)</label>
              <input
                type="url"
                value={form.cipc_document_url ?? ""}
                onChange={(e) => update("cipc_document_url", e.target.value || null)}
                disabled={!isAdmin}
                placeholder="https://... or link to uploaded registration document"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
              {form.cipc_document_url && (
                <a
                  href={form.cipc_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-brand-primary hover:underline"
                >
                  View document →
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Banking & defaults */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-6 shadow-apple">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
            Banking & document defaults
          </h2>
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Banking details appear on invoice and quotation PDFs. Defaults are used when creating new documents.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bank name</label>
              <input
                type="text"
                value={form.bank_name ?? ""}
                onChange={(e) => update("bank_name", e.target.value || null)}
                disabled={!isAdmin}
                placeholder="e.g. FNB"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Account number</label>
                <input
                  type="text"
                  value={form.bank_account_number ?? ""}
                  onChange={(e) => update("bank_account_number", e.target.value || null)}
                  disabled={!isAdmin}
                  placeholder="1234567890"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Branch code</label>
                <input
                  type="text"
                  value={form.bank_branch_code ?? ""}
                  onChange={(e) => update("bank_branch_code", e.target.value || null)}
                  disabled={!isAdmin}
                  placeholder="250655"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
                />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default currency</label>
              <select
                value={form.default_currency ?? ""}
                onChange={(e) => update("default_currency", e.target.value || null)}
                disabled={!isAdmin}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">— Not set (use per document) —</option>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default VAT %</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={form.default_vat_rate ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    update("default_vat_rate", v === "" ? null : parseFloat(v));
                  }}
                  disabled={!isAdmin}
                  placeholder="15"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">VAT country code</label>
                <input
                  type="text"
                  maxLength={2}
                  value={form.default_vat_country ?? ""}
                  onChange={(e) => update("default_vat_country", e.target.value.toUpperCase().slice(0, 2) || null)}
                  disabled={!isAdmin}
                  placeholder="ZA"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Branding colours */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 mb-4">
            Branding colours
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Used in invoice and quotation PDF themes (headers, accents, borders). Leave blank to use theme defaults.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Primary colour</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.primary_color || "#059669"}
                  onChange={(e) => update("primary_color", e.target.value)}
                  disabled={!isAdmin}
                  className="h-10 w-14 rounded border border-slate-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                />
                <input
                  type="text"
                  value={form.primary_color ?? ""}
                  onChange={(e) => update("primary_color", e.target.value || null)}
                  disabled={!isAdmin}
                  placeholder="#059669"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Secondary colour</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.secondary_color || "#047857"}
                  onChange={(e) => update("secondary_color", e.target.value)}
                  disabled={!isAdmin}
                  className="h-10 w-14 rounded border border-slate-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                />
                <input
                  type="text"
                  value={form.secondary_color ?? ""}
                  onChange={(e) => update("secondary_color", e.target.value || null)}
                  disabled={!isAdmin}
                  placeholder="#047857"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-sm text-brand-primary">Settings saved.</span>}
          {updateMutation.isError && (
            <span className="text-sm text-red-600">Failed to save. Try again.</span>
          )}
        </div>
      )}
    </div>
  );
}

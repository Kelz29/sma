import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { formatAmount } from "@/lib/currency";
import { PAYSLIP_PDF_THEMES, type PayslipPdfTheme } from "@/lib/payslipPdfThemes";

interface Employee {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department: string | null;
  job_title: string | null;
  salary: string | number | null;
  currency: string;
  is_active: boolean;
}

interface PayslipRow {
  id: number;
  employee_name: string;
  period_start: string;
  period_end: string;
  gross: string;
  net: string;
  currency: string;
}

export function PayslipsPage() {
  const queryClient = useQueryClient();
  const [generatePayslipOpen, setGeneratePayslipOpen] = useState(false);
  const [pdfTheme, setPdfTheme] = useState<PayslipPdfTheme>("classic");

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await api.get("/employees/");
      return res.data;
    },
  });

  const { data: payslips } = useQuery<PayslipRow[]>({
    queryKey: ["payslips"],
    queryFn: async () => {
      const res = await api.get("/payslips/");
      return res.data;
    },
  });

  const generatePayslipMutation = useMutation({
    mutationFn: async (body: { employee_id: number; period_start: string; period_end: string }) => {
      const res = await api.post("/payslips/generate", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      setGeneratePayslipOpen(false);
    },
  });

  const downloadPayslipPdf = async (payslipId: number) => {
    const res = await api.get(`/payslips/${payslipId}/pdf`, {
      params: { theme: pdfTheme },
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${payslipId}-${pdfTheme}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Payslips</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Generate and download payslips by employee and period. Choose a PDF layout before downloading.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-3 text-sm">
        <label htmlFor="payslip-pdf-theme" className="font-medium text-slate-700 dark:text-slate-300">
          PDF design
        </label>
        <select
          id="payslip-pdf-theme"
          value={pdfTheme}
          onChange={(e) => setPdfTheme(e.target.value as PayslipPdfTheme)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        >
          {PAYSLIP_PDF_THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="text-slate-500 dark:text-slate-400 text-xs">
          Classic: soft card · Modern: gradient header · Minimal: black &amp; white
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setGeneratePayslipOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            Generate payslip
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card overflow-hidden shadow-apple">
          {!payslips?.length ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              <p>No payslips yet.</p>
              <p className="mt-2">Generate a payslip for an employee and pay period below. Everyone in the company (except the platform owner) can be linked as an employee and receive payslips.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60">
                <tr>
                  <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Employee</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Period</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Gross</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Net</th>
                  <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pl-4 font-medium text-slate-900 dark:text-slate-100">{p.employee_name ?? ""}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{p.period_start} to {p.period_end}</td>
                    <td className="py-3 px-4 text-right text-slate-800 dark:text-slate-200">{formatAmount(Number(p.gross), p.currency)}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">{formatAmount(Number(p.net), p.currency)}</td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => downloadPayslipPdf(p.id)}
                        className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {generatePayslipOpen && employees && (
        <GeneratePayslipModal
          employees={employees}
          onClose={() => setGeneratePayslipOpen(false)}
          onSubmit={(data) => generatePayslipMutation.mutate(data)}
          isSubmitting={generatePayslipMutation.isPending}
        />
      )}
    </div>
  );
}

function GeneratePayslipModal({
  employees,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  employees: Employee[];
  onClose: () => void;
  onSubmit: (data: { employee_id: number; period_start: string; period_end: string }) => void;
  isSubmitting: boolean;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !periodStart || !periodEnd) return;
    onSubmit({ employee_id: Number(employeeId), period_start: periodStart, period_end: periodEnd });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Generate payslip</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Employee</label>
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Period start</label>
            <input
              type="date"
              required
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Period end</label>
            <input
              type="date"
              required
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">Generate</button>
          </div>
        </form>
      </div>
    </div>
  );
}

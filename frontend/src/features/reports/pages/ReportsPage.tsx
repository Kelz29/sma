import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { BASE_CURRENCY_CODE, formatAmount } from "@/lib/currency";

interface SummaryPoint {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface SummaryReport {
  date_from?: string;
  date_to?: string;
  interval: "day" | "month" | "quarter" | "year";
  currency: string;
  total_revenue: number;
  total_expenses: number;
  total_profit: number;
  outstanding_invoices_total: number;
  outstanding_invoices_count: number;
  average_invoice_value: number;
  series: SummaryPoint[];
}

interface SalesByCustomerRow {
  customer_name: string;
  revenue: number;
  invoice_count: number;
}

interface AgingBucket {
  label: string;
  days_min: number;
  days_max: number | null;
  total: number;
  count: number;
}

interface AgingReport {
  as_of: string;
  currency: string;
  buckets: AgingBucket[];
}

type ReportType = "summary" | "sales_by_customer" | "aging" | "invoices" | "expenses";

export function ReportsPage() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    .toISOString()
    .slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [interval, setInterval] = useState<SummaryReport["interval"]>("month");
  const [emailModal, setEmailModal] = useState<{ type: ReportType } | null>(null);
  const [emailAddress, setEmailAddress] = useState("");

  const { data: summary, isLoading: loadingSummary } = useQuery<SummaryReport>({
    queryKey: ["reports", "summary", dateFrom, dateTo, interval],
    queryFn: async () => {
      const res = await api.get("/reports/summary", {
        params: { date_from: dateFrom, date_to: dateTo, interval },
      });
      return res.data;
    },
  });

  const { data: sales } = useQuery<SalesByCustomerRow[]>({
    queryKey: ["reports", "sales_by_customer", dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get("/reports/sales-by-customer", {
        params: { date_from: dateFrom, date_to: dateTo, limit: 10 },
      });
      return res.data;
    },
  });

  const { data: aging } = useQuery<AgingReport>({
    queryKey: ["reports", "aging"],
    queryFn: async () => {
      const res = await api.get("/reports/aging");
      return res.data;
    },
  });

  const emailMutation = useMutation({
    mutationFn: async (type: ReportType) => {
      await api.post("/reports/email", {
        report_type: type,
        to_email: emailAddress,
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
    },
    onSuccess: () => {
      setEmailModal(null);
      setEmailAddress("");
    },
  });

  const summaryTotals = useMemo(() => {
    if (!summary) {
      return {
        totalRevenue: 0,
        totalExpenses: 0,
        totalProfit: 0,
        outstanding: 0,
        outstandingCount: 0,
        avgInvoice: 0,
      };
    }
    return {
      totalRevenue: summary.total_revenue,
      totalExpenses: summary.total_expenses,
      totalProfit: summary.total_profit,
      outstanding: summary.outstanding_invoices_total,
      outstandingCount: summary.outstanding_invoices_count,
      avgInvoice: summary.average_invoice_value,
    };
  }, [summary]);

  const handlePreset = (preset: "this_month" | "last_3_months" | "ytd" | "all_time") => {
    const now = new Date();
    if (preset === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(start.toISOString().slice(0, 10));
      setDateTo(now.toISOString().slice(0, 10));
    } else if (preset === "last_3_months") {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      setDateFrom(start.toISOString().slice(0, 10));
      setDateTo(now.toISOString().slice(0, 10));
    } else if (preset === "ytd") {
      const start = new Date(now.getFullYear(), 0, 1);
      setDateFrom(start.toISOString().slice(0, 10));
      setDateTo(now.toISOString().slice(0, 10));
    } else if (preset === "all_time") {
      setDateFrom("");
      setDateTo("");
    }
  };

  const downloadReport = async (type: ReportType) => {
    const params: Record<string, string> = { report_type: type };
    if (type !== "aging") {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
    }
    const search = new URLSearchParams(params).toString();
    const res = await api.get(`/reports/download?${search}`, {
      responseType: "blob",
    });
    const blob = res.data as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currencyLabel = summary?.currency ?? BASE_CURRENCY_CODE;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            BI style insights on revenue, expenses, customers, and cash flow. Download or email reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium">Preset:</span>
            <button
              type="button"
              className="rounded-full border border-slate-200 dark:border-slate-600 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => handlePreset("this_month")}
            >
              This month
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 dark:border-slate-600 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => handlePreset("last_3_months")}
            >
              Last 3 months
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 dark:border-slate-600 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => handlePreset("ytd")}
            >
              YTD
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 dark:border-slate-600 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => handlePreset("all_time")}
            >
              All time
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}      
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Interval</label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value as SummaryReport["interval"])}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
            <option value="day">Day</option>
          </select>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadReport("summary")}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Download summary CSV
          </button>
          <button
            type="button"
            onClick={() => setEmailModal({ type: "summary" })}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Email summary
          </button>
        </div>
      </div>

      {/* KPI cards */}      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total revenue"
          value={summaryTotals.totalRevenue}
          currency={currencyLabel}
          loading={loadingSummary}
        />
        <KpiCard
          label="Total expenses"
          value={summaryTotals.totalExpenses}
          currency={currencyLabel}
          loading={loadingSummary}
        />
        <KpiCard
          label="Profit"
          value={summaryTotals.totalProfit}
          currency={currencyLabel}
          loading={loadingSummary}
        />
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">Outstanding invoices</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatAmount(summaryTotals.outstanding, currencyLabel)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summaryTotals.outstandingCount} open · Avg invoice {formatAmount(summaryTotals.avgInvoice, currencyLabel)}
          </p>
        </div>
      </div>

      {/* Revenue vs Expenses trend */}      
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Revenue vs expenses over time</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadReport("invoices")}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Download invoices CSV
            </button>
            <button
              type="button"
              onClick={() => downloadReport("expenses")}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Download expenses CSV
            </button>
          </div>
        </div>
        <div className="p-4 overflow-x-auto">
          {!summary || summary.series.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data for the selected period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 text-left">Period</th>
                  <th className="py-2 text-right">Revenue</th>
                  <th className="py-2 text-right">Expenses</th>
                  <th className="py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {summary.series.map((p) => (
                  <tr key={p.period} className="border-b border-slate-100 last:border-none">
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{p.period}</td>
                    <td className="py-2 pr-4 text-right text-emerald-700">
                      {formatAmount(p.revenue, currencyLabel)}
                    </td>
                    <td className="py-2 pr-4 text-right text-red-600">
                      {formatAmount(p.expenses, currencyLabel)}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatAmount(p.profit, currencyLabel)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Sales by customer & Aging */}      
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Top customers (by revenue)</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadReport("sales_by_customer")}
                className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => setEmailModal({ type: "sales_by_customer" })}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                Email
              </button>
            </div>
          </div>
          <div className="p-4">
            {!sales || sales.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No sales data.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 text-left">Customer</th>
                    <th className="py-2 text-right">Revenue</th>
                    <th className="py-2 text-right">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((row) => (
                    <tr key={row.customer_name} className="border-b border-slate-100 last:border-none">
                      <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{row.customer_name}</td>
                      <td className="py-2 pr-4 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatAmount(row.revenue, currencyLabel)}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-400">{row.invoice_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">A/R aging</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadReport("aging")}
                className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => setEmailModal({ type: "aging" })}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                Email
              </button>
            </div>
          </div>
          <div className="p-4">
            {!aging || aging.buckets.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No open invoices.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 text-left">Bucket</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.buckets.map((b) => (
                    <tr key={b.label} className="border-b border-slate-100 last:border-none">
                      <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{b.label}</td>
                      <td className="py-2 pr-4 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatAmount(b.total, aging.currency)}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-400">{b.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {emailModal && (
        <EmailReportModal
          type={emailModal.type}
          onClose={() => setEmailModal(null)}
          onSubmit={() => emailMutation.mutate(emailModal.type)}
          email={emailAddress}
          setEmail={setEmailAddress}
          isSubmitting={emailMutation.isPending}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  currency,
  loading,
}: {
  label: string;
  value: number;
  currency: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        {loading ? "…" : formatAmount(value, currency)}
      </p>
    </div>
  );
}

function EmailReportModal({
  type,
  onClose,
  onSubmit,
  email,
  setEmail,
  isSubmitting,
}: {
  type: ReportType;
  onClose: () => void;
  onSubmit: () => void;
  email: string;
  setEmail: (val: string) => void;
  isSubmitting: boolean;
}) {
  const labelMap: Record<ReportType, string> = {
    summary: "Summary",
    sales_by_customer: "Sales by customer",
    aging: "Aging",
    invoices: "Invoices",
    expenses: "Expenses",
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onSubmit();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Email {labelMap[type].toLowerCase()} report
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Recipient email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="finance@company.com"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The report will be sent as a CSV attachment. SMTP must be configured on the server.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? "Sending…" : "Send report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


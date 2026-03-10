import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";
import { BASE_CURRENCY_CODE, formatAmount } from "@/lib/currency";

interface InvoiceSummary {
  id: number;
  invoice_number: number;
  customer_name: string;
  issue_date: string;
  total: number;
  currency: string;
  status: string;
}

interface ExpenseSummary {
  id: number;
  date: string;
  amount: number;
  currency: string;
  status: string;
}

interface BankAccount {
  id: number;
  name: string;
  currency: string;
  opening_balance: number;
}

interface BankTransaction {
  id: number;
  bank_account_id: number;
  date: string;
  description: string;
  amount: number;
  balance_after?: number;
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: invoices } = useQuery<InvoiceSummary[]>({
    queryKey: ["dashboard", "invoices"],
    queryFn: async () => {
      const res = await api.get("/invoices/");
      return res.data;
    },
  });

  const { data: expenses } = useQuery<ExpenseSummary[]>({
    queryKey: ["dashboard", "expenses"],
    queryFn: async () => {
      const res = await api.get("/expenses/");
      return res.data;
    },
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["dashboard", "bankAccounts"],
    queryFn: async () => {
      const res = await api.get("/banking/accounts");
      return res.data;
    },
  });

  const primaryAccountId = bankAccounts?.[0]?.id;

  const { data: bankTransactions } = useQuery<BankTransaction[]>({
    queryKey: ["dashboard", "bankTransactions", primaryAccountId],
    enabled: !!primaryAccountId,
    queryFn: async () => {
      const res = await api.get("/banking/transactions", {
        params: { bank_account_id: primaryAccountId },
      });
      return res.data;
    },
  });

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const {
    mrr,
    outstandingInvoices,
    monthRevenue,
    monthExpenses,
    cashBalance,
  } = useMemo(() => {
    let totalRevenue = 0;
    let outstanding = 0;
    let monthRev = 0;
    let monthExp = 0;

    (invoices ?? []).forEach((inv) => {
      const total = Number(inv?.total ?? 0);
      totalRevenue += total;
      const issueDate = new Date(inv?.issue_date ?? 0);
      if (issueDate >= startOfMonth && issueDate <= today) {
        monthRev += total;
      }
      if (inv?.status !== "paid" && inv?.status !== "cancelled") {
        outstanding += total;
      }
    });

    (expenses ?? []).forEach((exp) => {
      const date = new Date(exp?.date ?? 0);
      if (date >= startOfMonth && date <= today) {
        monthExp += Number(exp?.amount ?? 0);
      }
    });

    let balance = Number(bankAccounts?.[0]?.opening_balance ?? 0);
    (bankTransactions ?? []).forEach((tx) => {
      balance += Number(tx?.amount ?? 0);
    });

    return {
      mrr: totalRevenue,
      outstandingInvoices: outstanding,
      monthRevenue: monthRev,
      monthExpenses: monthExp,
      cashBalance: balance,
    };
  }, [invoices, expenses, bankAccounts, bankTransactions, startOfMonth, today]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-[0.2em]">
            Overview
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Good to see you{user?.email ? `, ${String(user.email).split("@")[0]}` : ""}.
          </h1>
          <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
            This is your command center for invoices, expenses, and cash flow. Use it to see
            where money is coming from, what&apos;s outstanding, and what&apos;s going out.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3">
            <p className="text-emerald-700 dark:text-emerald-300">This month&apos;s revenue</p>
            <p className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
              {formatAmount(monthRevenue, BASE_CURRENCY_CODE, { decimals: 0, useSymbol: true })}
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/30 px-4 py-3">
            <p className="text-sky-700 dark:text-sky-300">Cash balance</p>
            <p className="mt-1 text-lg font-semibold text-sky-900 dark:text-sky-100">
              {formatAmount(cashBalance, BASE_CURRENCY_CODE, { decimals: 0, useSymbol: true })}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <DashboardStat
          label="Monthly recurring revenue"
          value={formatAmount(mrr, BASE_CURRENCY_CODE, { decimals: 0, useSymbol: true })}
          sublabel="All active invoices"
        />
        <DashboardStat
          label="Outstanding invoices"
          value={formatAmount(outstandingInvoices, BASE_CURRENCY_CODE, { decimals: 0, useSymbol: true })}
          sublabel="Due & overdue"
        />
        <DashboardStat
          label="Month-to-date expenses"
          value={formatAmount(monthExpenses, BASE_CURRENCY_CODE, { decimals: 0, useSymbol: true })}
          sublabel="Approved spend"
        />
        <DashboardStat
          label="Net this month"
          value={formatAmount(monthRevenue - monthExpenses, BASE_CURRENCY_CODE, { decimals: 0, useSymbol: true })}
          sublabel="Revenue - expenses"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-600 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Recent invoices</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Last 5 invoices across all customers.
              </p>
            </div>
          </div>
          <div className="p-4 overflow-x-auto">
            {invoices && invoices.length > 0 ? (
              <table className="w-full text-xs md:text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 text-left">Number</th>
                    <th className="py-2 text-left">Customer</th>
                    <th className="py-2 text-left">Issue date</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 5).map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100 last:border-none">
                      <td className="py-2 pr-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {String(inv.invoice_number).padStart(5, "0")}
                      </td>
                      <td className="py-2 pr-4 text-slate-800 dark:text-slate-200">{inv.customer_name}</td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">
                        {new Date(inv.issue_date).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-800 dark:text-slate-200">
                        {formatAmount(Number(inv?.total ?? 0), inv?.currency ?? BASE_CURRENCY_CODE)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-400">
                No invoices yet. Create your first invoice from the Invoices tab.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
            <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Cashflow timeline</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Latest movements through your primary bank account.
            </p>
            <div className="mt-4 space-y-3 max-h-64 overflow-y-auto pr-1">
              {bankTransactions && bankTransactions.length > 0 ? (
                bankTransactions.slice(0, 6).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                        {tx.description}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(tx.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right text-xs font-semibold">
                      <span
                        className={
                          tx.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }
                      >
                        {tx.amount >= 0 ? "+" : "-"}
                        {formatAmount(Math.abs(tx.amount), bankAccounts?.[0]?.currency ?? BASE_CURRENCY_CODE, { useSymbol: true })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
<p className="text-sm text-slate-400 dark:text-slate-500">
                No bank transactions yet. Add one from the Banking tab.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
            <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Quick actions</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Jump straight into the workflows you use every day.
            </p>
            <div className="mt-3 grid gap-2 text-xs">
              <Link
                to="/invoices"
                className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2.5 text-slate-800 dark:text-slate-100 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50"
              >
                <span>Create a new invoice</span>
                <span className="text-emerald-600 dark:text-emerald-400">→</span>
              </Link>
              <Link
                to="/expenses"
                className="flex items-center justify-between rounded-lg border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/30 px-3 py-2.5 text-slate-800 dark:text-slate-100 hover:border-sky-300 dark:hover:border-sky-600 hover:bg-sky-100/80 dark:hover:bg-sky-900/50"
              >
                <span>Log a business expense</span>
                <span className="text-sky-600 dark:text-sky-400">→</span>
              </Link>
              <Link
                to="/banking"
                className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-2.5 text-slate-800 dark:text-slate-100 hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-100/80 dark:hover:bg-amber-900/50"
              >
                <span>Review bank transactions</span>
                <span className="text-amber-600 dark:text-amber-400">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

interface DashboardStatProps {
  label: string;
  value: string;
  sublabel?: string;
}

function DashboardStat({ label, value, sublabel }: DashboardStatProps) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {sublabel ? (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{sublabel}</p>
      ) : null}
    </div>
  );
}


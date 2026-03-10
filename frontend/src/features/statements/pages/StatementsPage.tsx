import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/axios";
import { formatAmount } from "@/lib/currency";

interface StatementLine {
  id: number;
  invoice_number: number;
  issue_date: string;
  due_date: string | null;
  total: number;
  currency: string;
  status: string;
}

interface CustomerStatement {
  customer: { id: number; name: string; email: string | null; address: string | null };
  invoices: StatementLine[];
  total_invoiced: number;
  total_paid: number;
  total_outstanding: number;
  currency: string;
}

interface CustomerOption {
  id: number;
  name: string;
  email: string | null;
  address: string | null;
}

export function StatementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const customerIdParam = searchParams.get("customer_id");
  const customerIdFromUrl = customerIdParam ? parseInt(customerIdParam, 10) : null;

  const { data: customers } = useQuery<CustomerOption[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await api.get("/customers/");
      return res.data;
    },
  });

  const selectedCustomerId =
    (customerIdFromUrl != null && !Number.isNaN(customerIdFromUrl) ? customerIdFromUrl : null) ?? customers?.[0]?.id ?? null;

  const { data: currentStatement, isLoading, error } = useQuery<CustomerStatement>({
    queryKey: ["customers", selectedCustomerId, "statement"],
    queryFn: async () => {
      const res = await api.get(`/customers/${selectedCustomerId}/statement`);
      return res.data;
    },
    enabled: selectedCustomerId != null,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Customer statements</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            View invoice history and balance per customer.
          </p>
        </div>
      </div>

      {customers && customers.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Customer</label>
          <select
            value={selectedCustomerId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? parseInt(e.target.value, 10) : null;
              if (id != null) setSearchParams({ customer_id: String(id) });
            }}
            className="w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          >
            <option value="">Select a customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ""}</option>
            ))}
          </select>
        </div>
      )}

      {!customers?.length && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-6 text-center">
          <p className="text-slate-500 dark:text-slate-400">No customers yet. Add customers from the Customers page to see statements.</p>
          <Link to="/customers" className="mt-3 inline-block text-sm font-medium text-brand-primary hover:underline">Go to Customers</Link>
        </div>
      )}

      {customers?.length > 0 && selectedCustomerId != null && (
        <>
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading statement…</div>
          ) : error ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-6 text-center text-red-600 dark:text-red-400">Failed to load statement.</div>
          ) : currentStatement ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
                <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Customer details</h2>
                <p className="mt-1 text-slate-800 dark:text-slate-200 font-medium">{currentStatement.customer.name}</p>
                {currentStatement.customer.email && <p className="text-sm text-slate-600 dark:text-slate-400">{currentStatement.customer.email}</p>}
                {currentStatement.customer.address && <p className="text-sm text-slate-600 dark:text-slate-400">{currentStatement.customer.address}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total invoiced</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {formatAmount(currentStatement.total_invoiced, currentStatement.currency, { useSymbol: true })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total paid</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatAmount(currentStatement.total_paid, currentStatement.currency, { useSymbol: true })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4 shadow-apple">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Outstanding</p>
                  <p className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {formatAmount(currentStatement.total_outstanding, currentStatement.currency, { useSymbol: true })}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
                <div className="border-b border-slate-200 dark:border-slate-600 px-4 py-3">
                  <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Invoice history</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">All invoices for this customer.</p>
                </div>
                <div className="overflow-x-auto">
                  {currentStatement.invoices.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">No invoices yet.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60">
                        <tr>
                          <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Number</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Issue date</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Due date</th>
                          <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Total</th>
                          <th className="py-3 pr-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                          <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {currentStatement.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="py-3 pl-4 font-mono text-xs text-slate-600 dark:text-slate-400">{String(inv.invoice_number).padStart(5, "0")}</td>
                            <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{inv.issue_date}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{inv.due_date ?? "—"}</td>
                            <td className="py-3 px-4 text-right font-medium text-slate-800 dark:text-slate-200">{formatAmount(inv.total, inv.currency)}</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{inv.status}</span>
                            </td>
                            <td className="py-3 pr-4 text-right">
                              <Link to={`/invoices`} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">View invoice</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

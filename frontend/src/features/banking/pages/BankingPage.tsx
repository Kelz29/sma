import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";
import { BASE_CURRENCY_CODE } from "@/lib/currency";

const bankAccountSchema = z.object({
  name: z.string().min(1),
  bank_name: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  currency: z.string().min(1).default(BASE_CURRENCY_CODE),
  opening_balance: z.coerce.number().default(0),
});

const transactionSchema = z.object({
  bank_account_id: z.coerce.number().int(),
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number(),
});

type BankAccountFormValues = z.infer<typeof bankAccountSchema>;
type TransactionFormValues = z.infer<typeof transactionSchema>;

interface BankAccount extends BankAccountFormValues {
  id: number;
}

interface BankTransaction {
  id: number;
  bank_account_id: number;
  date: string;
  description: string;
  amount: number;
  balance_after?: number;
  is_reconciled: boolean;
}

export function BankingPage() {
  const queryClient = useQueryClient();

  const { data: accounts } = useQuery<BankAccount[]>({
    queryKey: ["bankAccounts"],
    queryFn: async () => {
      const res = await api.get("/banking/accounts");
      return res.data;
    },
  });

  const { data: transactions } = useQuery<BankTransaction[]>({
    queryKey: ["bankTransactions", accounts?.[0]?.id],
    enabled: !!accounts?.length,
    queryFn: async () => {
      const res = await api.get("/banking/transactions", {
        params: { bank_account_id: accounts?.[0]?.id },
      });
      return res.data;
    },
  });

  const createAccount = useMutation({
    mutationFn: async (values: BankAccountFormValues) => {
      await api.post("/banking/accounts", values);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bankAccounts"] }),
  });

  const createTransaction = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      await api.post("/banking/transactions", values);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["bankTransactions", accounts?.[0]?.id] }),
  });

  const {
    register: registerAccount,
    handleSubmit: handleSubmitAccount,
    formState: { isSubmitting: accountSubmitting },
    reset: resetAccount,
  } = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      currency: BASE_CURRENCY_CODE,
      opening_balance: 0,
    },
  });

  const {
    register: registerTx,
    handleSubmit: handleSubmitTx,
    formState: { isSubmitting: txSubmitting },
    reset: resetTx,
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const onCreateAccount = async (values: BankAccountFormValues) => {
    await createAccount.mutateAsync(values);
    resetAccount();
  };

  const onCreateTransaction = async (values: TransactionFormValues) => {
    await createTransaction.mutateAsync(values);
    resetTx({
      bank_account_id: values.bank_account_id,
      date: new Date().toISOString().slice(0, 10),
      description: "",
      amount: 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Banking</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage bank accounts and transactions in South Africa (ZAR) or Lesotho (LSL). Track balances and reconcile with invoices and expenses.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
            <div className="border-b border-slate-200 dark:border-slate-600 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Bank accounts</h2>
            </div>
            <div className="p-4 space-y-2 text-sm">
              {accounts?.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 px-3 py-2"
                >
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{acc.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {acc.bank_name ?? "Bank"} · {acc.currency === "LSL" ? "LSL (Loti)" : "ZAR (Rand)"}
                    </div>
                  </div>
                </div>
              ))}
              {!accounts?.length && (
                <p className="text-xs text-slate-500 dark:text-slate-400">No bank accounts yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
            <div className="border-b border-slate-200 dark:border-slate-600 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">New bank account</h2>
            </div>
            <form className="p-4 space-y-3" onSubmit={handleSubmitAccount(onCreateAccount)}>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Account name</label>
                <input
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. Main operating account"
                  {...registerAccount("name")}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Currency</label>
                <select
                  className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                  {...registerAccount("currency")}
                >
                  <option value="ZAR">ZAR — South African Rand</option>
                  <option value="LSL">LSL — Lesotho Loti</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Bank name</label>
                <input
                  className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                  placeholder="e.g. FNB, Standard Bank, Nedbank (SA) / Standard Lesotho Bank (LSO)"
                  {...registerAccount("bank_name")}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Account number & branch code</label>
                <input
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. 62xxxxx · Branch 250655 (SA/LSO don’t use IBAN)"
                  {...registerAccount("iban")}
                />
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  In SA/LSO enter account number and branch code. IBAN is optional for other regions.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Opening balance (ZAR/LSL)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="0.00"
                  {...registerAccount("opening_balance")}
                />
              </div>
              <button
                type="submit"
                disabled={accountSubmitting}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {accountSubmitting ? "Saving..." : "Save account"}
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-card shadow-apple">
          <div className="border-b border-slate-200 dark:border-slate-600 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Transactions</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Amounts in account currency (ZAR/LSL). Use + for deposits, − for withdrawals.</span>
          </div>
          <div className="p-4 space-y-4">
            <form className="space-y-3" onSubmit={handleSubmitTx(onCreateTransaction)}>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Account</label>
                  <select
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    {...registerTx("bank_account_id")}
                  >
                    <option value="">Select account</option>
                    {accounts?.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    {...registerTx("date")}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-[2]">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <input
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    {...registerTx("description")}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (ZAR/LSL)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="+ deposit, − withdrawal"
                    {...registerTx("amount")}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={txSubmitting}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {txSubmitting ? "Add transaction..." : "Add transaction"}
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 text-left">Date</th>
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2 text-right">Balance</th>
                    <th className="py-2 text-left">Reconciled</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions?.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-700 last:border-none">
                      <td className="py-2 pr-4 text-slate-800 dark:text-slate-200">{tx.date}</td>
                      <td className="py-2 pr-4 text-slate-800 dark:text-slate-200">{tx.description}</td>
                      <td className="py-2 pr-4 text-right font-medium text-slate-800 dark:text-slate-200">{tx.amount.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-400">
                        {tx.balance_after ? tx.balance_after.toFixed(2) : "-"}
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-600 dark:text-slate-400">
                        {tx.is_reconciled ? "Yes" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";

const accountSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  category: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  parent_id: z.number().int().optional().nullable(),
  opening_debit: z.coerce.number().min(0),
  opening_credit: z.coerce.number().min(0),
  is_active: z.boolean().default(true),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface Account extends AccountFormValues {
  id: number;
  is_deleted: boolean;
}

export function AccountsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.get("/accounts/");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: AccountFormValues) => {
      await api.post("/accounts/", values);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      category: "asset",
      opening_debit: 0,
      opening_credit: 0,
      is_active: true,
    },
  });

  const onSubmit = async (values: AccountFormValues) => {
    await createMutation.mutateAsync(values);
    reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account hierarchy, codes, and opening balances.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-medium">Accounts</h2>
          </div>
          <div className="p-4 overflow-x-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Code</th>
                    <th className="py-2 text-left">Name</th>
                    <th className="py-2 text-left">Category</th>
                    <th className="py-2 text-right">Opening Debit</th>
                    <th className="py-2 text-right">Opening Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.map((account) => (
                    <tr key={account.id} className="border-b last:border-none">
                      <td className="py-2 pr-4">{account.code}</td>
                      <td className="py-2 pr-4">{account.name}</td>
                      <td className="py-2 pr-4 capitalize">{account.category}</td>
                      <td className="py-2 pr-0 text-right">{account.opening_debit}</td>
                      <td className="py-2 pr-0 text-right">{account.opening_credit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-medium">Create account</h2>
          </div>
          <form className="p-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Code</label>
                <input
                  className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                  {...register("code")}
                />
                {errors.code && (
                  <p className="mt-1 text-xs text-red-500">{errors.code.message}</p>
                )}
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-medium mb-1">Name</label>
                <input
                  className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Category</label>
                <select
                  className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                  {...register("category")}
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Opening debit</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                  {...register("opening_debit")}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Opening credit</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                  {...register("opening_credit")}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


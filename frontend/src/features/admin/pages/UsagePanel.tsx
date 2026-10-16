import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

type FeatureInsight = {
  key: string;
  label: string;
  adoption: number;
  frequency: number;
  return_lift: number;
  error_rate: number;
  score: number;
  label_kind: string;
};

type UsageSummary = {
  days: number;
  active_tenants: number;
  error_count: number;
  focus: string[];
  features: FeatureInsight[];
  funnel: { key: string; label: string; tenants: number }[];
  daily: { date: string; active_tenants: number }[];
  tenants: {
    tenant_id: number;
    tenant_name: string;
    last_seen: string;
    features: string[];
    error_count: number;
  }[];
};

type UsageEvent = {
  id: number;
  kind: string;
  path: string;
  message: string | null;
  method: string | null;
  status_code: number | null;
  user_email: string | null;
  tenant_name: string | null;
  created_at: string;
};

const LABEL_TEXT: Record<string, string> = {
  build_on: "Build on this",
  fix_first: "Fix first",
  onboarding_gap: "Onboarding gap",
  leave_for_later: "Leave for later",
  watch: "Watch",
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ScoreBars({ features }: { features: FeatureInsight[] }) {
  const max = Math.max(...features.map((feature) => feature.score), 0.01);
  const width = 640;
  const row = 36;
  const height = Math.max(features.length, 1) * row;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Feature scores" className="w-full">
      {features.map((feature, index) => {
        const bar = Math.max(2, (feature.score / max) * 280);
        const y = index * row;
        return (
          <g key={feature.key}>
            <text x="0" y={y + 22} className="fill-slate-700 dark:fill-slate-200" fontSize="13">
              {feature.label}
            </text>
            <rect x="150" y={y + 8} width={bar} height="16" rx="4" className="fill-emerald-500" />
            <text x={160 + bar} y={y + 21} fontSize="12" className="fill-slate-500">
              {feature.score.toFixed(2)} · {LABEL_TEXT[feature.label_kind] ?? feature.label_kind}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ActiveLine({ daily }: { daily: UsageSummary["daily"] }) {
  const width = 640;
  const height = 160;
  const max = Math.max(...daily.map((day) => day.active_tenants), 1);
  const step = daily.length > 1 ? (width - 48) / (daily.length - 1) : 0;
  const points = daily
    .map((day, index) => {
      const x = 32 + index * step;
      const y = height - 28 - (day.active_tenants / max) * (height - 48);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Active businesses over 14 days" className="w-full">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} className="text-emerald-600" />
      {daily.map((day, index) => {
        const x = 32 + index * step;
        const y = height - 28 - (day.active_tenants / max) * (height - 48);
        return <circle key={day.date} cx={x} cy={y} r="3" className="fill-emerald-600" />;
      })}
      {daily.map((day, index) => (
        index % 2 === 0 ? (
          <text key={`${day.date}-label`} x={32 + index * step} y={height - 8} fontSize="10" textAnchor="middle" className="fill-slate-500">
            {day.date.slice(5)}
          </text>
        ) : null
      ))}
    </svg>
  );
}

function FunnelBars({ steps }: { steps: UsageSummary["funnel"] }) {
  const max = Math.max(...steps.map((step) => step.tenants), 1);
  return (
    <div className="space-y-3" aria-label="Invoice funnel">
      {steps.map((step) => (
        <div key={step.key}>
          <div className="mb-1 flex justify-between text-sm text-slate-700 dark:text-slate-200">
            <span>{step.label}</span>
            <span>{step.tenants}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-3 rounded-full bg-emerald-500"
              style={{ width: `${Math.max(4, (step.tenants / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UsagePanel() {
  const summary = useQuery<UsageSummary>({
    queryKey: ["admin", "telemetry", "summary"],
    queryFn: async () => {
      const res = await api.get("/admin/telemetry/summary");
      return res.data;
    },
  });
  const events = useQuery<UsageEvent[]>({
    queryKey: ["admin", "telemetry", "events"],
    queryFn: async () => {
      const res = await api.get("/admin/telemetry/events");
      return res.data;
    },
  });

  if (summary.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading usage…</p>;
  }
  if (summary.isError || !summary.data) {
    return <p className="text-sm text-red-600">Could not load usage.</p>;
  }

  const data = summary.data;
  const errors = (events.data ?? []).filter((event) => event.kind === "client_error" || event.kind === "api_error").slice(0, 20);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4">
        <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Where to focus</h2>
        <ul className="mt-2 space-y-1 text-sm text-emerald-950 dark:text-emerald-50">
          {data.focus.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-200">
          Last {data.days} days · {data.active_tenants} active businesses · {data.error_count} errors
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Feature scores</h2>
        <p className="mt-1 text-xs text-slate-500">Higher means more businesses use it and come back.</p>
        <div className="mt-3 overflow-x-auto">
          <ScoreBars features={data.features} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Active businesses</h2>
          <div className="mt-3">
            <ActiveLine daily={data.daily} />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Invoice funnel</h2>
          <div className="mt-4">
            <FunnelBars steps={data.funnel} />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent errors</h2>
        {errors.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No errors in the latest events.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Business</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Path</th>
                  <th className="py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((event) => (
                  <tr key={event.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatWhen(event.created_at)}</td>
                    <td className="py-2 pr-3">{event.tenant_name ?? "—"}</td>
                    <td className="py-2 pr-3">{event.user_email ?? "—"}</td>
                    <td className="py-2 pr-3">{event.method ? `${event.method} ${event.path}` : event.path}</td>
                    <td className="py-2">{event.message || (event.status_code ? `HTTP ${event.status_code}` : event.kind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Businesses</h2>
        {data.tenants.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No businesses have used the product in this window.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-2 pr-3">Business</th>
                  <th className="py-2 pr-3">Last seen</th>
                  <th className="py-2 pr-3">Features used</th>
                  <th className="py-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.map((tenant) => (
                  <tr key={tenant.tenant_id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3">{tenant.tenant_name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatWhen(tenant.last_seen)}</td>
                    <td className="py-2 pr-3">{tenant.features.length ? tenant.features.join(", ") : "—"}</td>
                    <td className="py-2">{tenant.error_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

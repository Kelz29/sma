import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { formatAmount } from "@/lib/currency";
import { PAYSLIP_PDF_THEMES, type PayslipPdfTheme } from "@/lib/payslipPdfThemes";

function getPortalAvatarUrl(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) return "";
  const base = (api.defaults.baseURL ?? "").replace(/\/api\/v1\/?$/, "");
  return base ? `${base}${avatarUrl}` : avatarUrl;
}

type Tab = "mydetails" | "leave" | "attendance" | "payslips";

interface Profile {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  id_number: string | null;
  tax_number: string | null;
  department: string | null;
  job_title: string | null;
  address: string | null;
  phone: string | null;
  passport_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  currency: string;
  avatar_url?: string | null;
}

interface LeaveBalance {
  id: number;
  leave_type_name: string;
  year: number;
  balance: string;
  used: string;
}

interface LeaveRequest {
  id: number;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: string;
  status: string;
}

interface LeaveTypeOption {
  id: number;
  name: string;
}

interface PayslipRow {
  id: number;
  period_start: string;
  period_end: string;
  gross: string;
  net: string;
  currency: string;
}

interface AttendanceRow {
  id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
}

export function PortalPage() {
  const [tab, setTab] = useState<Tab>("mydetails");

  const {
    data: profile,
    isLoading: loadingProfile,
    error: profileError,
    isError: isProfileError,
  } = useQuery<Profile>({
    queryKey: ["portal", "me"],
    queryFn: async () => {
      const res = await api.get("/portal/me");
      return res.data;
    },
  });

  const profileErrorMessage = (() => {
    if (!isProfileError || !profileError || typeof profileError !== "object" || !("response" in profileError)) return null;
    const data = (profileError as { response?: { data?: { detail?: string | string[] }; status?: number } }).response?.data;
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.join(". ");
    if (data && typeof data === "object" && !detail) {
      const status = (profileError as { response?: { status?: number } }).response?.status;
      if (status === 401) return "Your session may have expired. Try signing in again.";
      if (status === 403) return "You don’t have access to this company’s portal.";
    }
    return null;
  })();

  const hasProfile = !!profile;

  const { data: leaveBalances } = useQuery<LeaveBalance[]>({
    queryKey: ["portal", "leave", "balances"],
    queryFn: async () => {
      const res = await api.get("/portal/leave/balances");
      return res.data;
    },
    enabled: hasProfile,
  });

  const { data: leaveTypes } = useQuery<LeaveTypeOption[]>({
    queryKey: ["leave", "types"],
    queryFn: async () => {
      const res = await api.get("/leave/types");
      return res.data;
    },
    enabled: hasProfile,
  });

  const { data: leaveRequests } = useQuery<LeaveRequest[]>({
    queryKey: ["portal", "leave", "requests"],
    queryFn: async () => {
      const res = await api.get("/portal/leave/requests");
      return res.data;
    },
    enabled: hasProfile,
  });

  const { data: attendance } = useQuery<AttendanceRow[]>({
    queryKey: ["portal", "attendance"],
    queryFn: async () => {
      const res = await api.get("/portal/attendance");
      return res.data;
    },
    enabled: hasProfile,
  });

  const { data: payslips } = useQuery<PayslipRow[]>({
    queryKey: ["portal", "payslips"],
    queryFn: async () => {
      const res = await api.get("/portal/payslips");
      return res.data;
    },
    enabled: hasProfile,
  });

  const queryClient = useQueryClient();
  const requestLeaveMutation = useMutation({
    mutationFn: async (body: { leave_type_id: number; start_date: string; end_date: string; total_days: number; notes?: string }) => {
      const res = await api.post("/portal/leave/requests", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "leave", "requests"] });
      setRequestLeaveOpen(false);
    },
  });

  const [requestLeaveOpen, setRequestLeaveOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [payslipError, setPayslipError] = useState<string | null>(null);
  const [payslipPdfTheme, setPayslipPdfTheme] = useState<PayslipPdfTheme>("classic");

  const updateProfileMutation = useMutation({
    mutationFn: async (body: Partial<Profile>) => {
      const res = await api.patch("/portal/me", body);
      return res.data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "me"] });
      setEditingProfile(false);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (body: { current_password: string; new_password: string }) => {
      await api.post("/auth/change-password", body);
    },
    onSuccess: () => setShowChangePassword(false),
  });

  const downloadPayslipPdf = async (payslipId: number) => {
    setPayslipError(null);
    try {
      const res = await api.get(`/portal/payslips/${payslipId}/pdf`, {
        params: { theme: payslipPdfTheme },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${payslipId}-${payslipPdfTheme}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setPayslipError("Download failed. Try again later.");
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "mydetails", label: "My details" },
    { id: "leave", label: "Leave" },
    { id: "attendance", label: "Attendance" },
    { id: "payslips", label: "Payslips" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">My portal</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          View your profile, request leave (sent to HR for approval), view attendance, and access your monthly payslips.
        </p>
      </div>

      <div className="border-b border-slate-200 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <nav className="flex gap-4 sm:gap-6 min-w-max sm:min-w-0">
          {(hasProfile ? tabs : tabs.filter((t) => t.id === "mydetails")).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`pb-3 pt-1 text-sm font-medium border-b-2 -mb-px whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                tab === t.id
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "mydetails" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6">
            {loadingProfile ? (
              <div className="text-slate-500 text-sm">Loading…</div>
            ) : profile ? (
              <>
                {profile.avatar_url && (
                  <div className="mb-4">
                    <img
                      src={getPortalAvatarUrl(profile.avatar_url)}
                      alt=""
                      className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-900">My details</h2>
                  {!editingProfile ? (
                    <button
                      type="button"
                      onClick={() => setEditingProfile(true)}
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      Edit details
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingProfile(false)}
                      className="text-sm font-medium text-slate-600 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {!editingProfile ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Employee number</dt>
                      <dd className="mt-0.5 font-mono text-slate-900">{profile.employee_number}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Name</dt>
                      <dd className="mt-0.5 text-slate-900">{profile.first_name} {profile.last_name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Email</dt>
                      <dd className="mt-0.5 text-slate-600">{profile.email ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">ID number</dt>
                      <dd className="mt-0.5 text-slate-600">{profile.id_number ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Passport number</dt>
                      <dd className="mt-0.5 text-slate-600">{profile.passport_number ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Tax number</dt>
                      <dd className="mt-0.5 text-slate-600">{profile.tax_number ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Department</dt>
                      <dd className="mt-0.5 text-slate-600">{profile.department ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Job title</dt>
                      <dd className="mt-0.5 text-slate-600">{profile.job_title ?? ""}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-slate-500 uppercase">Address</dt>
                      <dd className="mt-0.5 text-slate-600 whitespace-pre-wrap">{profile.address ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Phone</dt>
                      <dd className="mt-0.5 text-slate-600">{profile.phone ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Bank name</dt>
                      <dd className="mt-0.5 text-slate-600">{profile.bank_name ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Bank account number</dt>
                      <dd className="mt-0.5 text-slate-600 font-mono text-sm">{profile.bank_account_number ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Branch code</dt>
                      <dd className="mt-0.5 text-slate-600">{profile.bank_branch_code ?? ""}</dd>
                    </div>
                  </dl>
                ) : (
                  <ProfileEditForm
                    profile={profile}
                    onSave={(body) => updateProfileMutation.mutate(body)}
                    onCancel={() => setEditingProfile(false)}
                    isSubmitting={updateProfileMutation.isPending}
                    error={updateProfileMutation.isError ? "Failed to save. Try again." : undefined}
                  />
                )}
                <p className="text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100">
                  To update your profile photo, go to <Link to="/profile" className="font-medium text-emerald-600 hover:text-emerald-700">Profile</Link>.
                </p>
              </>
            ) : isProfileError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">Could not load your profile.</p>
                <p className="mt-1 text-amber-700">
                  {profileErrorMessage === "No employee profile linked to this account"
                    ? "No employee profile is linked to this account. Please ask your administrator to add you as an employee in HR."
                    : profileErrorMessage ?? "Something went wrong. Please try again or sign in again."}
                </p>
                {profileErrorMessage !== "Your session may have expired. Try signing in again." && (
                  <p className="mt-2 text-amber-700">
                    You can still update your account in <Link to="/profile" className="font-medium underline">Profile</Link>.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Could not load profile.</p>
            )}
          </div>

          {profile && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-2">Change password</h2>
              {!showChangePassword ? (
                <button
                  type="button"
                  onClick={() => setShowChangePassword(true)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Change my password
                </button>
              ) : (
                <ChangePasswordForm
                  onCancel={() => setShowChangePassword(false)}
                  onSubmit={(body) => changePasswordMutation.mutate(body)}
                  isSubmitting={changePasswordMutation.isPending}
                  error={changePasswordMutation.isError ? (changePasswordMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to change password." : undefined}
                />
              )}
            </div>
          )}
        </div>
      )}

      {tab === "leave" && (
        <div className="space-y-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Request leave below; requests are sent to HR for approval.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setRequestLeaveOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 min-h-[44px]"
            >
              Request leave
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Leave balances</h2>
            {!leaveBalances?.length ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No leave balances on record.</p>
            ) : (
              <ul className="space-y-2">
                {leaveBalances.map((lb) => (
                  <li key={lb.id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{lb.leave_type_name} ({lb.year})</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">Balance: {lb.balance} · Used: {lb.used}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden">
            <h2 className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600">My leave requests</h2>
            {!leaveRequests?.length ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">No leave requests. Use Request leave to submit one; HR will approve or reject.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[320px]">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="py-2 pl-4 text-left text-xs font-medium text-slate-500">Type</th>
                      <th className="py-2 px-4 text-left text-xs font-medium text-slate-500">Period</th>
                      <th className="py-2 px-4 text-left text-xs font-medium text-slate-500">Days</th>
                      <th className="py-2 pr-4 text-left text-xs font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaveRequests.map((lr) => (
                      <tr key={lr.id}>
                        <td className="py-2 pl-4">{lr.leave_type_name}</td>
                        <td className="py-2 px-4">{lr.start_date} → {lr.end_date}</td>
                        <td className="py-2 px-4">{lr.total_days}</td>
                        <td className="py-2 pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            lr.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                            lr.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {lr.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {requestLeaveOpen && leaveTypes && (
            <RequestLeaveModal
              leaveTypes={leaveTypes}
              onClose={() => setRequestLeaveOpen(false)}
              onSubmit={(data) => requestLeaveMutation.mutate(data)}
              isSubmitting={requestLeaveMutation.isPending}
            />
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold text-slate-800 border-b border-slate-200">My attendance</h2>
          {!attendance?.length ? (
            <div className="p-6 text-center text-slate-500 text-sm">No attendance records.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[280px]">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="py-2 pl-4 text-left text-xs font-medium text-slate-500">Date</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-slate-500">Check in</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-slate-500">Check out</th>
                    <th className="py-2 pr-4 text-left text-xs font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendance.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 pl-4">{a.date}</td>
                      <td className="py-2 px-4">{a.check_in ?? ""}</td>
                      <td className="py-2 px-4">{a.check_out ?? ""}</td>
                      <td className="py-2 pr-4">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 capitalize">{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "payslips" && (
        <div className="space-y-4">
          {payslipError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {payslipError}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
            <label htmlFor="portal-payslip-pdf-theme" className="font-medium text-slate-700">
              PDF design
            </label>
            <select
              id="portal-payslip-pdf-theme"
              value={payslipPdfTheme}
              onChange={(e) => setPayslipPdfTheme(e.target.value as PayslipPdfTheme)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {PAYSLIP_PDF_THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!payslips?.length ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">No payslips yet. Your monthly payslips will appear here once generated by your company.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[320px]">
                <thead className="border-b border-slate-200 bg-slate-50/50">
                  <tr>
                    <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 uppercase">Period</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 uppercase">Gross</th>
                    <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 uppercase">Net</th>
                    <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payslips.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-3 pl-4 text-slate-600">{p.period_start} to {p.period_end}</td>
                      <td className="py-3 px-4 text-right text-slate-800">{formatAmount(Number(p.gross), p.currency)}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">{formatAmount(Number(p.net), p.currency)}</td>
                      <td className="py-3 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => downloadPayslipPdf(p.id)}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
                        >
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileEditForm({
  profile,
  onSave,
  onCancel,
  isSubmitting,
  error,
}: {
  profile: Profile;
  onSave: (body: Partial<Profile>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string;
}) {
  const [first_name, setFirstName] = useState(profile.first_name);
  const [last_name, setLastName] = useState(profile.last_name);
  const [email, setEmail] = useState(profile.email ?? "");
  const [id_number, setIdNumber] = useState(profile.id_number ?? "");
  const [passport_number, setPassportNumber] = useState(profile.passport_number ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [bank_name, setBankName] = useState(profile.bank_name ?? "");
  const [bank_account_number, setBankAccountNumber] = useState(profile.bank_account_number ?? "");
  const [bank_branch_code, setBankBranchCode] = useState(profile.bank_branch_code ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim() || null,
      id_number: id_number.trim() || null,
      passport_number: passport_number.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      bank_name: bank_name.trim() || null,
      bank_account_number: bank_account_number.trim() || null,
      bank_branch_code: bank_branch_code.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">First name</label>
          <input value={first_name} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Last name</label>
          <input value={last_name} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">ID number</label>
          <input value={id_number} onChange={(e) => setIdNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Passport number</label>
          <input value={passport_number} onChange={(e) => setPassportNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Bank name</label>
          <input value={bank_name} onChange={(e) => setBankName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Bank account number</label>
          <input value={bank_account_number} onChange={(e) => setBankAccountNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Branch code</label>
          <input value={bank_branch_code} onChange={(e) => setBankBranchCode(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">{isSubmitting ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function ChangePasswordForm({
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: {
  onSubmit: (body: { current_password: string; new_password: string }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (newPassword.length < 8) {
      setLocalError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("New password and confirmation do not match.");
      return;
    }
    onSubmit({ current_password: currentPassword, new_password: newPassword });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      {(error || localError) && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error ?? localError}</p>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Current password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
          autoComplete="current-password"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">{isSubmitting ? "Updating…" : "Update password"}</button>
      </div>
    </form>
  );
}

function RequestLeaveModal({
  leaveTypes,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  leaveTypes: LeaveTypeOption[];
  onClose: () => void;
  onSubmit: (data: { leave_type_id: number; start_date: string; end_date: string; total_days: number; notes?: string }) => void;
  isSubmitting: boolean;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalDays, setTotalDays] = useState("");
  const [notes, setNotes] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveTypeId || !startDate || !endDate || !totalDays) return;
    onSubmit({
      leave_type_id: Number(leaveTypeId),
      start_date: startDate,
      end_date: endDate,
      total_days: Number(totalDays),
      notes: notes.trim() || undefined,
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Request leave</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Leave type</label>
            <select
              required
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select type</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>{lt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End date</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Total days</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              required
              value={totalDays}
              onChange={(e) => setTotalDays(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">Submit request</button>
          </div>
        </form>
      </div>
    </div>
  );
}

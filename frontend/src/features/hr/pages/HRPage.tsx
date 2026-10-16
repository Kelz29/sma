import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { BASE_CURRENCY_CODE, formatAmount } from "@/lib/currency";

type Tab = "employees" | "leave" | "attendance";

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

interface LeaveType {
  id: number;
  name: string;
  days_per_year: string;
  carry_over: boolean;
}

interface LeaveRequest {
  id: number;
  employee_name: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: string;
  status: string;
  notes?: string | null;
}

interface AttendanceRow {
  id: number;
  employee_id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  notes: string | null;
}

export function HRPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("employees");
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [newLeaveOpen, setNewLeaveOpen] = useState(false);
  const [addLeaveTypeOpen, setAddLeaveTypeOpen] = useState(false);
  const [attendanceEmployeeId, setAttendanceEmployeeId] = useState<string>("");
  const [attendanceFrom, setAttendanceFrom] = useState("");
  const [attendanceTo, setAttendanceTo] = useState("");
  const [attendanceForm, setAttendanceForm] = useState({
    date: "",
    status: "present",
    notes: "",
  });

  const { data: employees, isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await api.get("/employees/");
      return res.data;
    },
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["leave", "types"],
    queryFn: async () => {
      const res = await api.get("/leave/types");
      return res.data;
    },
  });

  const { data: leaveRequests } = useQuery<LeaveRequest[]>({
    queryKey: ["leave", "requests"],
    queryFn: async () => {
      const res = await api.get("/leave/requests");
      return res.data;
    },
  });

  const { data: attendance, isLoading: loadingAttendance } = useQuery<AttendanceRow[]>({
    queryKey: ["attendance", attendanceEmployeeId, attendanceFrom, attendanceTo],
    queryFn: async () => {
      if (!attendanceEmployeeId) return [];
      const res = await api.get("/attendance/", {
        params: {
          employee_id: Number(attendanceEmployeeId),
          from_date: attendanceFrom || undefined,
          to_date: attendanceTo || undefined,
        },
      });
      return res.data;
    },
    enabled: !!attendanceEmployeeId,
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await api.post("/employees/", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setAddEmployeeOpen(false);
      setEditingEmployeeId(null);
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (args: { id: number; body: Record<string, unknown> }) => {
      const res = await api.patch(`/employees/${args.id}`, args.body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setAddEmployeeOpen(false);
      setEditingEmployeeId(null);
    },
  });

  const createLeaveTypeMutation = useMutation({
    mutationFn: async (body: { name: string; days_per_year: number; carry_over: boolean }) => {
      const res = await api.post("/leave/types", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave", "types"] });
      setAddLeaveTypeOpen(false);
    },
  });

  const createLeaveRequestMutation = useMutation({
    mutationFn: async (body: { employee_id: number; leave_type_id: number; start_date: string; end_date: string; total_days: number; notes?: string }) => {
      const res = await api.post("/leave/requests", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave", "requests"] });
      setNewLeaveOpen(false);
    },
  });

  const updateLeaveStatusMutation = useMutation({
    mutationFn: async (args: { id: number; status: "approved" | "rejected" }) => {
      const res = await api.patch(`/leave/requests/${args.id}`, { status: args.status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave", "requests"] });
    },
  });

  const createAttendanceMutation = useMutation({
    mutationFn: async (body: { employee_id: number; date: string; status: string; notes?: string | null }) => {
      const res = await api.post("/attendance/", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setAttendanceForm((f) => ({ ...f, date: "", notes: "" }));
    },
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: "employees", label: "Employees" },
    { id: "leave", label: "Leave" },
    { id: "attendance", label: "Attendance" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">HR & Payroll</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Employee profiles, leave, and attendance. Payslips are managed under Accounting.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
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

      {tab === "employees" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { setEditingEmployeeId(null); setAddEmployeeOpen(true); }}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              + Add employee
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card shadow-apple overflow-hidden">
          {loadingEmployees ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading…</div>
          ) : !employees?.length ? (
            <div className="p-8 text-center text-slate-500 text-sm">No employees yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/50">
                <tr>
                  <th className="py-3 pl-4 text-left text-xs font-medium text-slate-500 uppercase">Number</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Department</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Job title</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 uppercase">Salary</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="py-3 pr-4 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50">
                    <td className="py-3 pl-4 font-mono text-slate-600">{emp.employee_number}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{emp.first_name} {emp.last_name}</td>
                    <td className="py-3 px-4 text-slate-600">{emp.department ?? ""}</td>
                    <td className="py-3 px-4 text-slate-600">{emp.job_title ?? ""}</td>
                    <td className="py-3 px-4 text-right text-slate-800">
                      {emp.salary != null ? formatAmount(Number(emp.salary), emp.currency ?? BASE_CURRENCY_CODE) : ""}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${emp.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {emp.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => { setEditingEmployeeId(emp.id); setAddEmployeeOpen(true); }}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
          {addEmployeeOpen && (
            <AddEmployeeModal
              employee={editingEmployeeId != null ? (employees ?? []).find((e) => e.id === editingEmployeeId) ?? null : null}
              onClose={() => { setAddEmployeeOpen(false); setEditingEmployeeId(null); }}
              onSubmit={(data) => createEmployeeMutation.mutate(data)}
              onUpdate={(id, data) => updateEmployeeMutation.mutate({ id, body: data })}
              isSubmitting={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
            />
          )}
        </div>
      )}

      {tab === "leave" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Configure leave types. Employees submit leave requests from their portal; approve or reject them below.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddLeaveTypeOpen(true)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                + Leave type
              </button>
              <button
                type="button"
                onClick={() => setNewLeaveOpen(true)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                disabled={!employees?.length || !leaveTypes?.length}
              >
                + Leave request
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Leave types</h2>
            {!leaveTypes?.length ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No leave types defined yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {leaveTypes.map((lt) => (
                  <li key={lt.id} className="rounded-lg bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300">
                    {lt.name}: {lt.days_per_year} days/year{lt.carry_over ? " · carry over" : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card overflow-hidden">
            <h2 className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600">Leave requests (approve or reject)</h2>
            {!leaveRequests?.length ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">No leave requests. Employees submit requests from My portal → Leave.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="py-2 pl-4 text-left text-xs font-medium text-slate-500">Employee</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-slate-500">Type</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-slate-500">Period</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-slate-500">Days</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-slate-500">Status</th>
                    <th className="py-2 pr-4 text-right text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaveRequests.map((lr) => (
                    <tr key={lr.id}>
                      <td className="py-2 pl-4">{lr.employee_name}</td>
                      <td className="py-2 px-4">{lr.leave_type_name}</td>
                      <td className="py-2 px-4">{lr.start_date} → {lr.end_date}</td>
                      <td className="py-2 px-4">{lr.total_days}</td>
                      <td className="py-2 px-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          lr.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                          lr.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {lr.status}
                        </span>
                        {lr.notes ? (
                          <div className="mt-0.5 text-[11px] text-slate-500 max-w-xs line-clamp-2">{lr.notes}</div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {lr.status === "pending" ? (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => updateLeaveStatusMutation.mutate({ id: lr.id, status: "approved" })}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                              disabled={updateLeaveStatusMutation.isPending}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => updateLeaveStatusMutation.mutate({ id: lr.id, status: "rejected" })}
                              className="text-xs font-medium text-red-600 hover:text-red-700"
                              disabled={updateLeaveStatusMutation.isPending}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {newLeaveOpen && employees && leaveTypes && (
            <NewLeaveRequestModal
              employees={employees}
              leaveTypes={leaveTypes}
              onClose={() => setNewLeaveOpen(false)}
              onSubmit={(data) => createLeaveRequestMutation.mutate(data)}
              isSubmitting={createLeaveRequestMutation.isPending}
            />
          )}
          {addLeaveTypeOpen && (
            <AddLeaveTypeModal
              onClose={() => setAddLeaveTypeOpen(false)}
              onSubmit={(data) => createLeaveTypeMutation.mutate(data)}
              isSubmitting={createLeaveTypeMutation.isPending}
            />
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Employee</label>
              <select
                value={attendanceEmployeeId}
                onChange={(e) => setAttendanceEmployeeId(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 min-w-[200px]"
              >
                <option value="">Select employee</option>
                {(employees ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} ({e.employee_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
              <input
                type="date"
                value={attendanceFrom}
                onChange={(e) => setAttendanceFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input
                type="date"
                value={attendanceTo}
                onChange={(e) => setAttendanceTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          {!attendanceEmployeeId ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-6 text-sm text-slate-500 dark:text-slate-400">
              Select an employee above to view or record attendance.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card overflow-hidden">
                <h2 className="px-4 py-3 text-sm font-semibold text-slate-800 border-b border-slate-200">
                  Attendance records
                </h2>
                {loadingAttendance ? (
                  <div className="p-6 text-center text-slate-500 text-sm">Loading…</div>
                ) : !attendance || attendance.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">No attendance records for this employee.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="py-2 pl-4 text-left text-xs font-medium text-slate-500">Date</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-slate-500">Status</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-slate-500">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attendance.map((row) => (
                        <tr key={row.id}>
                          <td className="py-2 pl-4">{row.date}</td>
                          <td className="py-2 px-4 capitalize">{row.status}</td>
                          <td className="py-2 pr-4 text-slate-600 text-xs">
                            {row.notes || ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-card p-4">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">Record attendance</h2>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!attendanceEmployeeId || !attendanceForm.date || createAttendanceMutation.isPending) return;
                    createAttendanceMutation.mutate({
                      employee_id: Number(attendanceEmployeeId),
                      date: attendanceForm.date,
                      status: attendanceForm.status,
                      notes: attendanceForm.notes.trim() || undefined,
                    });
                  }}
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={attendanceForm.date}
                      onChange={(e) => setAttendanceForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                    <select
                      value={attendanceForm.status}
                      onChange={(e) => setAttendanceForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="leave">On leave</option>
                      <option value="holiday">Holiday</option>
                      <option value="sick">Sick</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                    <textarea
                      rows={3}
                      value={attendanceForm.notes}
                      onChange={(e) => setAttendanceForm((f) => ({ ...f, notes: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Optional comments"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={!attendanceForm.date || createAttendanceMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                    >
                      {createAttendanceMutation.isPending ? "Saving…" : "Save record"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function AddEmployeeModal({
  employee,
  onClose,
  onSubmit,
  onUpdate,
  isSubmitting,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  onUpdate: (id: number, data: Record<string, unknown>) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState({
    employee_number: "",
    first_name: "",
    last_name: "",
    email: "",
    department: "",
    job_title: "",
    salary: "",
    is_active: true,
  });

  useEffect(() => {
    if (employee) {
      setForm({
        employee_number: employee.employee_number ?? "",
        first_name: employee.first_name ?? "",
        last_name: employee.last_name ?? "",
        email: employee.email ?? "",
        department: employee.department ?? "",
        job_title: employee.job_title ?? "",
        salary: employee.salary != null ? String(employee.salary) : "",
        is_active: employee.is_active ?? true,
      });
    } else {
      setForm({
        employee_number: "",
        first_name: "",
        last_name: "",
        email: "",
        department: "",
        job_title: "",
        salary: "",
        is_active: true,
      });
    }
  }, [employee]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      employee_number: form.employee_number.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || undefined,
      department: form.department.trim() || undefined,
      job_title: form.job_title.trim() || undefined,
      salary: form.salary ? Number(form.salary) : undefined,
      currency: BASE_CURRENCY_CODE,
      is_active: form.is_active,
    };
    if (employee) {
      onUpdate(employee.id, data);
    } else {
      onSubmit(data);
    }
  };

  const isEdit = employee != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{isEdit ? "Edit employee" : "Add employee"}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Employee number *"
            value={form.employee_number}
            onChange={(e) => setForm((f) => ({ ...f, employee_number: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="First name *"
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Last name *"
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Department"
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Job title"
            value={form.job_title}
            onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={`Monthly salary (${BASE_CURRENCY_CODE})`}
            value={form.salary}
            onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Active</span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {isEdit ? "Save changes" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewLeaveRequestModal({
  employees,
  leaveTypes,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  employees: Employee[];
  leaveTypes: LeaveType[];
  onClose: () => void;
  onSubmit: (data: { employee_id: number; leave_type_id: number; start_date: string; end_date: string; total_days: number; notes?: string }) => void;
  isSubmitting: boolean;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const computeTotalDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const diffMs = end.getTime() - start.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !leaveTypeId || !startDate || !endDate) return;
    const totalDays = computeTotalDays();
    if (!totalDays) return;
    onSubmit({
      employee_id: Number(employeeId),
      leave_type_id: Number(leaveTypeId),
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      notes: notes.trim() || undefined,
    });
  };

  const totalDays = computeTotalDays();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">New leave request</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Employee</label>
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name} ({e.employee_number})
                </option>
              ))}
            </select>
          </div>
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
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div className="text-xs text-slate-500">
            {totalDays > 0 ? `${totalDays} day${totalDays === 1 ? "" : "s"} requested` : "Select dates to see total days."}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Optional context for this request"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !employeeId || !leaveTypeId || !startDate || !endDate || !totalDays}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? "Creating…" : "Create request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddLeaveTypeModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; days_per_year: number; carry_over: boolean }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const [carryOver, setCarryOver] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !days) return;
    onSubmit({
      name: name.trim(),
      days_per_year: Number(days),
      carry_over: carryOver,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">New leave type</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Study Leave"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Days per year</label>
            <input
              type="number"
              required
              min={0}
              step="0.5"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="carry-over"
              type="checkbox"
              checked={carryOver}
              onChange={(e) => setCarryOver(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="carry-over" className="text-xs text-slate-600">
              Allow unused days to carry over to next year
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name || !days}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Save type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

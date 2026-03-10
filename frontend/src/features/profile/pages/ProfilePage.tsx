import { useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

/** Build full URL for avatar (backend returns path like /uploads/avatars/xxx). */
function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  const base = (api.defaults.baseURL ?? "").replace(/\/api\/v1\/?$/, "");
  return base ? `${base}${avatarUrl}` : avatarUrl;
}

interface AuthMe {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  tenant_id: number;
  is_owner: boolean;
  avatar_url?: string | null;
}

interface EmployeeProfile {
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
}

export function ProfilePage() {
  const { user } = useAuthStore();
  if (user?.role === "superadmin") {
    return <Navigate to="/superadmin" replace />;
  }
  const isEmployee = user?.role === "employee";
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const { data: authMe, isLoading: loadingAuth } = useQuery<AuthMe>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await api.get("/auth/me");
      return res.data;
    },
    enabled: true,
  });

  const {
    data: employeeProfile,
    isLoading: loadingEmployee,
    isError: employeeProfileError,
    error: employeeProfileErr,
  } = useQuery<EmployeeProfile>({
    queryKey: ["portal", "me"],
    queryFn: async () => {
      const res = await api.get("/portal/me");
      return res.data;
    },
    enabled: isEmployee,
  });

  const employeeErrorDetail =
    employeeProfileError && employeeProfileErr && typeof employeeProfileErr === "object" && "response" in employeeProfileErr
      ? (employeeProfileErr as { response?: { data?: { detail?: string } } }).response?.data?.detail
      : null;

  const updateAuthMutation = useMutation({
    mutationFn: async (body: { full_name?: string; email?: string }) => {
      const res = await api.patch("/auth/me", body);
      return res.data as AuthMe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setEditing(false);
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (body: Partial<EmployeeProfile>) => {
      const res = await api.patch("/portal/me", body);
      return res.data as EmployeeProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "me"] });
      setEditing(false);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (body: { current_password: string; new_password: string }) => {
      await api.post("/auth/change-password", body);
    },
    onSuccess: () => setShowChangePassword(false),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/auth/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as AuthMe;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  const isLoading = !authMe;
  const showEmployeeContent = isEmployee && employeeProfile;
  const showEmployeeError = isEmployee && employeeProfileError;
  const showUserContent = !isEmployee || !employeeProfile;
  const showEmployeeLoading = isEmployee && loadingEmployee;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Profile</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Update your profile picture, personal details, banking information, and password.
        </p>
      </div>

      {isLoading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : authMe ? (
        <>
          {showEmployeeLoading && (
            <p className="text-slate-500 text-sm">Loading your employee details…</p>
          )}
          {showEmployeeError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">Could not load your employee details.</p>
              <p className="mt-1 text-amber-700">
                {employeeErrorDetail === "No employee profile linked to this account"
                  ? "No employee profile is linked to this account. Please ask your administrator to add you as an employee in HR. You can still update your account details and password below."
                  : employeeErrorDetail ?? "Something went wrong. You can still update your account below."}
              </p>
            </div>
          )}
          {showEmployeeContent ? (
            <EmployeeProfileContent
              profile={employeeProfile}
              authMe={authMe}
              editing={editing}
              onEdit={() => setEditing(true)}
              onCancel={() => setEditing(false)}
              onSave={(body) => updateEmployeeMutation.mutate(body)}
              isSubmitting={updateEmployeeMutation.isPending}
              saveError={updateEmployeeMutation.isError ? "Failed to save. Try again." : undefined}
              showChangePassword={showChangePassword}
              onShowChangePassword={() => setShowChangePassword(true)}
              onChangePassword={(body) => changePasswordMutation.mutate(body)}
              changePasswordSubmitting={changePasswordMutation.isPending}
              changePasswordError={
                changePasswordMutation.isError
                  ? (changePasswordMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to change password."
                  : undefined
              }
              onCloseChangePassword={() => setShowChangePassword(false)}
              onUploadAvatar={(file) => uploadAvatarMutation.mutate(file)}
              avatarUploading={uploadAvatarMutation.isPending}
              avatarError={uploadAvatarMutation.isError ? "Upload failed. Try again." : undefined}
            />
          ) : showUserContent ? (
            <UserProfileContent
              me={authMe}
              editing={editing}
              onEdit={() => setEditing(true)}
              onCancel={() => setEditing(false)}
              onSave={(body) => updateAuthMutation.mutate(body)}
              isSubmitting={updateAuthMutation.isPending}
              saveError={updateAuthMutation.isError ? "Failed to save. Try again." : undefined}
              showChangePassword={showChangePassword}
              onShowChangePassword={() => setShowChangePassword(true)}
              onChangePassword={(body) => changePasswordMutation.mutate(body)}
              changePasswordSubmitting={changePasswordMutation.isPending}
              changePasswordError={
                changePasswordMutation.isError
                  ? (changePasswordMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to change password."
                  : undefined
              }
              onCloseChangePassword={() => setShowChangePassword(false)}
              onUploadAvatar={(file) => uploadAvatarMutation.mutate(file)}
              avatarUploading={uploadAvatarMutation.isPending}
              avatarError={uploadAvatarMutation.isError ? "Upload failed. Try again." : undefined}
            />
          ) : null}
        </>
      ) : (
        <p className="text-slate-500 text-sm">Could not load profile.</p>
      )}
    </div>
  );
}

function AvatarBlock({
  avatarUrl,
  displayName,
  onUpload,
  uploading,
  error,
}: {
  avatarUrl: string | null | undefined;
  displayName: string;
  onUpload: (file: File) => void;
  uploading: boolean;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fullUrl = getAvatarUrl(avatarUrl);
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) onUpload(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4">
      <div className="relative shrink-0">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-200 border-2 border-slate-200 flex items-center justify-center text-2xl font-semibold text-slate-500">
          {fullUrl ? (
            <img src={fullUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow hover:bg-emerald-700 disabled:opacity-50 text-sm"
          aria-label="Change photo"
        >
          {uploading ? "…" : "📷"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">Profile picture</p>
        <p className="text-xs text-slate-500 mt-0.5">JPEG, PNG, GIF or WebP. Max 2 MB.</p>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
    </div>
  );
}

function EmployeeProfileContent({
  profile,
  authMe,
  editing,
  onEdit,
  onCancel,
  onSave,
  isSubmitting,
  saveError,
  showChangePassword,
  onShowChangePassword,
  onChangePassword,
  changePasswordSubmitting,
  changePasswordError,
  onCloseChangePassword,
  onUploadAvatar,
  avatarUploading,
  avatarError,
}: {
  profile: EmployeeProfile;
  authMe: AuthMe;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (body: Partial<EmployeeProfile>) => void;
  isSubmitting: boolean;
  saveError?: string;
  showChangePassword: boolean;
  onShowChangePassword: () => void;
  onChangePassword: (body: { current_password: string; new_password: string }) => void;
  changePasswordSubmitting: boolean;
  changePasswordError?: string;
  onCloseChangePassword: () => void;
  onUploadAvatar: (file: File) => void;
  avatarUploading: boolean;
  avatarError?: string;
}) {
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || authMe.full_name || authMe.email || "Profile";
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6">
        <div className="mb-6">
          <AvatarBlock
            avatarUrl={authMe.avatar_url}
            displayName={displayName}
            onUpload={onUploadAvatar}
            uploading={avatarUploading}
            error={avatarError}
          />
        </div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">My details</h2>
          {!editing ? (
            <button type="button" onClick={onEdit} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
              Edit details
            </button>
          ) : (
            <button type="button" onClick={onCancel} className="text-sm font-medium text-slate-600 hover:text-slate-700">
              Cancel
            </button>
          )}
        </div>
        {!editing ? (
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
              <dd className="mt-0.5 text-slate-600">{profile.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">ID number</dt>
              <dd className="mt-0.5 text-slate-600">{profile.id_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Passport number</dt>
              <dd className="mt-0.5 text-slate-600">{profile.passport_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Tax number</dt>
              <dd className="mt-0.5 text-slate-600">{profile.tax_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Department</dt>
              <dd className="mt-0.5 text-slate-600">{profile.department ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Job title</dt>
              <dd className="mt-0.5 text-slate-600">{profile.job_title ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500 uppercase">Address</dt>
              <dd className="mt-0.5 text-slate-600 whitespace-pre-wrap">{profile.address ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Phone</dt>
              <dd className="mt-0.5 text-slate-600">{profile.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Bank name</dt>
              <dd className="mt-0.5 text-slate-600">{profile.bank_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Bank account number</dt>
              <dd className="mt-0.5 text-slate-600 font-mono text-sm">{profile.bank_account_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Branch code</dt>
              <dd className="mt-0.5 text-slate-600">{profile.bank_branch_code ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <EmployeeProfileForm
            profile={profile}
            onSave={onSave}
            onCancel={onCancel}
            isSubmitting={isSubmitting}
            error={saveError}
          />
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-2">Change password</h2>
        {!showChangePassword ? (
          <button type="button" onClick={onShowChangePassword} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
            Change my password
          </button>
        ) : (
          <ChangePasswordForm
            onCancel={onCloseChangePassword}
            onSubmit={onChangePassword}
            isSubmitting={changePasswordSubmitting}
            error={changePasswordError}
          />
        )}
      </div>
    </div>
  );
}

function UserProfileContent({
  me,
  editing,
  onEdit,
  onCancel,
  onSave,
  isSubmitting,
  saveError,
  showChangePassword,
  onShowChangePassword,
  onChangePassword,
  changePasswordSubmitting,
  changePasswordError,
  onCloseChangePassword,
  onUploadAvatar,
  avatarUploading,
  avatarError,
}: {
  me: AuthMe;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (body: { full_name?: string; email?: string }) => void;
  isSubmitting: boolean;
  saveError?: string;
  showChangePassword: boolean;
  onShowChangePassword: () => void;
  onChangePassword: (body: { current_password: string; new_password: string }) => void;
  changePasswordSubmitting: boolean;
  changePasswordError?: string;
  onCloseChangePassword: () => void;
  onUploadAvatar: (file: File) => void;
  avatarUploading: boolean;
  avatarError?: string;
}) {
  const displayName = me.full_name || me.email || "Profile";
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6">
        <div className="mb-6">
          <AvatarBlock
            avatarUrl={me.avatar_url}
            displayName={displayName}
            onUpload={onUploadAvatar}
            uploading={avatarUploading}
            error={avatarError}
          />
        </div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Account details</h2>
          {!editing ? (
            <button type="button" onClick={onEdit} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
              Edit details
            </button>
          ) : (
            <button type="button" onClick={onCancel} className="text-sm font-medium text-slate-600 hover:text-slate-700">
              Cancel
            </button>
          )}
        </div>
        {!editing ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Name</dt>
              <dd className="mt-0.5 text-slate-900">{me.full_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Email</dt>
              <dd className="mt-0.5 text-slate-600">{me.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Role</dt>
              <dd className="mt-0.5 text-slate-600 capitalize">{me.role}</dd>
            </div>
          </dl>
        ) : (
          <UserProfileForm
            me={me}
            onSave={onSave}
            onCancel={onCancel}
            isSubmitting={isSubmitting}
            error={saveError}
          />
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-2">Change password</h2>
        {!showChangePassword ? (
          <button type="button" onClick={onShowChangePassword} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
            Change my password
          </button>
        ) : (
          <ChangePasswordForm
            onCancel={onCloseChangePassword}
            onSubmit={onChangePassword}
            isSubmitting={changePasswordSubmitting}
            error={changePasswordError}
          />
        )}
      </div>
    </div>
  );
}

function UserProfileForm({
  me,
  onSave,
  onCancel,
  isSubmitting,
  error,
}: {
  me: AuthMe;
  onSave: (body: { full_name?: string; email?: string }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string;
}) {
  const [full_name, setFullName] = useState(me.full_name ?? "");
  const [email, setEmail] = useState(me.email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ full_name: full_name.trim() || undefined, email: email.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
          <input value={full_name} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">{isSubmitting ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function EmployeeProfileForm({
  profile,
  onSave,
  onCancel,
  isSubmitting,
  error,
}: {
  profile: EmployeeProfile;
  onSave: (body: Partial<EmployeeProfile>) => void;
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

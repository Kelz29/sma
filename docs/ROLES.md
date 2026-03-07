# Multi-tenant role structure

Multiple companies (tenants) use the same platform; **data is isolated per tenant**. Each user has a **role per tenant** that defines what they can see and do.

---

## System roles

### Super Admin (SmartSeen)

| Scope   | Description |
|--------|-------------|
| Platform | Full visibility across the entire platform. |
| Tenants  | View and manage all tenant companies. |
| Support  | Assist companies with troubleshooting; can impersonate tenant admins (with audit logging). |
| System   | Manage subscriptions, feature flags, and system-wide configurations. |
| Ops      | View system analytics and logs. |

**Backend role:** `superadmin`  
**Access:** Admin API only (e.g. list/manage tenants). Can bypass tenant role checks for support. **Impersonation** (act as a tenant admin with full audit logging) is planned and not yet implemented.

---

### Company Admin

| Scope   | Description |
|--------|-------------|
| Company | Manages their own company (tenant) account. |
| Users   | Create and manage users within the company; assign roles and permissions. |
| Settings| Configure company settings (tax, payroll, invoice templates, etc.). |
| Finance | View company-wide financial dashboards and all modules. |

**Backend role:** `admin`  
**Access:** All company modules (invoices, expenses, reports, banking, chart of accounts, HR, company settings). Only role that can update company settings.

---

### Accounting Department

| Scope   | Description |
|--------|-------------|
| Modules | Invoices, Expenses, Financial reports, Bank reconciliation, Chart of accounts. |
| Payroll | Access to payroll/payslips as required for accounting. |
| No HR   | Cannot access HR or employee personal information except as needed for payroll. |

**Backend role:** `accountant`  
**Access:** Invoices, expenses, reports, banking, accounts, company (read), payslips (for payroll). **No** employees, leave, or attendance.

---

### HR Department

| Scope   | Description |
|--------|-------------|
| Modules | Employee profiles, Leave management, Payroll records, Contracts. |
| No finance | Cannot access sensitive financial accounting (invoices, expenses, banking, chart of accounts, financial reports). |

**Backend role:** `hr`  
**Access:** Employees, leave, attendance, payslips. **No** invoices, expenses, banking, accounts, or financial reports. Company read-only for context.

---

### Employee

| Scope   | Description |
|--------|-------------|
| Self   | Limited to own information and tools. |
| Tools  | Payslips, Leave requests, Expense submissions, Personal profile. |

**Backend role:** `employee`  
**Access:** Portal only (own profile, leave, attendance, payslips). No access to company-wide data or HR/accounting modules.

---

## Role × module matrix

| Module / action        | superadmin | admin | accountant | hr | viewer | employee |
|-------------------------|------------|-------|------------|----|--------|----------|
| Admin (tenants)         | ✓          | —     | —          | —  | —      | —        |
| Dashboard               | ✓          | ✓     | ✓          | ✓  | ✓      | —        |
| Invoices                | ✓          | ✓     | ✓          | —  | ✓      | —        |
| Expenses                | ✓          | ✓     | ✓          | —  | ✓      | —        |
| Reports                 | ✓          | ✓     | ✓          | —  | ✓      | —        |
| Banking                 | ✓          | ✓     | ✓          | —  | ✓      | —        |
| Chart of accounts       | ✓          | ✓     | ✓          | —  | ✓      | —        |
| Company (read)          | ✓          | ✓     | ✓          | ✓  | ✓      | —        |
| Company (update)        | —          | ✓     | —          | —  | —      | —        |
| Employees (HR)          | ✓          | ✓     | —          | ✓  | —      | —        |
| Leave (manage)          | ✓          | ✓     | —          | ✓  | —      | —        |
| Attendance (manage)     | ✓          | ✓     | —          | ✓  | —      | —        |
| Payslips (list/create)  | ✓          | ✓     | ✓          | ✓  | —      | own only |
| Portal (self)           | —          | —     | —          | —  | —      | ✓        |

**viewer** = read-only accounting (invoices, expenses, reports, banking, accounts, company). No HR, no payslips.

---

## Frontend navigation by role

- **Dashboard:** admin, accountant, hr, viewer  
- **Invoices, Expenses, Reports, Banking, Settings:** admin, accountant, viewer  
- **HR (employees):** admin, hr  
- **My portal:** employee  
- **Superadmin:** superadmin  

Route guards enforce the same roles; API returns 403 if a user hits an endpoint they are not allowed to use.

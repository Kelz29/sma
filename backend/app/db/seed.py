from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.models.tenant import Tenant, TenantStatus
from app.db.models.user import User, TenantUser
from app.db.models.hr import Employee, LeaveType
from app.db.models.accounting import (
  Account,
  AccountCategory,
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  ExpenseCategory,
  Vendor,
  Expense,
  ExpenseStatus,
  BankAccount,
  BankTransaction,
)
from app.utils.password import get_password_hash


def get_or_create_tenant(db: Session, name: str, slug: str) -> Tenant:
  tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
  if tenant:
    return tenant

  tenant = Tenant(name=name, slug=slug, status=TenantStatus.active)
  db.add(tenant)
  db.commit()
  db.refresh(tenant)
  return tenant


def get_or_create_user(db: Session, email: str, password: str, full_name: str) -> User:
  user = db.query(User).filter(User.email == email).first()
  if user:
    return user

  user = User(
    email=email,
    full_name=full_name,
    hashed_password=get_password_hash(password),
    is_active=True,
  )
  db.add(user)
  db.commit()
  db.refresh(user)
  return user


def ensure_tenant_link(
  db: Session,
  tenant: Tenant,
  user: User,
  role: str,
  is_owner: bool = False,
) -> TenantUser:
  link = (
    db.query(TenantUser)
    .filter(
      TenantUser.tenant_id == tenant.id,
      TenantUser.user_id == user.id,
    )
    .first()
  )
  if link:
    # Optionally update role/owner flag to the most privileged variant.
    link.role = role
    link.is_owner = is_owner or link.is_owner
    db.commit()
    db.refresh(link)
    return link

  link = TenantUser(
    tenant_id=tenant.id,
    user_id=user.id,
    role=role,
    is_owner=is_owner,
  )
  db.add(link)
  db.commit()
  db.refresh(link)
  return link


def seed_accounts(db: Session, tenant_id: int) -> None:
  if db.query(Account).filter(Account.tenant_id == tenant_id).first():
    return

  accounts = [
    ("1000", "Cash", AccountCategory.asset),
    ("1100", "Bank", AccountCategory.asset),
    ("1200", "Accounts Receivable", AccountCategory.asset),
    ("2000", "Accounts Payable", AccountCategory.liability),
    ("3000", "Owner's Equity", AccountCategory.equity),
    ("4000", "Sales Revenue", AccountCategory.revenue),
    ("5000", "Operating Expenses", AccountCategory.expense),
  ]

  for code, name, category in accounts:
    db.add(
      Account(
        tenant_id=tenant_id,
        code=code,
        name=name,
        category=category,
        opening_debit=0,
        opening_credit=0,
        is_active=True,
      )
    )

  db.commit()


def seed_invoices(db: Session, tenant_id: int) -> None:
  if db.query(Invoice).filter(Invoice.tenant_id == tenant_id).first():
    return

  invoice = Invoice(
    tenant_id=tenant_id,
    invoice_number=1001,
    customer_name="Acme Customer",
    customer_email="billing@acme-customer.test",
    issue_date=date.today(),
    due_date=date.today(),
    currency="ZAR",
    subtotal=1000,
    vat_amount=150,
    total=1150,
    status=InvoiceStatus.sent,
    vat_rate=15,
    vat_country="US",
    is_recurring=False,
    notes="Sample invoice to demonstrate the UI.",
  )
  db.add(invoice)
  db.flush()

  line = InvoiceLine(
    invoice_id=invoice.id,
    tenant_id=tenant_id,
    description="Accounting services - monthly",
    quantity=1,
    unit_price=1000,
    vat_rate=15,
    line_total=1150,
  )
  db.add(line)
  db.commit()


def seed_expenses(db: Session, tenant_id: int, created_by_user_id: int) -> None:
  if db.query(Expense).filter(Expense.tenant_id == tenant_id).first():
    return

  category = ExpenseCategory(
    tenant_id=tenant_id,
    name="Software subscriptions",
    tax_rate=15,
  )
  db.add(category)
  db.flush()

  vendor = Vendor(
    tenant_id=tenant_id,
    name="SaaS Corp",
    tax_number="VAT-123",
    email="billing@saas-corp.test",
    is_active=True,
  )
  db.add(vendor)
  db.flush()

  expense = Expense(
    tenant_id=tenant_id,
    vendor_id=vendor.id,
    category_id=category.id,
    description="Monthly accounting software subscription",
    date=date.today(),
    amount=99,
    tax_amount=14.85,
    currency="ZAR",
    status=ExpenseStatus.approved,
    created_by_user_id=created_by_user_id,
    approved_by_user_id=created_by_user_id,
    is_deleted=False,
  )
  db.add(expense)
  db.commit()


def seed_banking(db: Session, tenant_id: int) -> None:
  if db.query(BankAccount).filter(BankAccount.tenant_id == tenant_id).first():
    return

  account = BankAccount(
    tenant_id=tenant_id,
    name="Main Operating Account",
    bank_name="Sample Bank",
    iban="DE89 3704 0044 0532 0130 00",
    currency="ZAR",
    opening_balance=5000,
  )
  db.add(account)
  db.flush()

  tx1 = BankTransaction(
    tenant_id=tenant_id,
    bank_account_id=account.id,
    date=date.today(),
    description="Invoice #1001 payment",
    amount=1150,
    balance_after=6150,
    matched_invoice_id=None,
    matched_expense_id=None,
    is_reconciled=False,
  )

  tx2 = BankTransaction(
    tenant_id=tenant_id,
    bank_account_id=account.id,
    date=date.today(),
    description="Software subscription",
    amount=-99,
    balance_after=6051,
    matched_invoice_id=None,
    matched_expense_id=None,
    is_reconciled=False,
  )

  db.add_all([tx1, tx2])
  db.commit()


def seed_leave_types(db: Session, tenant_id: int) -> None:
  """Create preliminary leave types if none exist for the tenant."""
  if db.query(LeaveType).filter(LeaveType.tenant_id == tenant_id).first():
    return

  # Common leave types with typical defaults (days per year, carry over)
  leave_types = [
    ("Annual Leave", Decimal("21"), True),
    ("Sick Leave", Decimal("10"), False),
    ("Family Responsibility Leave", Decimal("3"), False),
    ("Maternity Leave", Decimal("0"), False),  # Often allocated per event, not annual
    ("Paternity Leave", Decimal("10"), False),
    ("Bereavement Leave", Decimal("5"), False),
    ("Unpaid Leave", Decimal("0"), False),
  ]

  for name, days_per_year, carry_over in leave_types:
    db.add(
      LeaveType(
        tenant_id=tenant_id,
        name=name,
        days_per_year=days_per_year,
        carry_over=carry_over,
        is_active=True,
      )
    )

  db.commit()


def main() -> None:
  db = SessionLocal()
  try:
    # Tenants
    demo_tenant = get_or_create_tenant(db, name="Demo Company", slug="demo")

    # Users & roles
    superadmin_user = get_or_create_user(
      db,
      email="superadmin@example.com",
      password="Password123!",
      full_name="Super Admin",
    )
    admin_user = get_or_create_user(
      db,
      email="admin@example.com",
      password="Password123!",
      full_name="Tenant Admin",
    )
    accountant_user = get_or_create_user(
      db,
      email="accountant@example.com",
      password="Password123!",
      full_name="Accountant User",
    )
    viewer_user = get_or_create_user(
      db,
      email="viewer@example.com",
      password="Password123!",
      full_name="Viewer User",
    )
    hr_user = get_or_create_user(
      db,
      email="hr@example.com",
      password="Password123!",
      full_name="HR User",
    )
    employee_user = get_or_create_user(
      db,
      email="employee@example.com",
      password="Password123!",
      full_name="Demo Employee",
    )

    ensure_tenant_link(db, demo_tenant, superadmin_user, role="superadmin", is_owner=True)
    ensure_tenant_link(db, demo_tenant, admin_user, role="admin")
    ensure_tenant_link(db, demo_tenant, accountant_user, role="accountant")
    ensure_tenant_link(db, demo_tenant, viewer_user, role="viewer")
    ensure_tenant_link(db, demo_tenant, hr_user, role="hr")
    ensure_tenant_link(db, demo_tenant, employee_user, role="employee")

    # Demo employee record (portal self-service)
    if not db.query(Employee).filter(Employee.tenant_id == demo_tenant.id, Employee.user_id == employee_user.id).first():
      demo_employee = Employee(
        tenant_id=demo_tenant.id,
        user_id=employee_user.id,
        employee_number="DEMO001",
        first_name="Demo",
        last_name="Employee",
        email=employee_user.email,
        department="Operations",
        job_title="Staff",
        currency="ZAR",
        is_active=True,
      )
      db.add(demo_employee)
      db.commit()

    # Smart Mac Mane tenant and user (kelello@smartmacmane.co.za)
    smm_tenant = get_or_create_tenant(db, name="Smart Mac Mane", slug="smartmacmane")
    kelello_user = get_or_create_user(
      db,
      email="kelello@smartmacmane.co.za",
      password="Password123!",
      full_name="Kelello",
    )
    ensure_tenant_link(db, smm_tenant, kelello_user, role="admin", is_owner=True)
    seed_accounts(db, tenant_id=smm_tenant.id)
    seed_leave_types(db, tenant_id=smm_tenant.id)

    # Seed core domain data
    seed_accounts(db, tenant_id=demo_tenant.id)
    seed_invoices(db, tenant_id=demo_tenant.id)
    seed_expenses(db, tenant_id=demo_tenant.id, created_by_user_id=admin_user.id)
    seed_banking(db, tenant_id=demo_tenant.id)
    seed_leave_types(db, tenant_id=demo_tenant.id)

    print("Database seeded successfully with demo tenant and sample data.")
    print("Demo tenant slug: demo")
    print("Users:")
    print("  superadmin@example.com / Password123!  (superadmin)")
    print("  admin@example.com      / Password123!  (admin)")
    print("  accountant@example.com / Password123!  (accountant)")
    print("  viewer@example.com     / Password123!  (viewer)")
    print("  hr@example.com        / Password123!  (hr)")
    print("  employee@example.com  / Password123!  (employee, tenant: demo)")
    print("  kelello@smartmacmane.co.za / Password123!  (admin, tenant: smartmacmane)")
  finally:
    db.close()


if __name__ == "__main__":
  main()


"""Utility script to create or promote a Super Admin user for a tenant.

Usage (from backend/ directory):

  python -m app.scripts.create_superadmin \\
    --email you@example.com \\
    --password 'YourStrongPassword123!' \\
    --full-name 'Your Name' \\
    --tenant-slug demo

If the user already exists, they are linked to the tenant (if not already)
and their role is updated to `superadmin` with `is_owner=True`.
"""

from __future__ import annotations

import argparse

from app.db.session import SessionLocal
from app.db.seed import get_or_create_tenant, get_or_create_user, ensure_tenant_link


def main() -> None:
  parser = argparse.ArgumentParser(description="Create or promote a Super Admin for a tenant.")
  parser.add_argument("--email", required=True, help="User email for the super admin account")
  parser.add_argument("--password", required=True, help="Password for the super admin account")
  parser.add_argument("--full-name", required=True, help="Full name for the user")
  parser.add_argument(
    "--tenant-slug",
    required=True,
    help="Slug of the tenant to associate the super admin with (e.g. demo)",
  )
  args = parser.parse_args()

  db = SessionLocal()
  try:
    tenant = get_or_create_tenant(db, name=args.tenant_slug.title(), slug=args.tenant_slug)
    user = get_or_create_user(db, email=args.email, password=args.password, full_name=args.full_name)
    ensure_tenant_link(db, tenant, user, role="superadmin", is_owner=True)

    print("Super Admin created / updated successfully.")
    print(f"Tenant slug: {tenant.slug}")
    print(f"Email: {args.email}")
    print(f"Password: {args.password}")
    print("Role: superadmin")
  finally:
    db.close()


if __name__ == "__main__":
  main()


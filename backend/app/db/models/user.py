from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class User(Base):
  __tablename__ = "users"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
  full_name: Mapped[str | None] = mapped_column(String(255))
  hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
  is_active: Mapped[bool] = mapped_column(Boolean, default=True)
  avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

  tenant_links: Mapped[list["TenantUser"]] = relationship(back_populates="user")


class TenantUser(Base):
  __tablename__ = "tenant_users"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
  user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
  # Roles: superadmin, admin, accountant, hr, viewer, employee (see docs/ROLES.md)
  role: Mapped[str] = mapped_column(String(50), default="viewer")
  is_owner: Mapped[bool] = mapped_column(Boolean, default=False)

  tenant: Mapped["Tenant"] = relationship(back_populates="users")
  user: Mapped["User"] = relationship(back_populates="tenant_links")


"""Bootstrap the first administrator account.

Usage:
    python scripts/seed_admin.py --email admin@example.com --password 'StrongPass!123'
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.security import hash_password, normalize_email  # noqa: E402
from app.models import User, UserRole  # noqa: E402


async def seed(email: str, password: str) -> int:
    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        await _seed_with_session(factory, email, password)
    finally:
        await engine.dispose()


async def _seed_with_session(factory: async_sessionmaker, email: str, password: str) -> None:
    async with factory() as db:
        existing = await db.scalar(select(User).where(User.email == normalize_email(email)))
        if existing is not None:
            if existing.role != UserRole.ADMIN:
                existing.role = UserRole.ADMIN
                await db.commit()
                print(f"Promoted existing account {existing.email} to administrator.")
                return
            print(f"Administrator {existing.email} already exists.")
            return

        admin = User(
            email=normalize_email(email),
            full_name="Platform Administrator",
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            storage_quota_bytes=settings.DEFAULT_USER_QUOTA_BYTES,
            storage_used_bytes=0,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        print(f"Created administrator {admin.email}.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Create the initial administrator account")
    parser.add_argument("--email", default=os.environ.get("ADMIN_EMAIL"))
    parser.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD"))
    args = parser.parse_args()
    if not args.email or not args.password:
        parser.error("Provide --email/--password or set ADMIN_EMAIL/ADMIN_PASSWORD")
    if len(args.password) < 12:
        parser.error("Administrator password must be at least 12 characters")
    return asyncio.run(seed(args.email, args.password))


if __name__ == "__main__":
    raise SystemExit(main())

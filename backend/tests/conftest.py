import os
import shutil
from pathlib import Path

# Configure the isolated test environment before any app module imports settings.
TEST_VAULT = Path("/tmp/opencode/sfmp_test_vault")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ["STORAGE_ROOT"] = str(TEST_VAULT)
os.environ.setdefault("ENVIRONMENT", "test")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from limits.storage import MemoryStorage  # noqa: E402
from limits.strategies import FixedWindowRateLimiter  # noqa: E402

from app.core.limiter import limiter  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


def _use_memory_limiter() -> None:
    """Avoid depending on a live Redis during unit/integration tests."""
    storage = MemoryStorage()
    limiter._storage = storage
    limiter._limiter = FixedWindowRateLimiter(storage)
    fallback = MemoryStorage()
    limiter._fallback_storage = fallback
    limiter._fallback_limiter = FixedWindowRateLimiter(fallback)
    limiter._storage_dead = False
    limiter.reset()


@pytest_asyncio.fixture(autouse=True)
async def isolated_environment():
    _use_memory_limiter()
    if TEST_VAULT.exists():
        shutil.rmtree(TEST_VAULT)
    TEST_VAULT.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    limiter.reset()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    if TEST_VAULT.exists():
        shutil.rmtree(TEST_VAULT)


@pytest_asyncio.fixture
async def client():
    import httpx

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


# make_user helper is defined in test_security.py to keep this environment simple.

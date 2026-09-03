"""Tiny forward-only migration runner: applies unapplied numbered .sql files in
order, each in a transaction, tracked in schema_migrations. Deliberately not
Alembic — the DDL itself is the learning artifact here."""
import asyncio
import os
import pathlib
import sys

import asyncpg

MIGRATIONS_DIR = pathlib.Path(__file__).parent
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://korch:korch@localhost:5432/korchindex")


async def main() -> None:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "  filename TEXT PRIMARY KEY,"
            "  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()"
            ")"
        )
        applied = {r["filename"] for r in await conn.fetch("SELECT filename FROM schema_migrations")}
        pending = sorted(p for p in MIGRATIONS_DIR.glob("[0-9]*.sql") if p.name not in applied)
        if not pending:
            print("No pending migrations.")
            return
        for path in pending:
            async with conn.transaction():
                await conn.execute(path.read_text())
                await conn.execute("INSERT INTO schema_migrations (filename) VALUES ($1)", path.name)
            print(f"Applied {path.name}")
    finally:
        await conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"Migration failed: {e}", file=sys.stderr)
        sys.exit(1)

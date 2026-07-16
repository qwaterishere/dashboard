"""CLI: одноразовые ключи регистрации.

    cd backend
    PYTHONPATH=. .venv/bin/python -m src.cli.create_invite
    PYTHONPATH=. .venv/bin/python -m src.cli.create_invite --ttl-days 7 --note "Ташкент"
"""

from __future__ import annotations

import argparse
import sys

from src.db.session import db_manager
from src.services.invites import DEFAULT_TTL_DAYS, create_invite


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Создать одноразовый ключ доступа для регистрации",
    )
    parser.add_argument(
        "--ttl-days",
        type=int,
        default=DEFAULT_TTL_DAYS,
        metavar="N",
        help=f"срок жизни ключа в днях (по умолчанию {DEFAULT_TTL_DAYS})",
    )
    parser.add_argument(
        "--note",
        type=str,
        default=None,
        help="опциональная пометка (кому выдан, точка и т.п.)",
    )
    args = parser.parse_args()

    if args.ttl_days < 1:
        print("ttl-days must be >= 1", file=sys.stderr)
        raise SystemExit(2)

    db_manager.create_all()
    session = db_manager.get_session()
    try:
        raw, invite = create_invite(session, ttl_days=args.ttl_days, note=args.note)
        session.commit()
        expires_at = invite.expires_at
        invite_id = invite.id
        invite_note = invite.note
    except Exception as exc:
        session.rollback()
        print(f"failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    finally:
        session.close()

    print(raw, flush=True)
    meta = f"# expires_at={expires_at.isoformat()} id={invite_id}"
    if invite_note:
        meta += f" note={invite_note}"
    print(meta, file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()

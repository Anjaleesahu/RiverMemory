"""Create or reset an admin user. Password comes from ADMIN_PASSWORD or an interactive prompt.

Usage (from backend/):  python -m scripts.create_admin <username>
"""
import getpass
import os
import sys

from sqlalchemy import select

from app.auth import hash_password
from app.db import Base, SessionLocal, engine
from app.models import User

Base.metadata.create_all(bind=engine)
username = sys.argv[1] if len(sys.argv) > 1 else input("Admin username: ").strip()
password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Admin password (min 10 chars): ")
if len(password) < 10:
    sys.exit("Password must be at least 10 characters.")
with SessionLocal() as db:
    u = db.scalar(select(User).where(User.username == username))
    if u:
        u.password_hash = hash_password(password)
        print(f"Updated password for '{username}'.")
    else:
        db.add(User(username=username, password_hash=hash_password(password), is_admin=True))
        print(f"Created admin '{username}'.")
    db.commit()

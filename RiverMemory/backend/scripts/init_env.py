"""Create backend/.env with a strong JWT secret if it does not exist (never overwrites)."""
import secrets
from pathlib import Path

env = Path(__file__).resolve().parent.parent / ".env"
if env.exists():
    print(f"{env} already exists; not modified. Edit JWT_SECRET there if it is shorter than 32 bytes.")
else:
    example = (env.parent / ".env.example").read_text()
    env.write_text(example.replace("JWT_SECRET=", f"JWT_SECRET={secrets.token_urlsafe(48)}", 1))
    print(f"Created {env} with a generated JWT secret. Do not commit this file.")

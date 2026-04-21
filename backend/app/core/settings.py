from pathlib import Path
import tomllib

BASE_DIR = Path(__file__).resolve().parents[3]
SECRETS_FILE = BASE_DIR / ".streamlit" / "secrets.toml"

if not SECRETS_FILE.exists():
    raise RuntimeError(
        "Missing .streamlit/secrets.toml. Create it from the README template before starting the backend."
    )

with open(SECRETS_FILE, "rb") as f:
    secrets = tomllib.load(f)

firebase_client = secrets["firebase_client"]
firebase_admin = secrets["firebase_admin"]
google_login = secrets.get("google_login", secrets.get("google-login", {}))

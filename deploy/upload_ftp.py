#!/usr/bin/env python3
"""Upload a built frontend tree over FTP or explicit FTPS.

Credentials and options come from the environment (see frontend-ftp.env.example).
The password is never printed.
"""
from __future__ import annotations

import os
import ssl
import sys
from ftplib import FTP, FTP_TLS, error_perm
from pathlib import Path

PROTECTED_NAMES = {
    "mail",
    "etc",
    "logs",
    "ssl",
    "public_html",
    "private_html",
    "tmp",
    "cgi-bin",
    ".cpanel",
    ".trash",
    ".htpasswds",
    "perl5",
    "access-logs",
}


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def connect():
    host = env("FTP_HOST")
    if not host:
        raise SystemExit(
            "FTP_HOST is empty. Set the Afrihost origin hostname or IP in "
            "~/Documents/sma/frontend-ftp.env. app.smartseen.co.za is behind "
            "Cloudflare and does not accept FTP."
        )
    user = env("FTP_USER")
    password = os.environ.get("FTP_PASSWORD", "")
    if not user or not password:
        raise SystemExit("FTP_USER and FTP_PASSWORD are required.")
    port = int(env("FTP_PORT", "21") or "21")
    mode = env("FTP_TLS", "auto").lower()
    verify = env("FTP_TLS_VERIFY", "0") == "1"

    attempts: list[str] = []
    if mode in {"auto", "tls", "ftps"}:
        attempts.append("tls")
    if mode in {"auto", "plain", "ftp"}:
        attempts.append("plain")
    if not attempts:
        raise SystemExit(f"Unknown FTP_TLS value: {mode}")

    last: Exception | None = None
    for kind in attempts:
        try:
            if kind == "tls":
                context = ssl.create_default_context()
                if not verify:
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                ftp: FTP = FTP_TLS(context=context)
                ftp.connect(host, port, timeout=60)
                ftp.auth()
                ftp.login(user, password)
                ftp.prot_p()
            else:
                ftp = FTP()
                ftp.connect(host, port, timeout=60)
                ftp.login(user, password)
            ftp.set_pasv(True)
            print(f"Connected to {host}:{port} via {kind}")
            return ftp
        except Exception as exc:  # noqa: BLE001 — try the next mode
            last = exc
            print(f"FTP {kind} login failed: {exc}", file=sys.stderr)
    raise SystemExit(f"Could not log in to FTP host {host}: {last}")


def normalize_remote(path: str) -> str:
    path = path.strip() or "/"
    if not path.startswith("/"):
        path = "/" + path
    return path.rstrip("/") or "/"


def list_mlsd(ftp: FTP, remote: str) -> list[tuple[str, dict[str, str]]]:
    entries: list[tuple[str, dict[str, str]]] = []
    for name, facts in ftp.mlsd(remote):
        if name in {".", ".."}:
            continue
        entries.append((name, {k.lower(): v for k, v in facts.items()}))
    return entries


def top_level_names(ftp: FTP) -> list[str]:
    try:
        return [name for name, _facts in list_mlsd(ftp, "/")]
    except Exception:
        ftp.cwd("/")
        return [Path(name).name for name in ftp.nlst()]


def ensure_remote_dir(ftp: FTP, remote: str) -> None:
    ftp.cwd("/")
    if remote == "/":
        return
    for part in [p for p in remote.split("/") if p]:
        try:
            ftp.cwd(part)
        except error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def local_files(root: Path) -> list[Path]:
    files = [
        path
        for path in root.rglob("*")
        if path.is_file() and path.name != ".DS_Store"
    ]
    # index.html last so new hashed assets exist before the page points at them.
    files.sort(key=lambda path: (path.name == "index.html", str(path)))
    return files


def upload_tree(ftp: FTP, local_root: Path, remote_root: str) -> set[str]:
    uploaded: set[str] = set()
    for path in local_files(local_root):
        rel = path.relative_to(local_root).as_posix()
        remote_parent = remote_root
        parent = path.parent.relative_to(local_root).as_posix()
        if parent != ".":
            remote_parent = f"{remote_root}/{parent}" if remote_root != "/" else f"/{parent}"
        ensure_remote_dir(ftp, remote_parent)
        with path.open("rb") as handle:
            ftp.storbinary(f"STOR {path.name}", handle)
        uploaded.add(rel)
        print(f"uploaded {rel}")
    return uploaded


def collect_remote_files(ftp: FTP, remote: str, prefix: str = "") -> set[str]:
    found: set[str] = set()
    for name, facts in list_mlsd(ftp, remote):
        rel = f"{prefix}/{name}" if prefix else name
        kind = facts.get("type", "")
        if kind in {"dir", "cdir", "pdir"} or kind.startswith("dir"):
            if kind == "dir":
                child = f"{remote}/{name}" if remote != "/" else f"/{name}"
                found |= collect_remote_files(ftp, child, rel)
            continue
        found.add(rel)
    return found


def delete_stale(ftp: FTP, remote_root: str, keep: set[str]) -> None:
    try:
        remote_files = collect_remote_files(ftp, remote_root)
    except Exception as exc:  # noqa: BLE001
        print(f"Skipping stale-file cleanup (listing failed): {exc}", file=sys.stderr)
        return
    stale = sorted(remote_files - keep, key=lambda rel: rel.count("/"), reverse=True)
    for rel in stale:
        remote = f"{remote_root}/{rel}" if remote_root != "/" else f"/{rel}"
        try:
            ftp.delete(remote)
            print(f"deleted {rel}")
        except error_perm as exc:
            print(f"could not delete {rel}: {exc}", file=sys.stderr)
    # Remove directories that are now empty, deepest first.
    dirs = sorted(
        {str(Path(rel).parent) for rel in stale if Path(rel).parent != Path(".")},
        key=lambda rel: rel.count("/"),
        reverse=True,
    )
    for rel in dirs:
        if rel in {".", ""}:
            continue
        remote = f"{remote_root}/{rel}" if remote_root != "/" else f"/{rel}"
        try:
            ftp.rmd(remote)
            print(f"removed dir {rel}")
        except error_perm:
            pass


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: upload_ftp.py <local-dist-dir>")
    local_root = Path(sys.argv[1]).resolve()
    if not (local_root / "index.html").is_file():
        raise SystemExit(f"No index.html in {local_root}")

    remote_root = normalize_remote(env("FTP_REMOTE_DIR", "/"))
    ftp = connect()
    try:
        if remote_root == "/":
            names = set(top_level_names(ftp))
            blocked = sorted(names & PROTECTED_NAMES)
            if blocked:
                raise SystemExit(
                    "Refusing to upload to the FTP account root because it contains "
                    f"{', '.join(blocked)}. Set FTP_REMOTE_DIR to the site folder "
                    "(often public_html or the addon-domain directory)."
                )
        ensure_remote_dir(ftp, remote_root)
        uploaded = upload_tree(ftp, local_root, remote_root)
        if env("FTP_DELETE_STALE", "1") == "1":
            delete_stale(ftp, remote_root, uploaded)
        print(f"Upload complete ({len(uploaded)} files) -> {remote_root}")
    finally:
        try:
            ftp.quit()
        except Exception:
            pass


if __name__ == "__main__":
    main()

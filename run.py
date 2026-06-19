"""
RideShare - One-Command Project Launcher
=========================================
Run this file to install all dependencies, set up the database,
and start both the backend API server and the frontend dev server.

Usage:
    python run.py

Requirements:
    - Node.js v18+ and npm must be installed
    - Python 3.8+ (for running this script)
"""

import subprocess
import sys
import os
import shutil
import io

# Force UTF-8 output on Windows to avoid encoding crashes
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# -- Configuration -----------------------------------------------------------

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.join(ROOT_DIR, "server")
RIDER_DIR = os.path.join(ROOT_DIR, "rider-app")

# ANSI color codes (work on Windows 10+ and all modern terminals)
class C:
    CYAN    = "\033[96m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    RED     = "\033[91m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    END     = "\033[0m"


def log(msg, color=C.CYAN):
    print(f"{color}  > {msg}{C.END}")


def header(msg):
    line = "-" * 58
    print()
    print(f"{C.CYAN}{C.BOLD}  {line}")
    print(f"    {msg}")
    print(f"  {line}{C.END}")
    print()


def check_command(cmd):
    """Check if a command exists on the system PATH."""
    return shutil.which(cmd) is not None


def run(cmd, cwd=None):
    """Run a shell command and stream output in real time."""
    result = subprocess.run(
        cmd, cwd=cwd or ROOT_DIR, shell=True,
        stdout=sys.stdout, stderr=sys.stderr
    )
    if result.returncode != 0:
        log(f"Command failed (exit code {result.returncode})", C.RED)
        sys.exit(1)


# -- Pre-flight checks -------------------------------------------------------

def preflight():
    header("RideShare - Project Launcher")

    log("Checking Node.js...", C.YELLOW)
    if not check_command("node"):
        log("Node.js is not installed. Get it from https://nodejs.org (v18+)", C.RED)
        sys.exit(1)

    node_ver = subprocess.check_output("node --version", text=True, shell=True).strip()
    log(f"Node.js {node_ver} found", C.GREEN)

    log("Checking npm...", C.YELLOW)
    if not check_command("npm") and not check_command("npm.cmd"):
        log("npm is not installed. It should come with Node.js.", C.RED)
        sys.exit(1)

    npm_ver = subprocess.check_output("npm --version", text=True, shell=True).strip()
    log(f"npm {npm_ver} found", C.GREEN)


# -- Install dependencies ----------------------------------------------------

def install_deps():
    header("Installing Dependencies")

    if not os.path.exists(os.path.join(ROOT_DIR, "node_modules")):
        log("Installing root dependencies...")
        run("npm install")
    else:
        log("Root node_modules found, skipping", C.GREEN)

    if not os.path.exists(os.path.join(SERVER_DIR, "node_modules")):
        log("Installing server dependencies...")
        run("npm install", cwd=SERVER_DIR)
    else:
        log("Server node_modules found, skipping", C.GREEN)

    if not os.path.exists(os.path.join(RIDER_DIR, "node_modules")):
        log("Installing rider-app dependencies...")
        run("npm install", cwd=RIDER_DIR)
    else:
        log("Rider-app node_modules found, skipping", C.GREEN)


# -- Database setup -----------------------------------------------------------

def setup_database():
    header("Setting Up Database")

    env_path = os.path.join(SERVER_DIR, ".env")
    if not os.path.exists(env_path):
        log("Creating server/.env with defaults...", C.YELLOW)
        with open(env_path, "w") as f:
            f.write('DATABASE_URL="file:./dev.db"\n')
            f.write('JWT_SECRET="rideshare-dev-secret-change-in-production"\n')
            f.write('PORT=3001\n')
            f.write('CORS_ORIGIN="http://localhost:5173"\n')
            f.write('NODE_ENV="development"\n')
        log(".env created", C.GREEN)
    else:
        log(".env already exists, skipping", C.GREEN)

    log("Generating Prisma client...")
    run("npx prisma generate", cwd=SERVER_DIR)

    log("Pushing schema to database...")
    run("npx prisma db push", cwd=SERVER_DIR)

    log("Database ready", C.GREEN)


# -- Start servers ------------------------------------------------------------

def start():
    header("Starting RideShare")

    log("Backend API  : http://localhost:3001", C.GREEN)
    log("Frontend App : http://localhost:5173", C.GREEN)
    print()
    log("Press Ctrl+C to stop both servers.", C.YELLOW)
    print()

    try:
        process = subprocess.Popen(
            "npm run start",
            cwd=ROOT_DIR, shell=True,
            stdout=sys.stdout, stderr=sys.stderr
        )
        process.wait()
    except KeyboardInterrupt:
        log("Shutting down...", C.YELLOW)
        process.terminate()
        process.wait()
        log("All servers stopped.", C.GREEN)


# -- Main ---------------------------------------------------------------------

if __name__ == "__main__":
    # Enable ANSI colors on Windows 10+
    if sys.platform == "win32":
        os.system("")  # triggers VT100 support in cmd.exe

    try:
        preflight()
        install_deps()
        setup_database()
        start()
    except KeyboardInterrupt:
        print()
        log("Cancelled by user.", C.YELLOW)
        sys.exit(0)
    except Exception as e:
        print(f"\n  [ERROR] {e}\n")
        sys.exit(1)

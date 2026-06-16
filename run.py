"""
RideShare — One-Command Project Launcher
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
import time

# ── Configuration ────────────────────────────────────────────

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.join(ROOT_DIR, "server")
RIDER_DIR = os.path.join(ROOT_DIR, "rider-app")

# Colors for terminal output
class C:
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    END = "\033[0m"

def log(msg, color=C.CYAN):
    print(f"{color}{C.BOLD}  ▸ {msg}{C.END}")

def header(msg):
    width = 56
    print()
    print(f"{C.CYAN}{C.BOLD}  ╔{'═' * width}╗")
    print(f"  ║  {msg.center(width - 4)}  ║")
    print(f"  ╚{'═' * width}╝{C.END}")
    print()

def check_command(cmd):
    """Check if a command exists on the system PATH."""
    return shutil.which(cmd) is not None

def run(cmd, cwd=None, shell=True):
    """Run a shell command and stream output in real time."""
    result = subprocess.run(
        cmd, cwd=cwd or ROOT_DIR, shell=shell,
        stdout=sys.stdout, stderr=sys.stderr
    )
    if result.returncode != 0:
        log(f"Command failed with exit code {result.returncode}", C.RED)
        sys.exit(1)

# ── Pre-flight checks ───────────────────────────────────────

def preflight():
    header("RideShare — Project Launcher")

    log("Checking Node.js...", C.YELLOW)
    if not check_command("node"):
        log("Node.js is not installed. Please install Node.js v18+ from https://nodejs.org", C.RED)
        sys.exit(1)

    node_version = subprocess.check_output(["node", "--version"], text=True).strip()
    log(f"Node.js {node_version} found", C.GREEN)

    log("Checking npm...", C.YELLOW)
    if not check_command("npm"):
        log("npm is not installed. It should come with Node.js.", C.RED)
        sys.exit(1)

    npm_version = subprocess.check_output(["npm", "--version"], text=True).strip()
    log(f"npm {npm_version} found", C.GREEN)

# ── Install dependencies ─────────────────────────────────────

def install_deps():
    header("Installing Dependencies")

    # Root dependencies (concurrently, etc.)
    if not os.path.exists(os.path.join(ROOT_DIR, "node_modules")):
        log("Installing root dependencies...")
        run("npm install")
    else:
        log("Root node_modules found, skipping", C.GREEN)

    # Server dependencies
    if not os.path.exists(os.path.join(SERVER_DIR, "node_modules")):
        log("Installing server dependencies...")
        run("npm install", cwd=SERVER_DIR)
    else:
        log("Server node_modules found, skipping", C.GREEN)

    # Rider app dependencies
    if not os.path.exists(os.path.join(RIDER_DIR, "node_modules")):
        log("Installing rider-app dependencies...")
        run("npm install", cwd=RIDER_DIR)
    else:
        log("Rider-app node_modules found, skipping", C.GREEN)

# ── Database setup ───────────────────────────────────────────

def setup_database():
    header("Setting Up Database")

    env_path = os.path.join(SERVER_DIR, ".env")
    if not os.path.exists(env_path):
        log("Creating .env file with defaults...", C.YELLOW)
        with open(env_path, "w") as f:
            f.write('DATABASE_URL="file:./dev.db"\n')
            f.write('JWT_SECRET="rideshare-dev-secret-change-in-production"\n')
            f.write('PORT=3001\n')
            f.write('CORS_ORIGIN="http://localhost:5173"\n')
            f.write('NODE_ENV="development"\n')
        log(".env file created", C.GREEN)
    else:
        log(".env file already exists, skipping", C.GREEN)

    log("Running Prisma generate...")
    run("npx prisma generate", cwd=SERVER_DIR)

    log("Running Prisma database push...")
    run("npx prisma db push", cwd=SERVER_DIR)

    log("Database ready", C.GREEN)

# ── Start servers ────────────────────────────────────────────

def start():
    header("Starting RideShare")

    log("Backend API  → http://localhost:3001", C.GREEN)
    log("Frontend App → http://localhost:5173", C.GREEN)
    print()
    log("Press Ctrl+C to stop both servers.\n", C.YELLOW)

    try:
        process = subprocess.Popen(
            "npm run start",
            cwd=ROOT_DIR, shell=True,
            stdout=sys.stdout, stderr=sys.stderr
        )
        process.wait()
    except KeyboardInterrupt:
        log("\nShutting down...", C.YELLOW)
        process.terminate()
        process.wait()
        log("All servers stopped.", C.GREEN)

# ── Main ─────────────────────────────────────────────────────

if __name__ == "__main__":
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
        log(f"Unexpected error: {e}", C.RED)
        sys.exit(1)

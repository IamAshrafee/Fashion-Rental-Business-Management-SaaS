# 🍎 ClosetRent — MacBook Setup Guide (From Zero)

Your MacBook is brand new, so we need to install everything from scratch. Follow each step in order.

---

## Step 1 — Install Homebrew (macOS Package Manager)

Open **Terminal** (press `Cmd + Space`, type "Terminal", hit Enter) and paste:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It will ask for your **Mac password** (the one you use to log in). Type it — nothing will show on screen, that's normal. Press Enter.

When it finishes, **it will print 2 lines you MUST run** — something like:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

> [!IMPORTANT]
> Copy and run those 2 lines exactly as Homebrew prints them. If you skip this, `brew` won't be found.

Verify it works:
```bash
brew --version
```

---

## Step 2 — Install Git

macOS might already have Git via Xcode tools, but let's make sure:

```bash
git --version
```

If it prompts you to install Xcode Command Line Tools, click **Install** and wait.  
If it shows a version number, you're good.

---

## Step 3 — Install Node.js (v18 or newer)

```bash
brew install node@22
```

Verify:
```bash
node --version   # Should show v22.x.x
npm --version    # Should show 10.x.x
```

---

## Step 4 — Install Docker Desktop

```bash
brew install --cask docker
```

Then:
1. Open **Docker Desktop** from your Applications folder (or Spotlight: `Cmd + Space` → "Docker")
2. Accept the terms, let it finish starting
3. You'll see the Docker whale 🐳 icon in your menu bar when it's ready

Verify in Terminal:
```bash
docker --version
docker compose version
```

> [!WARNING]
> Docker Desktop **must be running** every time you work on this project. It doesn't auto-start by default. You can enable "Start Docker Desktop when you sign in" in Docker Desktop → Settings → General.

---

## Step 5 — Clone the Repo (if you haven't already)

If you already have the project folder (which it looks like you do), skip this step.

Otherwise:
```bash
cd ~/Documents/GitHub
git clone https://github.com/YourUsername/Fashion-Rental-Business-Management-SaaS.git
cd Fashion-Rental-Business-Management-SaaS
```

---

## Step 6 — Create the `.env` File

From the project root:

```bash
cp .env.example .env
```

Now open `.env` and fix the **database port**. Your `docker-compose.yml` maps Postgres to port **5433** on localhost, so update these two lines:

```diff
- DATABASE_URL=postgresql://closetrent:dev_password@localhost:5432/closetrent_dev
+ DATABASE_URL=postgresql://closetrent:dev_password@localhost:5433/closetrent_dev

- DATABASE_PORT=5432
+ DATABASE_PORT=5433
```

> [!IMPORTANT]
> This port mismatch between `.env.example` (5432) and `docker-compose.yml` (5433) is a gotcha. Your Docker maps **host 5433 → container 5432**. So your app connects to `localhost:5433`.

Everything else in `.env.example` should work as-is for local dev.

---

## Step 7 — Install Dependencies

From the project root:

```bash
npm install
```

This installs dependencies for the root, backend, and frontend all at once (monorepo workspaces).

---

## Step 8 — Start Docker Services (Postgres, Redis, MinIO)

```bash
docker compose up -d
```

Wait a few seconds, then verify all 3 are running:

```bash
docker compose ps
```

You should see `postgres`, `redis`, and `minio` all with status **running (healthy)**.

---

## Step 9 — Run Prisma Migrations & Seed

```bash
cd apps/backend
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
cd ../..
```

| Command | What It Does |
|---|---|
| `prisma generate` | Generates the Prisma Client (TypeScript types for your DB) |
| `prisma migrate deploy` | Creates all tables in your fresh Postgres |
| `prisma db seed` | Fills the DB with starter/demo data |

---

## Step 10 — Launch the App! 🚀

**Option A: Use the script I just made for you:**

```bash
./start-dev.sh
```
Select **option 1** — "Start All" — it handles everything.

**Option B: Do it manually (2 terminal tabs):**

Tab 1 — Backend:
```bash
npm run dev:backend
```

Tab 2 — Frontend:
```bash
npm run dev:frontend
```

---

## Step 11 — Open in Browser 🌐

| Service | URL |
|---|---|
| **Frontend** | [http://localhost:3000](http://localhost:3000) |
| **Backend API** | [http://localhost:4000/api](http://localhost:4000/api) |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) (user: `minioadmin` / pass: `minioadmin`) |

---

## Quick Reference — Daily Workflow

Every time you sit down to code on your MacBook:

```bash
# 1. Make sure Docker Desktop is running (check the whale icon in menu bar)

# 2. cd into the project
cd ~/Documents/GitHub/Fashion-Rental-Business-Management-SaaS

# 3. Start everything
./start-dev.sh    # pick option 1

# 4. Code away! Frontend hot-reloads, backend auto-restarts.

# 5. When done
./start-dev.sh    # pick option 5 to stop everything
```

---

## If Something Goes Wrong — Nuclear Reset

```bash
./reset-dev.sh
```

This wipes **everything** (DB, Redis, MinIO files) and gives you a completely fresh start with migrations and seed data re-applied. Same as your `reset-dev.bat` on Windows.

---

## TL;DR — All Commands in Order

```bash
# Prerequisites (one-time)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@22
brew install --cask docker
# Open Docker Desktop and let it start

# Project setup (one-time)
cd ~/Documents/GitHub/Fashion-Rental-Business-Management-SaaS
cp .env.example .env
# Edit .env → change DATABASE_PORT to 5433 and fix DATABASE_URL
npm install
docker compose up -d
cd apps/backend && npx prisma generate && npx prisma migrate deploy && npx prisma db seed && cd ../..

# Run (every time)
./start-dev.sh
```

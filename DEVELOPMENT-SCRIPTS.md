# ClosetRent Development Launchers

You do not need to type development commands. Open the repository in Windows File Explorer or macOS Finder and double-click the launcher that matches what you want to do. Windows uses `.cmd`; macOS uses `.command`.

## Which launcher should I use?

| Windows           | macOS                 | Use it when                                                      | What it does                                                                                 | Deletes data? |
| ----------------- | --------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------- |
| `start-dev.cmd`   | `start-dev.command`   | Normal daily work                                                | Starts the database, Redis, storage, backend, and frontend                                   | No            |
| `prepare-dev.cmd` | `prepare-dev.command` | First setup or after project dependencies/database setup changed | Prepares everything, updates the platform seed, and then starts all servers                  | No            |
| `reset-dev.cmd`   | `reset-dev.command`   | You deliberately want a completely fresh local system            | Deletes local project data after confirmation, rebuilds it, seeds it, and starts all servers | **Yes**       |
| `stop-dev.cmd`    | `stop-dev.command`    | You finished working                                             | Stops the application servers and Docker services but keeps local data                       | No            |
| `status-dev.cmd`  | `status-dev.command`  | You want to know what is running                                 | Shows the state of every local service                                                       | No            |

Whenever this guide says to use a launcher, choose its `.cmd` filename on Windows or its `.command` filename on macOS.

## Everyday work

Double-click `start-dev.cmd` on Windows or `start-dev.command` on macOS.

This is the fast, normal launcher. It:

1. Checks the local configuration and required tools.
2. Starts PostgreSQL, Redis, and MinIO if needed.
3. Waits until those services are healthy.
4. Starts the NestJS backend and Next.js frontend.

It does **not** install packages, migrate the database, seed records, initialize storage, or delete anything.

If an older ClosetRent backend or frontend was left running after a Terminal window closed unexpectedly, the launcher verifies that the process belongs to this repository, stops it safely, and starts a clean managed copy. A process from another project is never stopped merely because it uses the configured port.

Keep its Command Prompt or Terminal window open while you work. Press Control+C when you only want to stop the backend and frontend. Your Docker services and data remain ready for the next start.

## First setup or project upgrade

Double-click `prepare-dev.cmd` on Windows or `prepare-dev.command` on macOS.

Use it:

- after cloning the project for the first time;
- after `package.json` or `package-lock.json` changes;
- after Prisma schema or migration changes;
- after seed behavior changes;
- after MinIO/storage configuration changes;
- when the start launcher says dependencies are missing or outdated.

It creates `.env` from `.env.example` only if `.env` does not exist, installs missing or outdated dependencies, starts infrastructure, creates both storage buckets, generates Prisma Client, deploys committed migrations, applies the safe platform seed, and then starts the backend and frontend automatically.

It never overwrites an existing `.env` and does not delete your local database.

## Completely fresh local system

Double-click `reset-dev.cmd` on Windows or `reset-dev.command` on macOS.

Use reset only when you intentionally want to remove all local ClosetRent development data and start again. It asks you to type `RESET` before anything is deleted.

After confirmation it removes only this repository's local PostgreSQL, Redis, and MinIO volumes, recreates them, prepares the database and storage, applies the platform seed, and starts the backend and frontend automatically.

Reset refuses to run against production, a remote PostgreSQL server, or any database other than the local `closetrent_dev` database.

## Stop everything safely

Double-click `stop-dev.cmd` on Windows or `stop-dev.command` on macOS.

It stops a launcher-managed backend and frontend, including a verified orphaned ClosetRent process, then stops this project's Docker services. Database, Redis, and MinIO volumes are preserved, so your products, customers, bookings, and other local development data remain available.

The result stays visible until you press any key on Windows or Enter on macOS.

## Check what is running

Double-click `status-dev.cmd` on Windows or `status-dev.command` on macOS.

It shows:

- PostgreSQL, Redis, and MinIO container status;
- whether the backend port is running;
- whether the frontend port is running;
- the configured local database target.

Status is read-only. It does not change or repair anything. The result stays visible until you press any key on Windows or Enter on macOS.

## If macOS refuses to open a launcher

The launchers are stored as executable files in Git. If macOS Gatekeeper blocks a downloaded file, Control-click it in Finder, choose **Open**, and confirm once. You should not need to type a terminal command.

Docker Desktop must be installed and running. Node.js 18 or newer and npm 9 or newer must also be installed.

## If Windows hides the file extension

Windows File Explorer may display `start-dev.cmd` as `start-dev`. The file's type should be **Windows Command Script**. Double-clicking it opens Command Prompt and runs the same Node-based workflow as the macOS launcher.

## Quick decision

- Starting work today? Use `start-dev.cmd` (Windows) or `start-dev.command` (macOS).
- First setup or project code changed its dependencies/database setup? Use `prepare-dev.cmd` (Windows) or `prepare-dev.command` (macOS).
- Need to erase all local development data? Use `reset-dev.cmd` (Windows) or `reset-dev.command` (macOS).
- Finished working and want everything stopped? Use `stop-dev.cmd` (Windows) or `stop-dev.command` (macOS).
- Unsure what is running? Use `status-dev.cmd` (Windows) or `status-dev.command` (macOS).

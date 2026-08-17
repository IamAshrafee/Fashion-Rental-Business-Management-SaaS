# Windows Development Launchers Design

## Context

The repository currently provides five macOS `.command` launchers for preparing, starting, resetting, stopping, and inspecting the local development environment. Each launcher is a thin wrapper around `scripts/dev-environment.mjs`, where the actual validation, orchestration, health checks, process management, and destructive-operation safeguards live.

Windows cannot directly run the `.command` launchers. Developers can use some root npm scripts from a terminal, but that does not preserve the existing double-click workflow or expose the combined `prepare-start` and `reset-start` commands in the same way.

## Goals

- Provide a native Windows double-click workflow matching the existing macOS workflow.
- Preserve the macOS launchers unchanged.
- Keep `scripts/dev-environment.mjs` as the only implementation of development-environment behavior.
- Preserve argument forwarding, exit codes, reset confirmation, and readable output for short-running commands.
- Document both operating-system workflows clearly.

## Non-goals

- Replacing the Node orchestrator with batch or PowerShell logic.
- Removing or renaming the macOS launchers.
- Changing Docker, application, database, seed, or storage behavior.
- Adding Linux desktop launchers.
- Changing the existing root npm command contract.

## Selected Approach

Add five Windows Command Prompt launchers beside their macOS counterparts:

| Windows launcher | Node orchestrator command | Purpose |
| --- | --- | --- |
| `start-dev.cmd` | `start` | Validate and start the normal development environment. |
| `prepare-dev.cmd` | `prepare-start` | Prepare the environment and then start it. |
| `reset-dev.cmd` | `reset-start` | Confirm a destructive reset, rebuild the environment, and start it. |
| `stop-dev.cmd` | `stop` | Stop application and infrastructure services without deleting data. |
| `status-dev.cmd` | `status` | Display the current service state without changing it. |

Native `.cmd` files are preferred over PowerShell because they work through Windows Explorer without execution-policy setup. Using only npm scripts was rejected because it would require a terminal and would not reproduce the established double-click interface.

## Launcher Behavior

Each `.cmd` file will:

1. Disable command echoing for readable output.
2. switch to the directory containing the launcher, including when the repository path contains spaces or the launcher is invoked from another working directory;
3. run `node scripts/dev-environment.mjs <command>`;
4. forward every received argument unchanged through `%*`; and
5. return the Node process exit code.

The start, prepare, and reset launchers are long-running. They will not add a pause because the Node orchestrator remains attached while the application servers run.

The stop and status launchers are short-running. They will retain the orchestrator exit code, print a blank line, and wait for a keypress so double-click users can read the result. When `CLOSERENT_NO_PAUSE=1` is set, they will skip the pause so automation and tests do not block.

Reset confirmation remains entirely in the Node orchestrator. Arguments such as `--yes` are forwarded, but the Windows wrapper will not bypass or reimplement any safety check.

## Documentation

`README.md` and `DEVELOPMENT-SCRIPTS.md` will describe Windows and macOS launchers as equivalent interfaces. Instructions will name `.cmd` for Windows and `.command` for macOS while keeping the purpose and safety guidance for each operation consistent.

The existing `macbook-setup-guide.md` remains a macOS-specific guide. References elsewhere in the repository that imply the workflow is macOS-only will be adjusted when they describe shared behavior. Historical design specifications will not be rewritten.

## Error Handling and Safety

- Missing Node.js, Docker failures, port conflicts, invalid environment configuration, and service-health failures continue to be reported by `scripts/dev-environment.mjs`.
- Wrappers propagate nonzero exit codes instead of converting failures into success.
- Repository paths with spaces are handled using quoted batch path operations.
- The reset wrapper delegates to the existing verified-resource checks and interactive confirmation.
- The Windows launchers contain no deletion, Docker, database, or process-management commands of their own.

## Verification

- Extend the developer-script test suite with contract checks that each Windows launcher maps to the intended orchestrator command, forwards arguments, uses its own directory, and implements the expected pause policy.
- Run `npm run test:dev-scripts`.
- Perform non-blocking Windows smoke checks for the short-running wrappers with `CLOSERENT_NO_PAUSE=1`, where the local environment permits it.
- Inspect the final documentation to ensure that Windows users are never instructed to open `.command` files.

## Acceptance Criteria

- A Windows user can double-click the appropriate `.cmd` file for all five supported workflows.
- A macOS user can continue using the existing `.command` files.
- Both launcher families call the same Node orchestrator commands.
- Arguments and failure exit codes reach the caller correctly.
- `status-dev.cmd` and `stop-dev.cmd` remain readable when double-clicked and non-blocking in automation.
- The existing developer-script tests and new Windows-launcher contract tests pass.
- Current documentation clearly distinguishes Windows and macOS filenames.

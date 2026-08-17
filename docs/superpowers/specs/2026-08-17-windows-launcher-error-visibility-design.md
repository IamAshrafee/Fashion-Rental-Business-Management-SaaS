# Windows Launcher Error Visibility Design

## Problem

The long-running Windows launchers close immediately when the Node development orchestrator fails before starting the application servers. Double-click users see only a flash and cannot read the error. Reproduction confirmed that `reset-dev.cmd` correctly returned exit code 1 for a missing `COURIER_CREDENTIALS_ENCRYPTION_KEY`, but the window closed before displaying the actionable message.

The same defect affects `start-dev.cmd`, `prepare-dev.cmd`, and `reset-dev.cmd` because all three return immediately after Node exits.

## Selected Behavior

Each long-running Windows launcher will preserve the Node exit code and pause only when that code is nonzero. The pause will be skipped when `CLOSERENT_NO_PAUSE=1`, allowing automated and non-interactive execution.

Successful long-running sessions and normal Control+C shutdowns will not add a pause. The short-running `status-dev.cmd` and `stop-dev.cmd` launchers remain unchanged because they already keep their output visible.

## Error Handling

- Node remains responsible for validation, workflow behavior, and error messages.
- The wrappers only preserve the exit code and keep failures visible.
- Pausing must not convert a failure into a successful exit.
- Reset confirmation and destructive-operation safeguards remain unchanged.

## Verification

- Extend the launcher contract tests to require failure-only pause logic, the `CLOSERENT_NO_PAUSE` escape hatch, and preserved exit codes in all three long-running launchers.
- Run the complete developer-script test suite.
- Reproduce a failing `reset-dev.cmd` execution with `CLOSERENT_NO_PAUSE=1` and verify that it returns the original nonzero exit code without blocking automation.
- Run formatting and diff checks.

## Acceptance Criteria

- Double-clicked start, prepare, and reset windows remain open when their workflow fails.
- The displayed message comes from the shared Node orchestrator.
- Successful or normally interrupted workflows do not pause.
- Automation can disable the failure pause.
- Failure exit codes are preserved.

# DailyFuel collaboration rules

Read `docs/prd.md` and `docs/erd.md` before implementation.

## Git workflow

- `main` receives only initial setup until the user approves the finished project's release.
- Start tasks from current `dev` on `feature/<short-name>`; open PRs explicitly against `dev`.
- Merge reviewed and validated feature PRs into `dev`. Never merge development features into `main` during implementation.
- Stage explicit paths, inspect the staged diff, and exclude unrelated features.
- Keep `design-reference/` ignored. Import only the components needed for the current feature.

## Concurrent agents and terminals

- Use subagents for independent tasks when useful; assign explicit file or feature ownership.
- Each independently committing agent/terminal gets a separate worktree and feature branch.
- Agents sharing a worktree may edit only assigned nonoverlapping files; only the coordinator performs Git mutations.
- The coordinator owns integration, dependency order, PR creation, and merges.
- Never reset, clean, stash, or overwrite another worker's changes.

## Product and checks

- Preserve the supplied visual design while implementing server behavior incrementally.
- Only calories, protein, and fat; no workouts or offline sync.
- Use decimal values, date snapshots, owner-scoped access, and private photos.
- Check the feature's PRD acceptance criteria; record actual check results and gaps in its PR.
- Prototype mocks do not provide authentication, privacy, or persistence guarantees.

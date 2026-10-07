# Development and terminal workflow

## Branches

`main` is frozen at the setup baseline until the user approves the completed release. `dev` is the integration/testing branch and default PR target. Every implementation uses `feature/<short-name>` and a PR into `dev`. See the [feature roadmap](feature-roadmap.md).

Repository instructions enforce this convention for agents. GitHub branch protection is not configured; repository administrators can still bypass the convention. Always inspect the PR base before merging.

## Separate terminals and agents

Keep the original checkout as the integration workspace. Give each independent worker a separate worktree, branch, and assigned scope. Worktrees share Git objects but have independent checked-out files; do not run branch switches in another worker's checkout.

From the repository root, create a workspace from the latest integrated code:

```bash
git fetch origin
git worktree add .worktrees/backend -b feature/backend-foundation origin/dev
git worktree add .worktrees/frontend -b feature/frontend-shell origin/dev
```

Open terminal 1 in the original checkout for coordination, terminal 2 in `.worktrees/backend`, and terminal 3 in `.worktrees/frontend`. If those worktrees already exist, simply enter them; do not recreate their branches.

| Worker | Ownership | Initial scope |
|---|---|---|
| Coordinator | Integration checkout, shared docs and PRs | Set contracts, review changes, run integration checks, merge into dev |
| Backend | Backend worktree, `backend/` | Django/DRF/PostgreSQL foundation; no frontend edits |
| Frontend | Frontend worktree, `frontend/` | Inspect and prepare shared visual primitives; full shell/auth integration waits for accounts/profile and agreed API contract |

The frontend shell roadmap feature depends on accounts/profile. A prepared worktree is not authorization to guess authentication contracts or merge incomplete integration. Update it from `origin/dev` as dependencies land. Split shared visual primitives into their own scoped PR if useful.

Each worker installs its own dependencies. Ignored files and virtual environments are not copied into worktrees. The reference design is available only in the original checkout at `design-reference/frontend/`; from the prepared worktrees its relative location is `../../design-reference/frontend/`. Treat it as read-only source material. Do not copy the complete export into Git.

Assign each subagent one deliverable and explicit paths. Workers must report changed files, checks, remaining gaps, and dependencies. The coordinator alone creates/merges PRs unless explicitly delegating those actions. Never use concurrent Git operations in one checkout.

## Deliver one feature

1. Agree on scope, API/schema changes, and PRD acceptance criteria.
2. Start from current `origin/dev` on a feature branch in its assigned worktree.
3. Implement only that feature; import only necessary design components.
4. Run relevant checks and review the diff, including migrations and ownership checks.
5. Stage explicit paths and commit with a descriptive message.
6. Push the feature branch and create a PR with `--base dev`.
7. Review the PR and resolve failures before squash-merging it into `dev`.
8. Update the integration checkout and roadmap with actual delivered behavior.

```bash
git diff --check
git diff --stat
# Stage only the feature's paths, then inspect git diff --cached.
git push -u origin feature/example
gh pr create --base dev --head feature/example --body-file /tmp/dailyfuel-pr.md
# After review and relevant checks:
gh pr merge <PR-number> --squash
git fetch origin
```

Do not delete another agent's branch/worktree while it is active. Keep `main` unchanged. The final `dev` to `main` release PR comes after all definition-of-done checks and user release approval.

## Design audit

The original export includes Home, History, Progress, Profile, meal and target editors, charts, photos, localization, and motion. It uses mock/in-memory data, a fixed date, and browser photo URLs. Those screens do not implement real authentication, persistent records, or private media.

The tracked starter uses React 19/Vite 8; the export uses React 18/Vite 5 with Tailwind and additional UI libraries. Its nested package manifest also conflicts with its root manifest. Add and validate dependencies deliberately per feature; do not replace the starter lockfile with the export's manifests. Implement the PRD API contract rather than copying the mock API unchanged.

## Setup validation

The frontend starter passed `npm run lint` and `npm run build` during setup. The design export, node_modules, and Python environment were confirmed ignored. Backend execution has not been validated because no Django project exists yet.

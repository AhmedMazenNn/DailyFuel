# DailyFuel

A mobile-first nutrition tracker with daily calorie, protein, and fat targets, quick or itemized meals, and private weekly weight and photo progress. English and Arabic (RTL) are planned.

## Project status

Repository setup only. `frontend/` contains the React + TypeScript + Vite starter. The Django API has not been created. Features will be delivered incrementally through pull requests into `dev`.

## Requirements and structure

- [Product requirements](docs/prd.md)
- [Entity relationships and schema](docs/erd.md)
- `frontend/` — application frontend; import the supplied design one feature at a time.
- `backend/` — future Django REST API; the supplied dependency snapshot still needs validation in the backend foundation feature.
- `docs/` — specifications and development documentation.
- `design-reference/frontend/` — complete original design, preserved locally and excluded from Git. Fresh clones need the original export from the maintainer.

The target architecture is React, Django REST Framework, PostgreSQL, and private media storage. Server calculations and ownership checks are authoritative. Workouts, carbohydrate tracking, public photos, and offline sync are outside this release.

## Run the current frontend starter

The setup was inspected with Node 20.19.0 and npm 10.8.2.

```bash
cd frontend
npm ci
npm run dev
```

Validation commands:

```bash
npm run lint
npm run build
```

Backend installation and startup instructions will arrive with its foundation PR. The existing local Python virtual environment is not committed.

## Branch workflow

- `main`: initial setup only until the project is complete and the final release is approved.
- `dev`: integration and testing; feature PRs merge here.
- `feature/<short-name>`: one coherent feature per branch, created from current `dev`.

Always set the PR base to `dev`. Do not push the complete design export, dependencies, secrets, or unrelated features. These conventions do not imply GitHub branch protection is enabled.

```bash
git switch dev
git pull --ff-only origin dev
git switch -c feature/backend-foundation
# Implement, validate, and stage explicit paths before committing.
git push -u origin feature/backend-foundation
gh pr create --base dev --head feature/backend-foundation
```

Use one Git worktree per concurrent terminal/agent. Never switch branches in a directory another agent is editing. See the [terminal and agent workflow](docs/development-workflow.md) and [feature roadmap](docs/feature-roadmap.md).

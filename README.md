# DailyFuel

DailyFuel tracks calorie, protein, and fat targets, meals with saved-food portions, and private weekly weight and photo progress. It supports English and Arabic, dark mode, and photo comparisons.

The application uses React + TypeScript + Vite, Django REST Framework, PostgreSQL, and private media storage. Server calculations and owner access checks are authoritative.

- [Deployment and local setup](docs/deployment.md): Render backend, existing Neon database, Vercel frontend, and private photo storage.
- [Product requirements](docs/prd.md)
- [Entity relationships](docs/erd.md)
- [API contract](docs/api-contract.md)
- [Development workflow](docs/development-workflow.md)

`main` contains the approved release. New work starts from `dev` on a feature branch, with PRs targeting `dev`; release PRs promote validated changes to `main` with user approval. Keep credentials, dependencies, and `design-reference/` out of Git.

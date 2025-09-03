# Contributing Guidelines

Thank you for your interest in contributing to Addon Bone! This guide explains the rules and processes that help us work consistently.

## Code of Conduct
By participating, you agree to follow our Code of Conduct (see `CODE_OF_CONDUCT.md`). To report violations, email addonbonedev@gmail.com or use Issues: https://github.com/addon-stack/addon-bone/issues

## Mandatory commit format — Conventional Commits
We follow Conventional Commits 1.0.0: https://www.conventionalcommits.org/en/v1.0.0/

Basic syntax:

`type(scope)!: short imperative description in English`

`[more details/motivation]`

`[BREAKING CHANGE: description of the incompatible change]`
`[Closes #123]`

Examples:
- `feat(relay): add proxy support for multi-tenant routing`
- `fix(storage): prevent data race in local adapter`
- `docs(readme): clarify installation steps`
- `refactor(service)!: drop deprecated init flow`
- `test(message): add unit tests for message bus`
- `chore(release): bump version to 0.3.0`

Allowed types:
- `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Recommended scopes for this repository:
- `cli`, `entrypoint`, `manifest`, `plugins`
- `relay`, `service`, `storage`, `message`, `locale`, `offscreen`, `transport`
- `docs`, `tests`, `build`, `deps`, `tooling`

Rules:
- Subject line up to ~72 characters, no trailing period.
- English commit messages are preferred for consistency.
- Mark breaking changes: add `!` after the scope or include a `BREAKING CHANGE` section.
- Link issues in the footer: `Closes`/`Refs` `#<number>`. 

## Branching — Git Flow
The project follows Git Flow.

Main branches:
- `main` — stable releases
- `develop` — integration branch

Temporary branches:
- `feature/<short-name>` — new features (branch from `develop` → merge into `develop`)
- `bugfix/<short-name>` — fixes that don’t require urgent release (from `develop` → to `develop`)
- `release/<x.y.z>` — release prep (from `develop` → into `main` and back into `develop`)
- `hotfix/<x.y.z>` — urgent production fixes (from `main` → into `main` and back into `develop`)

PR rules:
- For features and regular fixes, open PRs into `develop`.
- For hotfixes, open PRs into `main`; after release, back-merge/PR into `develop`.
- Use PR titles in Conventional Commits style (scope optional but encouraged).
- One PR = one logical change. Keep diffs small.

Releases and versioning:
- We use SemVer. Commit types help determine version bumps (`feat` → minor, `fix` → patch, `BREAKING CHANGE` → major).
- Package version is updated by maintainers within release/hotfix branches.

## How to contribute
1) Fork the repository and create a branch from `develop` (or `main` for `hotfix`):
   - `feature/my-cool-feature`
   - `bugfix/fix-storage-race`
   - `hotfix/0.2.10`
2) Install dependencies: `npm install`
3) Make changes and ensure commits follow Conventional Commits.
4) Before opening a PR, run local checks:
   - Formatting: `npm run format`
   - Tests: `npm test`
   - By area (if needed):
     - `npm run test:relay`
     - `npm run test:service`
     - `npm run test:storage`
     - `npm run test:message`
     - `npm run test:locale`
     - `npm run test:manifest`
     - `npm run test:entrypoint`
     - `npm run test:plugins`
5) Open a PR to the appropriate branch (usually `develop`) and include:
   - motivation and solution;
   - alternatives and trade-offs (if any);
   - related issues (e.g., `Closes #123`).

## Code style and formatting
- Use Prettier: `npm run format`
- Follow existing patterns in the codebase. For large refactors, use separate PRs.

## Contribution license
The project is MIT-licensed (see `LICENSE.md`). By contributing, you agree your contributions are licensed under MIT.

## Questions and support
- Issue tracker: https://github.com/addon-stack/addon-bone/issues
- General questions can be raised there as a Discussion/Issue.

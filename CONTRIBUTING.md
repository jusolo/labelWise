# Contributing to labelWise

Thanks for your interest in contributing.

## Ground Rules
- Keep changes focused and small.
- Prefer clear, typed, and testable code.
- Do not break the CSV import/export contract.

## Development Setup
1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Validate build before pushing:
   ```bash
   npm run build
   ```

## Branching
- Create feature branches from `main`.
- Branch naming suggestion:
  - `feat/<short-description>`
  - `fix/<short-description>`
  - `docs/<short-description>`

## Commit Style (Recommended)
Use concise commits:
- `feat: add grid snapping`
- `fix: keep canvas stable when switching views`
- `docs: improve README setup section`

## Pull Requests
Include in your PR:
- What changed.
- Why it changed.
- Screenshots or short videos for UI updates.
- Any CSV schema impact.

PR checklist:
- [ ] `npm run build` passes.
- [ ] No unrelated file changes.
- [ ] UI changes validated in both Canvas and CSV views.

## Reporting Issues
When opening issues, include:
- Steps to reproduce.
- Expected behavior.
- Actual behavior.
- Browser and OS.
- Sample CSV/image if relevant.

## Security
Please do not disclose security issues publicly.
Open a private report to repository maintainers.

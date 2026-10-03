# Contributing to SAGE

Thank you for contributing to an open-source security tool.

## Before You Start

- Check [open issues](https://github.com/OnkarNanaware/MindSpark26/issues) to avoid duplicate work
- For large changes, open an issue first to discuss the approach
- Security-related changes require extra care — see [SECURITY.md](SECURITY.md)

## Development Setup

```bash
git clone https://github.com/OnkarNanaware/MindSpark26.git
cd dependency-analyzer
chmod +x start.sh
./start.sh
```

For full setup including the PostgreSQL CVE cache, see the **Database Setup** section in [README.md](README.md).

The scanner works without a database (falls back to live OSV API), so you can develop and test without setting up PostgreSQL.

## Branching

```
main              → production
feature/ai-fixes  → active development
feature/*         → your feature branch
fix/*             → bug fixes
```

Always branch from `feature/ai-fixes` (active development branch).

## Pull Request Guidelines

1. **Keep PRs small** — one feature or fix per PR
2. **No regressions** — run `pytest tests/` and `npx playwright test` before submitting
3. **No mock data fallback** — never silently substitute fake scan results for real ones
4. **No hardcoded secrets** — use `os.environ.get()` for all API keys and DB URLs
5. **Preserve API contract** — the frontend-backend contract is validated by `validateSnapshot.js`
6. **DB changes need migration** — if you change `db.py` schema, provide an `ALTER TABLE` migration script

## Code Standards

**Backend (Python):**
- Input sanitisation via `utils/validation.py` for all user-supplied strings
- Rate-limit new endpoints via the `@rate_limited` decorator — every endpoint including read-only ones like `/api/cve`
- Return structured errors: `{"error": "..."}` with appropriate HTTP status
- DB queries go in `db.py` (schema) or `cve/db_scanner.py` (lookups) — not inline in `app.py`
- Sync jobs go in `sync/` — never block the request thread

**Frontend (React):**
- Use CSS variables from `index.css` for all colors, spacing, typography
- Use type-scale classes (`t-h1`, `t-h2`, `t-body`) — no inline `fontSize:` on headings
- Error states must be explicit — never silently fall back to demo/mock data
- Accessibility: interactive elements need `aria-label`, focus states, keyboard support

## System Status Bar

The `SystemStatusBar` and `SystemLogs` components are always dark-themed (hardcoded dark palette) regardless of app theme. This is intentional — they are operational terminal components, not UI components.

All status fields must be wired to real data from `healthStatus` prop. No fake/simulated static entries are acceptable. Live entries (heartbeat, rate limit resets) are generated client-side on a timer — these are acceptable as they reflect real activity patterns.

## Testing

### Writing E2E Tests
All tests live in `frontend/tests/e2e/`. Each file maps to a page:
- `landing.spec.js` — Landing page
- `scanner.spec.js` — Scanner page
- `results.spec.js` — Results/Analytics page
- `history.spec.js` — History page
- `kb.spec.js` — Knowledge Base

**Rules:**
- Every new feature must have at least one E2E test
- Every bug fix must have a regression test that would have caught it
- Tests must pass on both Desktop Chrome and Mobile Chrome (Pixel 5)
- Use `test.skip(!isMobile, 'Mobile only')` for mobile-specific tests

**Running before submitting a PR:**
```bash
cd frontend && npm run test:e2e
```

### CI Gate
GitHub Actions runs all 41 tests on every PR to `main`.
A PR cannot be merged if any test fails.

## Database Development

The scanner works without `DATABASE_URL` set — it falls back to live OSV API automatically. For DB-related changes:

```bash
# Test DB connection
cd backend && python3 -c "from db import init_schema; init_schema(); print('DB ok')"

# Run EPSS sync manually
python3 -c "from sync.epss_kev_sync import sync_epss; sync_epss()"

# Run OSV delta sync manually
python3 -c "from sync.osv_sync import sync_all; sync_all()"
```

Never commit real `DATABASE_URL` values — `backend/.env` is gitignored.

## Testing

```bash
# Backend
cd backend && source venv/bin/activate && pytest tests/ -v

# E2E
cd tests && npm install && npx playwright install
npx playwright test                    # all specs
npx playwright test 01_user_journey    # single spec
npx playwright test --project=chromium # single browser
```

## Commit Message Format

```
type: short description

- detail 1
- detail 2
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

Examples:
```
feat: add EPSS score column to vulnerability table
fix: db_scanner fallback when affected_versions list is empty
docs: update README with database setup instructions
```

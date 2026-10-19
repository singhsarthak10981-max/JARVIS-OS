# Testing
Run npm run build before commits.


---

## v1.0.0 quality gate

```bash
npm run lint
npm run typecheck
npm test
npm run build
# or simply
npm run verify
```

- `lib/ai/__tests__/intents.test.ts` covers desktop-control routing, timers,
  memory, themes, math and false-positive protection.
- `lib/ai/__tests__/math.test.ts` covers the safe arithmetic engine.
- The production build also typechecks the project.

GitHub Actions currently runs `npm run build`. Add lint/typecheck/test steps
to `.github/workflows/ci.yml` from a token with `workflows` permission to gate
pull requests on the full suite.

# Contributing

Thanks for considering a contribution to Mira AI. Please use a focused branch and pull request, and do not include personal data, credentials, generated build output, or machine-specific settings.

## Before opening a pull request

1. Open an issue for a substantial behavior change so the scope can be agreed on first.
2. Keep changes focused and preserve existing project conventions.
3. Use Bun workspaces and the committed `bun.lock`; avoid changing package managers or refreshing unrelated dependencies.
4. Add or update focused tests for behavior changes.
5. Run the checks relevant to the change. The baseline is:

```bash
bun install --frozen-lockfile
bun run typecheck
bun test --isolate
```

6. Describe user-visible changes, test results, and any limitations in the pull request.

## Pull requests

- Keep commits and the pull request title descriptive.
- Include screenshots for visible UI changes where useful.
- Do not upload installers or other large build outputs in a source pull request. Attach release binaries to a GitHub Release.
- Never include API keys, `.env` files, user databases, session data, or private workspace notes.

## Platform-specific work

Windows packaging must run on a Windows host; macOS signing and packaging must run on macOS. Do not report a platform build as passing unless that platform's checks actually ran.

## Code of conduct

Be respectful, specific, and constructive. Harassment, doxxing, and discriminatory content are not acceptable.

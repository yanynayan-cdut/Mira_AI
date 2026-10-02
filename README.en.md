# Mira AI

**A local-first AI workspace for chat, agents, files, and repeatable work.**

Mira is an Electron desktop app with multi-provider chat, Claude and Pi agent runtimes, workspace-scoped skills and MCP servers, browser and file previews, collaborative agent sessions, and scheduled automations. Application data stays local by default; remote collaboration integrations are opt-in.

[简体中文](README.md) | [English](README.en.md) | [Releases](https://github.com/yanynayan-cdut/Mira_AI/releases) | [Source history](docs/RELEASES.md)

## Download

Download the Windows x64 installer from the [v1.1.2 GitHub Release](https://github.com/yanynayan-cdut/Mira_AI/releases/tag/v1.1.2). Earlier local installers do not correspond to source tags in this repository, so they are not distributed as public Releases. Review the release notes and verify the checksum before installation.

## Features

- Multi-provider chat with attachments and rich document previews.
- Claude Agent SDK and Pi agent runtimes for tool-using workflows.
- Workspace-scoped skills, MCP servers, and project instructions.
- Agent collaboration, persistent scheduled automations, and local planning tools.
- Browser and file-preview tabs, with optional team and messaging integrations.
- Local-first settings and session storage.

## Development

Requirements: Windows, macOS, or Linux; [Bun](https://bun.sh/) 1.3.14; and Git. Agent features may also require a supported Node.js/Bun shell and credentials for the model provider you configure.

```bash
bun install --frozen-lockfile
bun run dev
```

Useful checks:

```bash
bun run typecheck
bun test --isolate
```

The public Windows workflow builds an unsigned x64 verification package; it does not publish artifacts or update metadata servers. Unsigned Mira packages clearly show a Windows security warning until a trusted signing certificate is configured.

## Windows update source

The OSS desktop build checks the Mira GitHub Releases repository by default. `PROFER_UPDATE_FEED_URL` may add a secure HTTPS feed ahead of GitHub Releases; plain HTTP, credentials in the URL, and literal IP addresses are rejected. Older Profer-hosted feeds are not used by this public Mira build.

## Repository layout

- `apps/electron/`: Mira desktop application and release tooling.
- `apps/cli/`: command-line application.
- `packages/`: shared types, agent, provider, session, project, and UI packages.
- `docs/`: maintained product and engineering documentation.
- `release-notes/`: selected version notes.

## Project identity and history

Mira is a standalone public repository for the Mira desktop product. It preserves the available source history and version tags from the local Profer codebase; package names and historical code may still use `Profer` or `Proma`. The first public Mira release is `v1.1.2`. See [version history and provenance](docs/RELEASES.md).

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report vulnerabilities privately using [SECURITY.md](SECURITY.md). For usage questions and reproducible bugs, use [GitHub Issues](https://github.com/yanynayan-cdut/Mira_AI/issues).

## License

The community edition is distributed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE).

Mira builds on the Profer/Proma codebase and its upstream history. See the attribution notices and third-party licenses included in the repository.

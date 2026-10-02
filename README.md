# Mira AI

**本地优先的 AI 工作空间，覆盖对话、Agent、文件与自动化。**

Mira 是一款基于 Electron 的桌面应用，提供多模型对话、Claude 与 Pi Agent 运行时、工作区级 Skills/MCP、浏览器和文件预览、协作 Agent 会话与定时自动化。应用数据默认保存在本地；远程协作集成由用户自行启用。

[English](README.en.md) | [简体中文](README.md) | [GitHub Releases](https://github.com/yanynayan-cdut/Mira_AI/releases) | [源码版本记录](docs/RELEASES.md)

## 下载

Windows x64 安装包从 [v1.1.2 GitHub Release](https://github.com/yanynayan-cdut/Mira_AI/releases/tag/v1.1.2) 下载。更早的本地安装包没有对应的仓库版本标签，因此不作为公开 Release 分发。安装前请阅读版本说明并核验校验和。

## 主要能力

- 多供应商 Chat、附件处理及文档预览。
- Claude Agent SDK 与 Pi Agent 双运行时，支持工具调用工作流。
- 按工作区配置 Skills、MCP Server 与项目指令。
- Agent 协作、持久化定时任务和本地规划工具。
- 浏览器/文件预览 Tab，以及可选的团队和消息平台集成。
- 本地优先的设置与会话存储。

## 本地开发

环境要求：Windows、macOS 或 Linux；[Bun](https://bun.sh/) 1.3.14；Git。Agent 功能还需要可用的 Node.js/Bun Shell，以及已配置的模型渠道凭据。

```bash
bun install --frozen-lockfile
bun run dev
```

常用检查：

```bash
bun run typecheck
bun test --isolate
```

公开 Windows 工作流只构建未签名的 x64 验证包，不会发布安装文件，也不会写入更新服务器。未签名安装包会显示 Windows 安全警告，直到配置受信任的代码签名证书。

## Windows 更新源

OSS 桌面版默认从 Mira GitHub Releases 检查更新。`PROFER_UPDATE_FEED_URL` 可在 GitHub 前增加一个安全的 HTTPS 更新源；不接受 HTTP、URL 内凭据和裸 IP 地址。公开 Mira 构建不再使用旧 Profer 更新服务器。

## 仓库结构

- `apps/electron/`：Mira 桌面应用与发布工具。
- `apps/cli/`：命令行应用。
- `packages/`：共享类型、Agent、Provider、会话、项目与 UI 包。
- `docs/`：持续维护的产品与工程文档。
- `release-notes/`：部分版本说明。

## 项目身份与历史

Mira 是独立的公开桌面产品仓库。本仓库保留了本地 Profer 代码库中可用的源码历史和版本标签；历史代码与包名中仍可能出现 `Profer` 或 `Proma`。首次公开 Mira 版本为 `v1.1.2`。版本覆盖范围与来源见[版本记录与溯源](docs/RELEASES.md)。

## 贡献与支持

提交 Pull Request 前请阅读[贡献指南](CONTRIBUTING.md)。安全漏洞请通过[安全政策](SECURITY.md)私下报告。使用问题和可复现的 Bug 请提交到 [GitHub Issues](https://github.com/yanynayan-cdut/Mira_AI/issues)。

## 许可证

社区版采用 GNU Affero General Public License v3.0，详情见 [LICENSE](LICENSE)。

Mira 基于 Profer/Proma 代码库及其上游历史开发。仓库保留的归属说明和第三方许可证请一并参阅。

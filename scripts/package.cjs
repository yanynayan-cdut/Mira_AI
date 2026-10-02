#!/usr/bin/env node
/**
 * 已废弃的国内源补发入口。
 *
 * 旧实现会自行改写 package.json、重复构建链并直接 SSH 上传，绕过正式发布门禁。
 * 为避免产生与 GitHub Release 不一致的半发布版本，此入口现在显式拒绝执行。
 */
console.error([
  'scripts/package.cjs 已停用，请使用 Windows release.yml 工作流构建验证。',
].join('\n'))
process.exit(1)

# Mira

Personal AI Memory Client，一个具有长期记忆能力的 ChatGPT 风格本地桌面客户端。

## 当前脚手架

- Tauri 2 + React + TypeScript
- TailwindCSS + shadcn/ui 风格本地组件
- Zustand 状态管理
- SQLite 本地存储
- Rust/Tauri 后端 OpenAI-compatible HTTP 模型网关
- 轻量自建 i18n（中/英，默认英文）

## 开发命令

```bash
pnpm install
pnpm build
pnpm tauri dev
```

`pnpm tauri dev` 需要本机 PATH 中有 Rust toolchain 和 `cargo`。

## 文档

- [架构说明](docs/architecture.md)
- [记忆系统](docs/memory-system.md)
- [项目上下文](docs/project-context.md)
- [安全说明](docs/security.md)

## 架构

```txt
React UI
  ↓ invoke
Tauri Commands
  ↓
Chat Service
  ↓
Model Gateway
  ↓
Memory Observer / Injection / Cleaner
  ↓
SQLite
```

## 目录

```txt
src
├── components
├── pages
├── store
├── core
├── i18n
└── utils

src-tauri/src
├── chat.rs
├── database.rs
├── memory.rs
├── model.rs
├── secrets.rs
└── types.rs
```

## MVP 边界

v1 只做本机单用户、纯聊天、长期记忆、SQLite 本地文件存储、多 OpenAI-compatible Provider 配置。不做 RAG、向量数据库、工具调用、多用户、云同步。

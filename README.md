<div align="center">

# Mira

**A simple enough, memory-aware open-source LLM chat client**

ChatGPT-inspired · Local-first · Lightweight · Easy to modify

[Features](#features) · [Why Mira](#why-mira) · [Quick Start](#quick-start) · [Tech Stack](#tech-stack) · [Fork It](#fork-it)

**[简体中文](README.zh-CN.md)** · English

</div>

---

## Why Mira

I needed a **simple enough** open-source LLM chat app with memory.

Existing solutions are either too heavy, lock the model and memory into a cloud service, or have codebases too complex to modify. So I built Mira, inspired by ChatGPT's design — **lightweight, supports custom models, and easy to modify yourself**.

If you also want a chat app that remembers what you said and belongs to you, fork it and make it your own.

## Features

- **Chat** — ChatGPT-style conversation UI with Markdown rendering and code highlighting
- **Long-term memory** — Automatically extracts memories from conversations and injects relevant context across chats; manual saved memories supported too
- **Multi-provider** — Any OpenAI-compatible endpoint (OpenAI, DeepSeek, Ollama, self-hosted gateways…). API keys stored in the OS credential vault
- **Projects** — Group conversations into projects; conversations in a project share context
- **Local storage** — All data stays in a local SQLite file. Nothing leaves your machine
- **i18n** — English / Chinese UI, English by default

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 11+
- [Rust](https://www.rust-lang.org/) stable (with `cargo`)

### Run

```bash
pnpm install
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer       | Tech                                          |
| ----------- | --------------------------------------------- |
| Frontend    | React 19 · TypeScript · TailwindCSS · Zustand |
| Desktop     | Tauri 2                                       |
| Backend     | Rust · OpenAI-compatible HTTP model gateway   |
| Storage     | SQLite (local file)                           |
| Credentials | OS keyring                                    |
| i18n        | Lightweight built-in (en / zh)                |

## Architecture

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

## Project Structure

```txt
src
├── components      # UI components
├── pages           # Chat page / Settings page
├── store           # Zustand state management
├── core            # Tauri client & types
├── i18n            # Internationalization (en / zh)
└── utils           # Utilities

src-tauri/src
├── chat.rs         # Tauri command handlers
├── database.rs     # SQLite data layer
├── memory.rs       # Memory extraction & injection
├── model.rs        # OpenAI-compatible model gateway
├── secrets.rs      # OS credential store access
└── types.rs        # Shared types
```

## Docs

- [Architecture](docs/architecture.md)
- [Memory System](docs/memory-system.md)
- [Project Context](docs/project-context.md)
- [Security](docs/security.md)

## Scope

v1 focuses on local single-user, plain chat, long-term memory, local SQLite storage, and multi-provider config.

**Not doing:** RAG, vector databases, tool calling, multi-user, cloud sync.

## Fork It

Mira's code is deliberately simple and readable. If you want your own LLM chat app, fork it and:

- Restyle the UI to your taste
- Wire up your own models or gateways
- Tweak the memory strategy
- Add whatever you need

PRs are welcome, but please open an issue first to discuss the direction.

## License

[GPL-3.0](LICENSE)

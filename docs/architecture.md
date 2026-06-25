# Mira Architecture

Mira is a local-first ChatGPT-style desktop client built with Tauri, React, TypeScript, Rust, and SQLite.

## MVP Boundary

- Single local user.
- Local conversations, projects, model configs, and memory.
- OpenAI-compatible chat completions.
- SQLite for durable app data.
- System credential storage for API keys.
- No cloud sync, multi-user account system, vector database, or external RAG service in the MVP.

## Data Ownership

- `saved` memories are user-managed. The user can create, edit, and delete them.
- `chat_history` and `project` memories are maintained by the automatic memory planner. The user can delete them from settings.
- Conversations can be archived, restored, moved into or out of projects, and deleted.
- Project context is retrieved by relevance for the current message instead of blindly injecting recent project messages.

## Storage

- SQLite stores conversations, messages, projects, memory facts, model config metadata, and schema metadata.
- API keys are stored in the operating system credential store through the Rust backend.
- `schema_meta.schema_version` tracks the active local schema version.
- SQLite FTS5 indexes support memory retrieval and project message relevance search.

## Frontend Structure

- `src/components` contains shared app UI such as the shell, sidebar, composer, and message renderer.
- `src/pages` contains route-level pages.
- `src/core` contains Tauri command types and invoke wrappers.
- `src/store` contains Zustand state and store helpers.

# Memory System

## Memory Types

- `saved`: explicit user-managed memory. Created by the user from settings or by an explicit "remember this" instruction. Only this type can be manually edited.
- `chat_history`: automatic long-term facts inferred from conversation history. The user can delete these, but normal editing is left to the maintainer.
- `project`: automatic facts about the current project or work context. The user can delete these from settings.

## Write Flow

1. The user sends a message and receives an assistant reply.
2. The memory planner evaluates the turn after the reply is generated.
3. If the selected model is a real OpenAI-compatible provider, the planner asks the model for structured JSON.
4. If planner inference fails, Mira falls back to deterministic heuristics.
5. Sensitive information is filtered before writing.
6. Automatic writes never overwrite `saved` memories unless the new write is also `saved`.

## Retrieval Flow

1. Mira first checks whether the current message is likely to need memory.
2. If retrieval is useful, SQLite FTS5 searches memory facts and tags.
3. If FTS returns no match, Mira falls back to keyword scoring.
4. Retrieved memories are marked as used and injected into the system prompt as private context.

## User Controls

- Settings can create, edit, and delete `saved` memories.
- Settings can view and delete automatic `chat_history` and `project` memories.
- Deleting a memory removes it from future retrieval.

# Project Context

Projects group related conversations. A conversation can be moved into a project or removed from it.

## Context Strategy

Mira does not inject all recent project messages into every request. For each user message, the backend searches messages from other conversations in the same project and injects only relevant matches.

The retrieval order is:

1. FTS5 search over project messages.
2. Keyword scoring fallback over a bounded recent candidate set.
3. No project context injection if there is no relevant match.

This keeps project context useful without letting unrelated project history dominate the prompt.

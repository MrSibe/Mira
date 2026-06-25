# Security Notes

## API Keys

API keys are stored through the operating system credential store from the Rust backend. SQLite stores only model provider metadata and a masked key indicator for the frontend.

On startup, Mira attempts to move legacy API keys from SQLite into the system credential store and then clears the database field.

## Destructive Actions

The UI asks for confirmation before deleting conversations, projects, or memories. Archive is reversible; delete is not.

## Sensitive Memory Filtering

The memory planner and fallback heuristics reject obvious secrets and personal identifiers such as API keys, passwords, tokens, ID numbers, bank cards, phone numbers, and similar sensitive content.

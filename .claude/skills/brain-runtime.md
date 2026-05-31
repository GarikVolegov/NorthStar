---
name: brain-runtime
description: Use when changing NorthStar brain markdown, vault ingestion, search_brain, RAG source metadata, or runtime:true knowledge exposed to Wendy.
---

# Brain Runtime

Keep `.brain/` useful as both an Obsidian vault and Wendy-readable runtime memory.

## Rules

- Treat `.brain/` curated notes as source; never hand-edit `.brain/90_Code/**`.
- Only markdown with `runtime: true` should be exposed to Wendy through vault ingest.
- Preserve frontmatter: `layer`, `status`, `runtime`, `owner`, `links_to`, `tags`, `updated`.
- Use `sourceType = "brain"` and `obsidianPath` for runtime citations.
- Internal NorthStar/product questions should prefer `search_brain`; labor-market questions stay on `search_rag`.

## Checks

- Verify changed runtime notes have valid YAML frontmatter.
- Verify vault ingest skips unchanged files and generated code graph paths.
- Verify citations include `.brain/...` paths when Wendy answers from brain memory.

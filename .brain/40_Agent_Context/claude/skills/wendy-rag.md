---
name: wendy-rag
description: Use when changing Wendy tools, prompts, RAG retrieval, search_brain, search_rag, router tool registration, or AI citations.
---

# Wendy RAG

Wendy needs the right memory source for the right question.

## Routing Rule

- Use `search_brain` for NorthStar internals: product architecture, Wendy behavior, GSD phases, `.brain` notes, project identity.
- Use `search_rag` for external/domain knowledge: labor market, career guidance, sector information, public knowledge.

## Tool Contract

`search_brain` results should expose:

- `content`
- `obsidianPath`
- `sectors`
- `roles`
- `similarity`
- `trustScore`

## Checks

- Registry exposes the tool for simple QA, conversation, and deep analysis.
- Handler filters `rag_sources.source_type = "brain"`.
- Optional layer filtering maps to stored brain sectors: identity, domain, product, process.
- Prompt guidance explains when to prefer brain vs RAG.

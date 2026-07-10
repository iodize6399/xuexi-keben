# Elementary Chinese Readers — Tutor Corpus v1

This is the canonical v1 corpus for both revised *Elementary Chinese Readers / 基础汉语课本* volumes.

## Use with a tutor agent

Ingest [`chunks.jsonl`](chunks.jsonl) as the default knowledge source. It contains 320 retrieval-ready chunks with stable IDs, section types, lesson/volume metadata, source page spans, and uncertainty flags.

The lesson and reference Markdown is the human-readable source:

- `lessons/lesson-01.md` through `lessons/lesson-44.md`
- `references/v01-pronunciation-reference.md`
- `references/v01-vocabulary.md`
- `references/v02-grammar-review.md`
- `references/v02-vocabulary.md`

Illustrations referenced by those documents are stored under `assets/`.

## Files

- `corpus.json` — corpus manifest and document index
- `chunks.jsonl` — default tutor retrieval corpus
- `uncertainties.json` — concise record of content intentionally excluded or still uncertain
- `lessons/` — one canonical Markdown file per lesson
- `references/` — pronunciation, grammar-review, and vocabulary references
- `assets/` — extracted textbook illustrations

The visually confirmed fixes and deterministic cleanup performed before v1 are already part of the canonical files. They are not maintained as a separate correction history; Git history begins from this baseline.

## Quality policy

The corpus is OCR-derived and not fully manually verified. Character/stroke tables and early phonetics material remain visible in Markdown but are excluded from `chunks.jsonl`. See [`uncertainties.json`](uncertainties.json) for the exact policy and remaining risks.

Run the regression validator before committing changes:

```bash
python3 scripts/validate_corpus.py
```

## Remote tutor access

The repository root contains a stateless, model-provider-independent MCP server that exposes this corpus for lesson study, search, and grounded quizzes. Its deployment bundle strips local illustration links from tool results while preserving the canonical lesson files here.

The local `.env`, source PDFs, and raw OCR-provider responses remain excluded by `.gitignore`.

# Xuexi Keben — Elementary Chinese Readers Tutor Corpus

Lesson-wise Markdown and retrieval-ready JSONL for both revised *Elementary Chinese Readers / 基础汉语课本* volumes.

- 44 lessons across two volumes
- 4 pronunciation, grammar, and vocabulary references
- 320 default retrieval chunks
- 86 referenced illustrations
- Explicit uncertainty policy for unreliable OCR material

Start with [the corpus guide](textbook/README.md). A tutor agent should ingest [`textbook/chunks.jsonl`](textbook/chunks.jsonl); canonical lesson files are under [`textbook/lessons/`](textbook/lessons/).

Validate the checked-in v1 corpus with:

```bash
python3 scripts/validate_corpus.py
```

The source PDFs, raw OCR responses, and API credentials are intentionally excluded from Git. Before publishing this corpus, confirm that you have permission to redistribute the textbook transcription and illustrations.

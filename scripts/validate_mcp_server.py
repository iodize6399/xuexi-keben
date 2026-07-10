#!/usr/bin/env python3
"""Validate the generated MCP corpus without requiring Node.js."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "textbook" / "chunks.jsonl"
GENERATED = ROOT / "src" / "generated" / "chunks.json"


def fail(message: str) -> None:
    print(f"MCP validation failed: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not GENERATED.exists():
        fail("generated corpus is missing; run npm run build:corpus")

    source = [
        json.loads(line)
        for line in SOURCE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    expected = [chunk for chunk in source if chunk.get("retrieval_enabled")]
    generated = json.loads(GENERATED.read_text(encoding="utf-8"))

    if len(generated) != len(expected):
        fail(f"expected {len(expected)} chunks, found {len(generated)}")

    ids = [chunk["chunk_id"] for chunk in generated]
    if len(ids) != len(set(ids)):
        fail("generated chunk IDs are not unique")

    lessons = {
        chunk["lesson_number"]
        for chunk in generated
        if chunk["document_type"] == "lesson"
    }
    if lessons != set(range(1, 45)):
        fail("generated corpus does not cover exactly Lessons 1-44")

    if any("![" in chunk["text"] for chunk in generated):
        fail("generated tool results still contain local Markdown image links")

    required = {
        "chunk_id",
        "document_id",
        "document_type",
        "section_type",
        "heading",
        "volume",
        "lesson_number",
        "text",
        "search_text",
        "quality_flags",
    }
    for index, chunk in enumerate(generated):
        missing = required - chunk.keys()
        if missing:
            fail(f"chunk {index} is missing fields: {sorted(missing)}")
        if not chunk["text"] or not chunk["search_text"]:
            fail(f"chunk {chunk['chunk_id']} has empty content")

    searchable = "\n".join(chunk["search_text"] for chunk in generated)
    for probe in ("你好", "ni hao", "grammar", "vocabulary"):
        if probe not in searchable:
            fail(f"search probe {probe!r} is absent")

    print(
        f"MCP corpus valid: {len(generated)} chunks, "
        f"{len(lessons)} lessons, local image links removed"
    )


if __name__ == "__main__":
    main()

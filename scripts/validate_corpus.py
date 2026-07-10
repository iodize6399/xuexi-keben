#!/usr/bin/env python3
"""Regression checks for the public v1 tutor corpus."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TEXTBOOK = ROOT / "textbook"
IMAGE_RE = re.compile(r"!\[[^]]*\]\(([^)]+)\)")


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> None:
    corpus = json.loads((TEXTBOOK / "corpus.json").read_text(encoding="utf-8"))
    uncertainties = json.loads((TEXTBOOK / "uncertainties.json").read_text(encoding="utf-8"))
    assert corpus["corpus_version"] == "1.0.0"
    assert corpus["book_id"] == "ecr-revised"
    assert corpus["path_base"] == "workspace_root"
    assert corpus["uncertainties_path"] == "textbook/uncertainties.json"
    assert uncertainties["corpus_version"] == corpus["corpus_version"]
    assert [item["lesson_number"] for item in corpus["lessons"]] == list(range(1, 45))
    assert len(corpus["references"]) == 4

    documents = corpus["lessons"] + corpus["references"]
    document_ids = {item["document_id"] for item in documents}
    markdown_paths = [ROOT / item["path"] for item in documents]
    assert all(path.exists() for path in markdown_paths)

    image_links = 0
    for path in markdown_paths:
        text = path.read_text(encoding="utf-8")
        assert len(re.findall(r"(?m)^# [^#]", text)) == 1, f"Expected one H1 in {path}"
        assert not re.search(r"\[tbl-[^]]+\.md\]", text), f"Unresolved table link in {path}"
        assert "<!-- OCR table:" not in text, f"Internal table marker leaked into {path}"
        assert not re.search(r"(?m)^\d{1,3}$", text), f"Stray printed-page footer in {path}"
        assert "box_2d" not in text, f"Layout artifact in {path}"
        for target in IMAGE_RE.findall(text):
            image_links += 1
            assert (path.parent / target).resolve().exists(), f"Broken image {target} in {path}"

        expected_pipes = None
        for line_number, line in enumerate(text.splitlines(), 1):
            if re.match(r"^\|(?:\s*:?-{3,}:?\s*\|)+$", line):
                expected_pipes = len(re.findall(r"(?<!\\)\|", line))
            elif line.startswith("|") and expected_pipes is not None:
                actual_pipes = len(re.findall(r"(?<!\\)\|", line))
                assert actual_pipes == expected_pipes, (
                    f"Malformed table row in {path}:{line_number}: "
                    f"{actual_pipes} pipes, expected {expected_pipes}"
                )
            elif not line.strip() or not line.startswith("|"):
                expected_pipes = None

    chunks = read_jsonl(TEXTBOOK / "chunks.jsonl")
    chunk_ids = [item["chunk_id"] for item in chunks]
    assert len(chunks) == corpus["retrieval"]["enabled_chunks"] == 320
    assert corpus["retrieval"]["excluded_by_uncertainty_policy"] == 75
    assert len(chunk_ids) == len(set(chunk_ids))
    assert all(item["retrieval_enabled"] for item in chunks)
    assert all(item["document_id"] in document_ids for item in chunks)
    assert not any(item["section_type"] == "character_table" for item in chunks)
    assert not any("phonetics_ocr_unverified" in item["quality_flags"] for item in chunks)
    assert all("<!--" not in item["text"] for item in chunks)

    expected_reference_ranges = {
        "ecr-revised-v01-pronunciation-reference": [14, 16],
        "ecr-revised-v01-vocabulary": [256, 273],
        "ecr-revised-v02-grammar-review": [338, 349],
        "ecr-revised-v02-vocabulary": [350, 387],
    }
    assert {item["document_id"]: item["source_pdf_pages"] for item in corpus["references"]} == expected_reference_ranges
    assert corpus["lessons"][14]["source_pdf_pages"] == [155, 165]
    assert corpus["lessons"][16]["source_pdf_pages"] == [181, 190]
    assert corpus["lessons"][-1]["source_pdf_pages"] == [320, 337]

    assets = list((TEXTBOOK / "assets").glob("volume-*/*.jpeg"))
    assert len(assets) == image_links == 86

    retired_files = [
        "index.json",
        "corrections.jsonl",
        "repairs.jsonl",
        "known_ocr_issues.jsonl",
        "review_queue.jsonl",
        "assets/volume-1/manifest.json",
        "assets/volume-2/manifest.json",
    ]
    assert not any((TEXTBOOK / path).exists() for path in retired_files)
    assert not (ROOT / "scripts/build_lessons.py").exists()
    assert not (ROOT / "scripts/extract_images.py").exists()

    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    for required in (".env", "*.pdf", "data/raw/"):
        assert required in gitignore, f"Public-repo exclusion missing: {required}"

    public_files = markdown_paths + [
        TEXTBOOK / "README.md",
        TEXTBOOK / "corpus.json",
        TEXTBOOK / "chunks.jsonl",
        TEXTBOOK / "uncertainties.json",
    ]
    sensitive_patterns = ("MISTRAL_API_KEY", "Authorization: Bearer", "api_key=")
    for path in public_files:
        text = path.read_text(encoding="utf-8")
        assert not any(pattern in text for pattern in sensitive_patterns), f"Secret-like text in {path}"

    canonical_text = "\n".join(path.read_text(encoding="utf-8") for path in markdown_paths)
    for retired_error in ("增加到一方", "18. 叮 (动) xià", "zázhl", "Initials j p x sh", "box_2d"):
        assert retired_error not in canonical_text, f"Confirmed OCR regression: {retired_error}"

    print("Validated public corpus v1.0.0")
    print("44 lessons, 4 references, 320 retrieval chunks")
    print("86 referenced assets resolved; 75 uncertain chunks excluded by policy")


if __name__ == "__main__":
    main()

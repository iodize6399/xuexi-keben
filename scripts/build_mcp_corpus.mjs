import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(
  new URL("../textbook/chunks.jsonl", import.meta.url),
);
const outputPath = fileURLToPath(
  new URL("../src/generated/chunks.json", import.meta.url),
);

function cleanText(text) {
  return text
    .replace(/!\[[^\]]*\]\([^\n)]+\)\s*/gu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function normalizeForSearch(text) {
  return text
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

const raw = await readFile(sourcePath, "utf8");
const chunks = raw
  .split(/\r?\n/gu)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((chunk) => chunk.retrieval_enabled)
  .map((chunk) => {
    const text = cleanText(chunk.text);
    const searchable = [
      chunk.heading,
      chunk.title_zh,
      chunk.title_en,
      chunk.section_type,
      text,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      chunk_id: chunk.chunk_id,
      document_id: chunk.document_id,
      document_type: chunk.document_type,
      section_type: chunk.section_type,
      heading: chunk.heading,
      volume: chunk.volume,
      lesson_number: chunk.lesson_number,
      title_zh: chunk.title_zh,
      title_en: chunk.title_en,
      source_pdf_pages: chunk.source_pdf_pages,
      source_printed_pages: chunk.source_printed_pages,
      average_ocr_confidence: chunk.average_ocr_confidence,
      quality_flags: chunk.quality_flags,
      text,
      search_text: normalizeForSearch(searchable),
    };
  });

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(chunks)}\n`, "utf8");

console.log(`Built ${chunks.length} MCP chunks at ${outputPath}`);

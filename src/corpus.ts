import generatedChunks from "./generated/chunks.json";

export type DocumentType =
  | "lesson"
  | "grammar_review"
  | "vocabulary_reference";

export interface TextbookChunk {
  chunk_id: string;
  document_id: string;
  document_type: DocumentType;
  section_type: string;
  heading: string;
  volume: number;
  lesson_number: number | null;
  title_zh: string | null;
  title_en: string | null;
  source_pdf_pages: [number, number];
  source_printed_pages: [number, number] | null;
  average_ocr_confidence: number;
  quality_flags: string[];
  text: string;
  search_text: string;
}

export type PublicChunk = Omit<TextbookChunk, "search_text">;

export interface LessonSummary {
  lesson_number: number;
  volume: number;
  title_zh: string;
  title_en: string;
  sections: string[];
}

export type StudyFocus =
  | "complete"
  | "conversation"
  | "vocabulary"
  | "grammar"
  | "reading"
  | "practice";

const chunks = generatedChunks as TextbookChunk[];

function normalizeForSearch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;

  while (count < 20) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    count += 1;
    from = index + Math.max(needle.length, 1);
  }

  return count;
}

function publicChunk(chunk: TextbookChunk): PublicChunk {
  const { search_text: _searchText, ...result } = chunk;
  return result;
}

const lessonMap = new Map<number, LessonSummary>();

for (const chunk of chunks) {
  if (chunk.document_type !== "lesson" || chunk.lesson_number === null) {
    continue;
  }

  const existing = lessonMap.get(chunk.lesson_number);
  if (existing) {
    if (!existing.sections.includes(chunk.section_type)) {
      existing.sections.push(chunk.section_type);
    }
    continue;
  }

  lessonMap.set(chunk.lesson_number, {
    lesson_number: chunk.lesson_number,
    volume: chunk.volume,
    title_zh: chunk.title_zh ?? `第${chunk.lesson_number}课`,
    title_en: chunk.title_en ?? `Lesson ${chunk.lesson_number}`,
    sections: [chunk.section_type],
  });
}

const lessons = Array.from(lessonMap.values())
  .map((lesson) => ({ ...lesson, sections: lesson.sections.sort() }))
  .sort((a, b) => a.lesson_number - b.lesson_number);

const focusSections: Record<Exclude<StudyFocus, "complete">, Set<string>> = {
  conversation: new Set(["conversation", "classroom_expressions", "text"]),
  vocabulary: new Set([
    "vocabulary",
    "vocabulary_characters",
    "additional_vocabulary",
  ]),
  grammar: new Set(["grammar", "grammar_review", "notes"]),
  reading: new Set(["conversation", "text"]),
  practice: new Set(["exercises", "substitution_drills"]),
};

export const corpusStats = {
  book: "Elementary Chinese Readers / 基础汉语课本 (Revised Edition)",
  volumes: 2,
  lessons: lessons.length,
  chunks: chunks.length,
  lesson_range: [
    lessons[0]?.lesson_number ?? 1,
    lessons[lessons.length - 1]?.lesson_number ?? 44,
  ],
  review_status: "ocr_unverified",
  transport: "MCP Streamable HTTP",
  model_provider: null,
} as const;

export function listLessons(volume?: number): LessonSummary[] {
  return lessons.filter(
    (lesson) => volume === undefined || lesson.volume === volume,
  );
}

export function getLesson(
  lessonNumber: number,
  sections?: string[],
): { lesson: LessonSummary; chunks: PublicChunk[] } | null {
  const lesson = lessonMap.get(lessonNumber);
  if (!lesson) return null;

  const selectedSections = sections?.length ? new Set(sections) : null;
  const lessonChunks = chunks
    .filter(
      (chunk) =>
        chunk.document_type === "lesson" &&
        chunk.lesson_number === lessonNumber &&
        (!selectedSections || selectedSections.has(chunk.section_type)),
    )
    .map(publicChunk);

  return { lesson, chunks: lessonChunks };
}

export interface SearchOptions {
  lessonNumber?: number;
  volume?: number;
  sectionType?: string;
  includeReferences?: boolean;
  limit?: number;
}

export interface SearchResult {
  score: number;
  chunk: PublicChunk;
}

export function searchTextbook(
  query: string,
  options: SearchOptions = {},
): SearchResult[] {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return [];

  const terms = Array.from(
    new Set(normalizedQuery.split(" ").filter((term) => term.length > 0)),
  );
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 10);

  return chunks
    .filter((chunk) => {
      if (
        options.lessonNumber !== undefined &&
        chunk.lesson_number !== options.lessonNumber
      ) {
        return false;
      }
      if (options.volume !== undefined && chunk.volume !== options.volume) {
        return false;
      }
      if (
        options.sectionType !== undefined &&
        chunk.section_type !== options.sectionType
      ) {
        return false;
      }
      if (
        options.includeReferences === false &&
        chunk.document_type !== "lesson"
      ) {
        return false;
      }
      return true;
    })
    .map((chunk) => {
      const phraseHits = countOccurrences(chunk.search_text, normalizedQuery);
      let score = phraseHits * 12;

      for (const term of terms) {
        const termHits = countOccurrences(chunk.search_text, term);
        score += termHits * (term.length >= 3 ? 3 : 1);
      }

      if (normalizeForSearch(chunk.heading).includes(normalizedQuery)) score += 8;
      if (normalizeForSearch(chunk.title_zh).includes(normalizedQuery)) score += 6;

      return { score, chunk };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.chunk.lesson_number ?? 999) - (b.chunk.lesson_number ?? 999),
    )
    .slice(0, limit)
    .map(({ score, chunk }) => ({ score, chunk: publicChunk(chunk) }));
}

export function getStudyContext(
  lessonNumber: number,
  focus: StudyFocus,
): { lesson: LessonSummary; focus: StudyFocus; chunks: PublicChunk[] } | null {
  const lessonResult = getLesson(lessonNumber);
  if (!lessonResult) return null;

  if (focus === "complete") {
    return { ...lessonResult, focus };
  }

  const preferred = focusSections[focus];
  const focused = lessonResult.chunks.filter((chunk) =>
    preferred.has(chunk.section_type),
  );

  return {
    lesson: lessonResult.lesson,
    focus,
    chunks: focused.length > 0 ? focused : lessonResult.chunks,
  };
}

export function getQuizSource(
  lessonNumber: number,
  quizTypes: string[],
): { lesson: LessonSummary; chunks: PublicChunk[] } | null {
  const lessonResult = getLesson(lessonNumber);
  if (!lessonResult) return null;

  const wanted = new Set<string>();
  const selectedTypes = quizTypes.includes("mixed")
    ? ["vocabulary", "grammar", "comprehension", "translation"]
    : quizTypes;

  for (const quizType of selectedTypes) {
    if (quizType === "vocabulary") {
      wanted.add("vocabulary");
      wanted.add("vocabulary_characters");
      wanted.add("additional_vocabulary");
    } else if (quizType === "grammar") {
      wanted.add("grammar");
      wanted.add("notes");
      wanted.add("substitution_drills");
    } else if (quizType === "comprehension") {
      wanted.add("conversation");
      wanted.add("text");
      wanted.add("exercises");
    } else if (quizType === "translation") {
      wanted.add("conversation");
      wanted.add("text");
      wanted.add("vocabulary");
      wanted.add("vocabulary_characters");
    }
  }

  const selected = lessonResult.chunks.filter((chunk) =>
    wanted.has(chunk.section_type),
  );

  return {
    lesson: lessonResult.lesson,
    chunks: selected.length > 0 ? selected : lessonResult.chunks,
  };
}

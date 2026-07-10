import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  corpusStats,
  getLesson,
  getQuizSource,
  getStudyContext,
  listLessons,
  searchTextbook,
} from "./corpus";

const SERVER_INSTRUCTIONS = `This is a read-only tutor corpus for the revised Elementary Chinese Readers / 基础汉语课本.
Ground teaching, explanations, corrections, and quizzes in returned textbook chunks. Do not invent textbook content.
When the learner has not selected a lesson, call list_lessons before teaching. For a lesson request, call start_study_session. For a quiz, call prepare_quiz and then ask exactly one question at a time, waiting for the learner's answer before feedback or the next question.
Keep material within the selected lesson unless the learner explicitly requests broader review. Cite lesson, section, and chunk_id when correcting an answer. Treat quality_flags as OCR caveats.`;

const QUIZ_PROTOCOL = [
  "Use only the supplied source chunks for textbook claims and expected answers.",
  "Ask exactly one question, then stop and wait for the student's answer.",
  "Do not reveal an answer or hint before the student attempts the question unless asked.",
  "After each answer, say whether it is correct, explain briefly from the source, and cite the chunk_id.",
  "Accept equivalent wording when the meaning is correct.",
  "Keep vocabulary and grammar within the selected lesson.",
  "Adjust the next question based on the student's previous answer while preserving the requested difficulty.",
  "After the requested number of questions, give a short score, strengths, and review targets.",
];

function result(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createTextbookServer(): McpServer {
  const server = new McpServer(
    {
      name: "xuexi-keben",
      title: "Elementary Chinese Readers Tutor",
      version: "1.0.0",
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "about_textbook",
    {
      title: "About the textbook corpus",
      description:
        "Get corpus coverage, quality status, and tutoring rules. Call this when a learner asks what material is available.",
      inputSchema: z.object({}),
    },
    async () =>
      result({
        ...corpusStats,
        behavior: "read-only, stateless, and model-provider independent",
        tutoring_rules: SERVER_INSTRUCTIONS.split("\n"),
      }),
  );

  server.registerTool(
    "list_lessons",
    {
      title: "List textbook lessons",
      description:
        "List lessons in textbook order, with titles and available section types. Use before selecting material when the learner has not named a lesson.",
      inputSchema: z.object({
        volume: z
          .number()
          .int()
          .min(1)
          .max(2)
          .optional()
          .describe("Optional volume filter: 1 or 2"),
      }),
    },
    async ({ volume }) => result({ lessons: listLessons(volume) }),
  );

  server.registerTool(
    "get_lesson",
    {
      title: "Get a complete textbook lesson",
      description:
        "Retrieve canonical chunks for one lesson. Optionally restrict to exact section_type values returned by list_lessons.",
      inputSchema: z.object({
        lesson_number: z
          .number()
          .int()
          .min(1)
          .max(44)
          .describe("Lesson number from 1 through 44"),
        sections: z
          .array(z.string())
          .max(12)
          .optional()
          .describe("Optional exact section_type filters"),
      }),
    },
    async ({ lesson_number, sections }) => {
      const lesson = getLesson(lesson_number, sections);
      return lesson
        ? result(lesson)
        : errorResult(`Lesson ${lesson_number} was not found.`);
    },
  );

  server.registerTool(
    "search_textbook",
    {
      title: "Search the textbook",
      description:
        "Search Chinese text, English, pinyin with or without tone marks, vocabulary, grammar, conversations, exercises, and reference sections. Returns grounded chunks with page metadata and OCR quality flags.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .max(200)
          .describe("Chinese, pinyin, or English search text"),
        lesson_number: z.number().int().min(1).max(44).optional(),
        volume: z.number().int().min(1).max(2).optional(),
        section_type: z.string().optional(),
        include_references: z
          .boolean()
          .default(true)
          .describe("Include grammar and vocabulary reference documents"),
        limit: z.number().int().min(1).max(10).default(6),
      }),
    },
    async ({
      query,
      lesson_number,
      volume,
      section_type,
      include_references,
      limit,
    }) =>
      result({
        query,
        results: searchTextbook(query, {
          lessonNumber: lesson_number,
          volume,
          sectionType: section_type,
          includeReferences: include_references,
          limit,
        }),
      }),
  );

  server.registerTool(
    "start_study_session",
    {
      title: "Start a focused study session",
      description:
        "Prepare lesson-bounded source material and a teaching contract for focused tutoring. Call this when a learner asks to study, learn, explain, revise, or practise a lesson.",
      inputSchema: z.object({
        lesson_number: z.number().int().min(1).max(44),
        focus: z
          .enum([
            "complete",
            "conversation",
            "vocabulary",
            "grammar",
            "reading",
            "practice",
          ])
          .default("complete"),
      }),
    },
    async ({ lesson_number, focus }) => {
      const context = getStudyContext(lesson_number, focus);
      if (!context) return errorResult(`Lesson ${lesson_number} was not found.`);

      return result({
        session_contract: [
          "Teach from the supplied lesson chunks, not from unrelated later material.",
          "Begin with a short explanation and one small example.",
          "Check understanding frequently and adapt to the student's replies.",
          "Cite chunk_id when explaining a correction.",
          "If a relevant chunk has quality_flags, communicate uncertainty rather than guessing.",
        ],
        ...context,
      });
    },
  );

  server.registerTool(
    "prepare_quiz",
    {
      title: "Prepare a grounded textbook quiz",
      description:
        "Return lesson-bounded quiz sources and an interaction protocol. After calling this, the client LLM creates and administers the questions without any model dependency in this server.",
      inputSchema: z.object({
        lesson_number: z.number().int().min(1).max(44),
        question_count: z.number().int().min(1).max(20).default(5),
        difficulty: z
          .enum(["recall", "understanding", "application"])
          .default("understanding"),
        quiz_types: z
          .array(
            z.enum([
              "mixed",
              "vocabulary",
              "grammar",
              "comprehension",
              "translation",
            ]),
          )
          .min(1)
          .max(4)
          .default(["mixed"]),
      }),
    },
    async ({ lesson_number, question_count, difficulty, quiz_types }) => {
      const source = getQuizSource(lesson_number, quiz_types);
      if (!source) return errorResult(`Lesson ${lesson_number} was not found.`);

      return result({
        quiz_settings: {
          lesson_number,
          question_count,
          difficulty,
          quiz_types,
        },
        quiz_protocol: QUIZ_PROTOCOL,
        ...source,
      });
    },
  );

  server.registerResource(
    "corpus-guide",
    "textbook://guide",
    {
      title: "Elementary Chinese Readers tutor guide",
      description: "Coverage and rules for using this corpus as a tutor",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            { ...corpusStats, instructions: SERVER_INSTRUCTIONS },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "lesson-index",
    "textbook://lessons",
    {
      title: "Textbook lesson index",
      description: "All lessons and their available section types",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ lessons: listLessons() }, null, 2),
        },
      ],
    }),
  );

  server.registerPrompt(
    "study_lesson",
    {
      title: "Study a textbook lesson",
      description: "Start a patient, interactive lesson-bounded tutoring session",
      argsSchema: {
        lesson_number: z.string().describe("Lesson number from 1 through 44"),
        focus: z
          .string()
          .optional()
          .describe(
            "complete, conversation, vocabulary, grammar, reading, or practice",
          ),
      },
    },
    ({ lesson_number, focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Call start_study_session for lesson ${lesson_number} with focus ${focus ?? "complete"}. Teach interactively from only the returned material, checking my understanding as we go.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "quiz_lesson",
    {
      title: "Quiz a textbook lesson",
      description: "Run a grounded quiz that asks one question at a time",
      argsSchema: {
        lesson_number: z.string().describe("Lesson number from 1 through 44"),
        question_count: z.string().optional().describe("Number of questions"),
      },
    },
    ({ lesson_number, question_count }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Call prepare_quiz for lesson ${lesson_number}, with ${question_count ?? "5"} questions. Follow its quiz_protocol exactly. Ask only the first question now and wait for my answer.`,
          },
        },
      ],
    }),
  );

  return server;
}

export { SERVER_INSTRUCTIONS };

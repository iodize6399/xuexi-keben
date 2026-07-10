import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.env.MCP_URL ?? "http://127.0.0.1:8787/mcp";
const baseUrl = new URL(endpoint);
baseUrl.pathname = "/";

const health = await fetch(new URL("/health", baseUrl));
assert.equal(health.status, 200);
assert.equal((await health.json()).status, "ok");

const setup = await fetch(new URL("/llms.txt", baseUrl));
assert.equal(setup.status, 200);
assert.match(await setup.text(), /Model provider: none/u);

const client = new Client({ name: "xuexi-keben-smoke-test", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));

try {
  await client.connect(transport);

  const listedTools = await client.listTools();
  const toolNames = listedTools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, [
    "about_textbook",
    "get_lesson",
    "list_lessons",
    "prepare_quiz",
    "search_textbook",
    "start_study_session",
  ]);

  const listedResources = await client.listResources();
  assert.equal(listedResources.resources.length, 2);
  const guideResource = await client.readResource({ uri: "textbook://guide" });
  assert.equal(guideResource.contents.length, 1);
  assert.match(guideResource.contents[0].text, /44/u);

  const listedPrompts = await client.listPrompts();
  assert.equal(listedPrompts.prompts.length, 2);
  const quizPrompt = await client.getPrompt({
    name: "quiz_lesson",
    arguments: { lesson_number: "1", question_count: "3" },
  });
  assert.match(quizPrompt.messages[0].content.text, /prepare_quiz/u);

  const aboutResult = await client.callTool({
    name: "about_textbook",
    arguments: {},
  });
  const about = JSON.parse(aboutResult.content[0].text);
  assert.equal(about.model_provider, null);

  const lessonsResult = await client.callTool({
    name: "list_lessons",
    arguments: {},
  });
  const lessons = JSON.parse(lessonsResult.content[0].text);
  assert.equal(lessons.lessons.length, 44);

  const lessonResult = await client.callTool({
    name: "get_lesson",
    arguments: { lesson_number: 1, sections: ["conversation"] },
  });
  const lesson = JSON.parse(lessonResult.content[0].text);
  assert.equal(lesson.lesson.lesson_number, 1);
  assert.ok(lesson.chunks.every((chunk) => chunk.section_type === "conversation"));

  const searchResult = await client.callTool({
    name: "search_textbook",
    arguments: { query: "ni hao", limit: 3 },
  });
  const search = JSON.parse(searchResult.content[0].text);
  assert.ok(search.results.length > 0);
  assert.match(search.results[0].chunk.text, /Nǐ hǎo|你好/u);

  const studyResult = await client.callTool({
    name: "start_study_session",
    arguments: { lesson_number: 1, focus: "vocabulary" },
  });
  const study = JSON.parse(studyResult.content[0].text);
  assert.equal(study.lesson.lesson_number, 1);
  assert.equal(study.focus, "vocabulary");

  const quizResult = await client.callTool({
    name: "prepare_quiz",
    arguments: { lesson_number: 1, question_count: 3 },
  });
  const quiz = JSON.parse(quizResult.content[0].text);
  assert.equal(quiz.quiz_settings.lesson_number, 1);
  assert.equal(quiz.quiz_settings.question_count, 3);
  assert.ok(quiz.quiz_protocol.some((rule) => rule.includes("one question")));

  console.log(
    `MCP smoke test passed: ${toolNames.length} tools, ` +
      `${listedResources.resources.length} resources, ${listedPrompts.prompts.length} prompts`,
  );
} finally {
  await client.close();
}

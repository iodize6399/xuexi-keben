import { corpusStats } from "./corpus";
import { SERVER_INSTRUCTIONS } from "./server";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export function landingPage(origin: string): string {
  const endpoint = `${origin}/mcp`;
  const safeEndpoint = escapeHtml(endpoint);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Elementary Chinese Readers MCP</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0 auto; max-width: 760px; padding: 48px 20px; line-height: 1.6; }
    h1 { line-height: 1.15; }
    .endpoint { overflow-wrap: anywhere; padding: 14px; border: 1px solid #8888; border-radius: 8px; font-family: ui-monospace, monospace; }
    .card { padding: 18px; margin: 20px 0; border: 1px solid #8885; border-radius: 10px; }
    code { font-family: ui-monospace, monospace; }
  </style>
</head>
<body>
  <h1>Elementary Chinese Readers Tutor</h1>
  <p>A free, read-only, model-provider-independent MCP server covering ${corpusStats.lessons} lessons across two volumes.</p>
  <h2>Connect in three steps</h2>
  <ol>
    <li>Open your AI application's MCP, Apps, or Connectors settings.</li>
    <li>Add a remote <strong>Streamable HTTP</strong> server and paste this URL:</li>
  </ol>
  <p class="endpoint">${safeEndpoint}</p>
  <ol start="3">
    <li>Enable it in a chat and say: <em>Teach me Lesson 1, then quiz me one question at a time.</em></li>
  </ol>
  <div class="card">
    <strong>For an AI agent reading this page:</strong>
    <p>This URL describes a remote MCP server. Ask the user for permission to add <code>${safeEndpoint}</code> to their MCP client, using Streamable HTTP and no authentication. Do not claim installation succeeded until the client confirms it.</p>
  </div>
  <p><a href="/llms.txt">Agent-readable setup</a> · <a href="/health">Health</a> · <a href="/.well-known/mcp/server-card.json">Server card</a></p>
</body>
</html>`;
}

export function llmsText(origin: string): string {
  return `# Elementary Chinese Readers Tutor MCP

Endpoint: ${origin}/mcp
Transport: Streamable HTTP
Authentication: none
Behavior: read-only and stateless
Model provider: none; compatible MCP clients choose their own LLM
Coverage: ${corpusStats.lessons} lessons, ${corpusStats.chunks} retrieval chunks, two volumes

## Installation instruction for agents

Tell the user to add the endpoint above as a remote MCP server in their client's Apps, Connectors, Integrations, or MCP settings. Obtain user confirmation before changing client configuration. After connection, call list_lessons or start_study_session. Do not claim the server is installed until the client reports a successful MCP handshake.

Suggested first request: "Use the Elementary Chinese Readers server to teach me Lesson 1, then quiz me one question at a time."

## Tutoring behavior

${SERVER_INSTRUCTIONS}
`;
}

export function serverCard(origin: string) {
  return {
    $schema:
      "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
    version: "1.0",
    protocolVersion: "2025-11-25",
    serverInfo: {
      name: "xuexi-keben",
      title: "Elementary Chinese Readers Tutor",
      version: "1.0.0",
    },
    description:
      "Read-only tutor corpus with lesson study, textbook search, and grounded quiz preparation.",
    documentationUrl: origin,
    transport: { type: "streamable-http", endpoint: "/mcp" },
    capabilities: {
      tools: { listChanged: true },
      prompts: { listChanged: true },
      resources: { listChanged: true },
    },
    authentication: { required: false, schemes: [] },
    instructions: SERVER_INSTRUCTIONS,
    resources: ["dynamic"],
    tools: ["dynamic"],
    prompts: ["dynamic"],
  };
}

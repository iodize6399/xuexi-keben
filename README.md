# Xuexi Keben — Chinese Textbook Tutor MCP

A free, read-only, model-provider-independent MCP server for the revised *Elementary Chinese Readers / 基础汉语课本* corpus.

- 44 lessons across two volumes
- 320 retrieval-ready textbook chunks
- Focused lesson study, Chinese/pinyin/English search, and grounded quizzes
- Standard MCP Streamable HTTP transport
- No model API, model account, database, embeddings, or server-side student data

## Connect in 1-2-3

Share this MCP URL:

```text
https://keben.555420.xyz/mcp
```

1. Open **MCP**, **Apps**, or **Connectors** in your AI application.
2. Add a remote Streamable HTTP server and paste the URL above. Authentication is **None**.
3. Enable it in a chat and say:

> Teach me Lesson 1 from the Elementary Chinese Readers textbook. Then quiz me one question at a time and explain my mistakes.

The same URL works with any client that supports remote MCP. The client chooses the LLM; this server does not know or care whether it is Claude, ChatGPT, Codex, Gemini, or a local model.

## Let an agent guide installation

Send the agent the public home-page URL, without `/mcp`, and say:

> Open this URL, read its agent setup instructions, and help me connect its MCP server. Ask before changing my configuration.

The deployed home page links to `/llms.txt`, health metadata, and a machine-readable server card. MCP clients intentionally require user or administrator approval before trusting a new server, so a normal web chat cannot silently install one.

### Claude

In Claude web or Desktop:

1. Go to **Settings → Connectors → Add custom connector**.
2. Name it `Elementary Chinese Readers` and paste the `/mcp` URL.
3. In a chat, select **+ → Connectors**, enable it, and ask to study a lesson.

In Claude Code, an authorized agent can run:

```bash
claude mcp add --transport http --scope user chinese-textbook https://keben.555420.xyz/mcp
```

### ChatGPT

Custom remote MCP apps currently depend on the ChatGPT plan and workspace settings. Where developer mode is available:

1. Open **Settings → Apps → Advanced Settings** and enable developer mode.
2. Choose **Apps → Create**, provide the `/mcp` endpoint, select no authentication, scan the tools, and create the app.
3. Enable the app in a new chat.

On managed university workspaces, an administrator may need to create or approve the app once for the class.

## Deploy once for the whole class

The repository is ready for a free Cloudflare Worker deployment.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/iodize6399/xuexi-keben)

Or deploy from a terminal with Node.js 22 or newer:

```bash
npm install
npm run check
npm run deploy
```

Cloudflare will print a URL ending in `workers.dev`. Append `/mcp` and test it before sharing.

For local development:

```bash
npm install
npm run dev
```

The MCP endpoint is `http://localhost:8787/mcp`. Test it with:

```bash
npx @modelcontextprotocol/inspector@latest
```

## MCP capabilities

| Capability | What it does |
| --- | --- |
| `about_textbook` | Describes coverage and tutoring rules |
| `list_lessons` | Lists Lessons 1–44 and their sections |
| `get_lesson` | Retrieves a complete or section-filtered lesson |
| `search_textbook` | Searches Chinese, English, and pinyin with or without tone marks |
| `start_study_session` | Returns lesson-bounded material and a teaching contract |
| `prepare_quiz` | Returns grounded quiz material and a one-question-at-a-time protocol |

The server also exposes lesson-index resources and reusable `study_lesson` and `quiz_lesson` prompts. Quiz questions are created by the student's chosen LLM from returned textbook material, keeping this server model-neutral and free to operate.

## Project layout

- `src/` — stateless MCP Worker, retrieval, tutoring rules, and public setup page
- `textbook/chunks.jsonl` — canonical retrieval corpus
- `textbook/lessons/` — human-readable lesson files
- `scripts/build_mcp_corpus.mjs` — creates the compact Worker data bundle
- `scripts/validate_corpus.py` — validates the canonical corpus
- `scripts/validate_mcp_server.py` — validates the generated MCP data

The OCR-derived corpus carries confidence values and quality flags. The MCP server returns those flags with source page metadata so tutors can communicate uncertainty instead of guessing.

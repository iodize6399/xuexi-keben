import { createMcpHandler } from "agents/mcp";

import { landingPage, llmsText, serverCard } from "./landing";
import { createTextbookServer } from "./server";

const securityHeaders = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function response(
  body: BodyInit | null,
  contentType: string,
  init: ResponseInit = {},
): Response {
  return new Response(body, {
    ...init,
    headers: {
      "Content-Type": contentType,
      ...securityHeaders,
      ...init.headers,
    },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      // MCP SDK 1.26+ requires a fresh server/transport for every stateless request.
      const server = createTextbookServer();
      return createMcpHandler(server, { route: "/mcp" })(request, env, ctx);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return response("Method not allowed", "text/plain; charset=utf-8", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    if (url.pathname === "/") {
      return response(
        request.method === "HEAD" ? null : landingPage(url.origin),
        "text/html; charset=utf-8",
      );
    }

    if (url.pathname === "/llms.txt") {
      return response(
        request.method === "HEAD" ? null : llmsText(url.origin),
        "text/plain; charset=utf-8",
      );
    }

    if (url.pathname === "/health") {
      return response(
        request.method === "HEAD"
          ? null
          : JSON.stringify({
              status: "ok",
              server: "xuexi-keben",
              version: "1.0.0",
            }),
        "application/json; charset=utf-8",
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (url.pathname === "/.well-known/mcp/server-card.json") {
      return response(
        request.method === "HEAD"
          ? null
          : JSON.stringify(serverCard(url.origin), null, 2),
        "application/json; charset=utf-8",
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
          },
        },
      );
    }

    return response("Not found", "text/plain; charset=utf-8", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

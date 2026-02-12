import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { client } from "../src/client/client.gen";
import { config } from "../src/config";
import z from "zod";
import { getPageContent } from "../src/client/helpers";
import { createPage, listDocs, listPages, resolveBrowserLink, updatePage } from "../src/client/sdk.gen";

// Initialize the Coda client once (this is fine to cache across requests)
client.setConfig({
  baseURL: "https://coda.io/apis/v1",
  headers: {
    Authorization: `Bearer ${config.codaApiToken}`,
  },
});

// Create a fresh MCP server instance for each request to avoid connection conflicts
function createMcpServer() {
  const server = new McpServer({
    name: "coda",
    version: "1.5.1",
  });

  // Register all tools
  server.tool(
    "coda_list_documents",
    "List or search available documents",
    {
      query: z.string().optional().describe("The query to search for documents by - optional"),
    },
    async ({ query }): Promise<CallToolResult> => {
      try {
        const resp = await listDocs({ query: { query }, throwOnError: true });
        return { content: [{ type: "text", text: JSON.stringify(resp.data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to list documents: ${error}` }], isError: true };
      }
    },
  );

  server.tool(
    "coda_list_pages",
    "List pages in the current document with pagination",
    {
      docId: z.string().describe("The ID of the document to list pages from"),
      limit: z.number().int().positive().optional().describe("The number of pages to return - optional, defaults to 25"),
      nextPageToken: z.string().optional().describe("The token need to get the next page of results"),
    },
    async ({ docId, limit, nextPageToken }): Promise<CallToolResult> => {
      try {
        const listLimit = nextPageToken ? undefined : limit;
        const resp = await listPages({
          path: { docId },
          query: { limit: listLimit, pageToken: nextPageToken ?? undefined },
          throwOnError: true,
        });
        return { content: [{ type: "text", text: JSON.stringify(resp.data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to list pages: ${error}` }], isError: true };
      }
    },
  );

  server.tool(
    "coda_create_page",
    "Create a page in the current document",
    {
      docId: z.string().describe("The ID of the document to create the page in"),
      name: z.string().describe("The name of the page to create"),
      content: z.string().optional().describe("The markdown content of the page to create - optional"),
      parentPageId: z.string().optional().describe("The ID of the parent page to create this page under - optional"),
    },
    async ({ docId, name, content, parentPageId }): Promise<CallToolResult> => {
      try {
        const resp = await createPage({
          path: { docId },
          body: {
            name,
            parentPageId: parentPageId ?? undefined,
            pageContent: {
              type: "canvas",
              canvasContent: { format: "markdown", content: content ?? " " },
            },
          },
          throwOnError: true,
        });
        return { content: [{ type: "text", text: JSON.stringify(resp.data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to create page: ${error}` }], isError: true };
      }
    },
  );

  server.tool(
    "coda_get_page_content",
    "Get the content of a page as markdown",
    {
      docId: z.string().describe("The ID of the document that contains the page"),
      pageIdOrName: z.string().describe("The ID or name of the page"),
    },
    async ({ docId, pageIdOrName }): Promise<CallToolResult> => {
      try {
        const content = await getPageContent(docId, pageIdOrName);
        if (content === undefined) {
          throw new Error("Unknown error occurred");
        }
        return { content: [{ type: "text", text: content }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to get page content: ${error}` }], isError: true };
      }
    },
  );

  server.tool(
    "coda_replace_page_content",
    "Replace the content of a page with new markdown content",
    {
      docId: z.string().describe("The ID of the document"),
      pageIdOrName: z.string().describe("The ID or name of the page"),
      content: z.string().describe("The markdown content to replace with"),
    },
    async ({ docId, pageIdOrName, content }): Promise<CallToolResult> => {
      try {
        const resp = await updatePage({
          path: { docId, pageIdOrName },
          body: {
            // @ts-expect-error auto-generated client types
            contentUpdate: {
              insertionMode: "replace",
              canvasContent: { format: "markdown", content },
            },
          },
          throwOnError: true,
        });
        return { content: [{ type: "text", text: JSON.stringify(resp.data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to replace page content: ${error}` }], isError: true };
      }
    },
  );

  server.tool(
    "coda_append_page_content",
    "Append new markdown content to the end of a page",
    {
      docId: z.string().describe("The ID of the document"),
      pageIdOrName: z.string().describe("The ID or name of the page"),
      content: z.string().describe("The markdown content to append"),
    },
    async ({ docId, pageIdOrName, content }): Promise<CallToolResult> => {
      try {
        const resp = await updatePage({
          path: { docId, pageIdOrName },
          body: {
            // @ts-expect-error auto-generated client types
            contentUpdate: {
              insertionMode: "append",
              canvasContent: { format: "markdown", content },
            },
          },
          throwOnError: true,
        });
        return { content: [{ type: "text", text: JSON.stringify(resp.data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to append page content: ${error}` }], isError: true };
      }
    },
  );

  server.tool(
    "coda_resolve_link",
    "Resolve metadata given a browser link to a Coda object",
    {
      url: z.string().describe("The URL to resolve"),
    },
    async ({ url }): Promise<CallToolResult> => {
      try {
        const resp = await resolveBrowserLink({
          query: { url },
          throwOnError: true,
        });
        return { content: [{ type: "text", text: JSON.stringify(resp.data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to resolve link: ${error}` }], isError: true };
      }
    },
  );

  return server;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "GET") {
    // Extract path without query string
    const urlPath = req.url?.split('?')[0] || '/';
    
    // OAuth discovery endpoints
    if (urlPath === '/.well-known/oauth-authorization-server') {
      res.status(200).json({
        issuer: `https://${req.headers.host}`,
        token_endpoint: `https://${req.headers.host}/api/mcp/token`,
        registration_endpoint: `https://${req.headers.host}/api/mcp/register`,
      });
      return;
    }

    if (urlPath === '/.well-known/oauth-protected-resource' || urlPath === '/.well-known/oauth-protected-resource/api/mcp') {
      res.status(200).json({
        resource: `https://${req.headers.host}/api/mcp`,
        authorization_servers: [`https://${req.headers.host}`],
      });
      return;
    }

    if (urlPath === '/register') {
      // Accept any client registration for now (authless mode)
      res.status(200).json({
        client_id: "authless",
        client_secret: "not_required",
      });
      return;
    }
    
    // Health check
    if (urlPath === '/' || urlPath === '/health') {
      res.status(200).json({ 
        status: "ok", 
        server: "coda-mcp", 
        version: "1.5.1" 
      });
      return;
    }

    // SSE endpoint - create fresh server instance for each connection
    console.error("New SSE connection established");

    const mcpServer = createMcpServer();
    const transport = new SSEServerTransport("/api/mcp/messages", res);
    await mcpServer.connect(transport);

    // Handle client disconnect
    req.on("close", () => {
      console.error("SSE connection closed");
    });
  } else if (req.method === "POST") {
    const urlPath = req.url?.split('?')[0] || '/';
    
    // Token endpoint (for OAuth - but we're authless, so just return success)
    if (urlPath === '/token') {
      res.status(200).json({
        access_token: "authless_mode",
        token_type: "Bearer",
        expires_in: 3600,
      });
      return;
    }
    
    // Message endpoint - SSE transport handles this
    res.status(200).send("OK");
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

import "dotenv/config";
import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import z from "zod";
import { client } from "./client/client.gen";
import { config } from "./config";
import { getPageContent } from "./client/helpers";
import { createPage, listDocs, listPages, resolveBrowserLink, updatePage } from "./client/sdk.gen";

// Function to create a fresh MCP server instance for each connection
function createMcpServer() {
  const server = new McpServer({
    name: "coda",
    version: "1.5.1",
  });

  // Register all tools (copying from src/server.ts)
  server.tool(
    "coda_list_documents",
    "List or search available documents",
    { query: z.string().optional().describe("The query to search for documents by - optional") },
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
            pageContent: { type: "canvas", canvasContent: { format: "markdown", content: content ?? " " } },
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
        if (content === undefined) throw new Error("Unknown error occurred");
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
            contentUpdate: { insertionMode: "replace", canvasContent: { format: "markdown", content } },
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
            contentUpdate: { insertionMode: "append", canvasContent: { format: "markdown", content } },
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
    "coda_duplicate_page",
    "Duplicate a page in the current document",
    {
      docId: z.string().describe("The ID of the document that contains the page to duplicate"),
      pageIdOrName: z.string().describe("The ID or name of the page to duplicate"),
      newName: z.string().describe("The name of the new page"),
    },
    async ({ docId, pageIdOrName, newName }): Promise<CallToolResult> => {
      try {
        const pageContent = await getPageContent(docId, pageIdOrName);
        const createResp = await createPage({
          path: { docId },
          body: {
            name: newName,
            pageContent: { type: "canvas", canvasContent: { format: "markdown", content: pageContent } },
          },
          throwOnError: true,
        });
        return { content: [{ type: "text", text: JSON.stringify(createResp.data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to duplicate page: ${error}` }], isError: true };
      }
    },
  );

  server.tool(
    "coda_rename_page",
    "Rename a page in the current document",
    {
      docId: z.string().describe("The ID of the document that contains the page to rename"),
      pageIdOrName: z.string().describe("The ID or name of the page to rename"),
      newName: z.string().describe("The new name of the page"),
    },
    async ({ docId, pageIdOrName, newName }): Promise<CallToolResult> => {
      try {
        const resp = await updatePage({
          path: { docId, pageIdOrName },
          body: { name: newName },
          throwOnError: true,
        });
        return { content: [{ type: "text", text: JSON.stringify(resp.data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to rename page: ${error}` }], isError: true };
      }
    },
  );

  server.tool(
    "coda_peek_page",
    "Peek into the beginning of a page and return a limited number of lines",
    {
      docId: z.string().describe("The ID of the document that contains the page to peek into"),
      pageIdOrName: z.string().describe("The ID or name of the page to peek into"),
      numLines: z.number().int().positive().describe("The number of lines to return from the start of the page - usually 30 lines is enough"),
    },
    async ({ docId, pageIdOrName, numLines }): Promise<CallToolResult> => {
      try {
        const content = await getPageContent(docId, pageIdOrName);
        if (!content) throw new Error("Unknown error has occurred");
        const preview = content.split(/\r?\n/).slice(0, numLines).join("\n");
        return { content: [{ type: "text", text: preview }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to peek page: ${error}` }], isError: true };
      }
    },
  );

  server.tool(
    "coda_resolve_link",
    "Resolve metadata given a browser link to a Coda object",
    { url: z.string().describe("The URL to resolve") },
    async ({ url }): Promise<CallToolResult> => {
      try {
        const resp = await resolveBrowserLink({ query: { url }, throwOnError: true });
        return { content: [{ type: "text", text: JSON.stringify(resp.data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to resolve link: ${error}` }], isError: true };
      }
    },
  );

  return server;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (Claude.ai needs this)
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", server: "coda-mcp", version: "1.5.1" });
});

// OAuth Protected Resource Metadata (RFC 9728)
app.get("/.well-known/oauth-protected-resource", (req, res) => {
  const baseUrl = `https://${req.get("host")}`;
  res.json({
    resource: baseUrl,
    authorization_servers: [baseUrl],
  });
});

// OAuth Authorization Server Metadata (RFC 8414)
app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const baseUrl = `https://${req.get("host")}`;
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
  });
});

// Dynamic Client Registration (RFC 7591)
app.post("/register", express.json(), (req, res) => {
  // For now, accept any registration and return a client ID
  // TODO: Store registrations in database for production
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  });
});

// Authorization endpoint - where users consent
app.get("/authorize", (req, res) => {
  // TODO: Implement full OAuth authorization flow
  // For now, auto-approve and redirect back with code
  const { redirect_uri, state, code_challenge } = req.query;
  
  if (!redirect_uri || !state) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }
  
  // Generate authorization code
  const code = `auth_code_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  // TODO: Store code with code_challenge for PKCE verification
  
  // Redirect back to client
  const redirectUrl = new URL(redirect_uri as string);
  redirectUrl.searchParams.append("code", code);
  redirectUrl.searchParams.append("state", state as string);
  res.redirect(redirectUrl.toString());
});

// Token endpoint - exchange code for token
app.post("/token", express.json(), express.urlencoded({ extended: true }), (req, res) => {
  const { grant_type, code, code_verifier, redirect_uri } = req.body;
  
  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }
  
  if (!code) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }
  
  // TODO: Verify code, code_verifier (PKCE), and redirect_uri
  // TODO: Store and validate tokens in database
  
  // Generate access token
  const accessToken = `access_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const refreshToken = `refresh_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshToken,
  });
});

// Main MCP endpoint (supports SSE)
app.get("/", async (req, res) => {
  // TODO: Verify OAuth access token from Authorization header
  // const authHeader = req.headers.authorization;
  // if (!authHeader?.startsWith("Bearer ")) {
  //   res.status(401).set("WWW-Authenticate", 'Bearer realm="MCP"').json({ error: "Unauthorized" });
  //   return;
  // }

  console.error("New MCP SSE connection established");

  // Initialize Axios Client with API key
  client.setConfig({
    baseURL: "https://coda.io/apis/v1",
    headers: {
      Authorization: `Bearer ${config.codaApiToken}`,
    },
  });

  // Create fresh server instance for this connection
  const mcpServer = createMcpServer();
  const transport = new SSEServerTransport("/messages", res);
  await mcpServer.connect(transport);

  // Handle client disconnect
  req.on("close", () => {
    console.error("SSE connection closed");
  });
});

// POST endpoint for MCP messages
app.post("/messages", express.json(), async (req, res) => {
  // TODO: Same OAuth token verification as GET /
  // This endpoint is used by the SSE transport to receive messages from the client
  res.status(200).send();
});

// Start server (for local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.error(`Coda MCP HTTP server running on port ${PORT}`);
    console.error(`MCP endpoint: http://localhost:${PORT}/`);
  });
}

// Export for Vercel
export default app;

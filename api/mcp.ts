import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { server } from "../src/server";
import { client } from "../src/client/client.gen";
import { config } from "../src/config";

// Initialize the Coda client once
client.setConfig({
  baseURL: "https://coda.io/apis/v1",
  headers: {
    Authorization: `Bearer ${config.codaApiToken}`,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Verify authentication token from query parameter
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  
  if (expectedToken) {
    const providedToken = req.query.token;
    
    if (!providedToken) {
      res.status(401).json({ error: "Unauthorized: Missing token query parameter" });
      return;
    }
    
    if (providedToken !== expectedToken) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }
  }

  if (req.method === "GET") {
    // Extract path without query string
    const urlPath = req.url?.split('?')[0] || '/';
    
    // Health check
    if (urlPath === '/' || urlPath === '/health') {
      res.status(200).json({ 
        status: "ok", 
        server: "coda-mcp", 
        version: "1.5.1" 
      });
      return;
    }

    // SSE endpoint - main connection
    console.error("New SSE connection established");

    const transport = new SSEServerTransport("/api/mcp/messages", res);
    await server.connect(transport);

    // Handle client disconnect
    req.on("close", () => {
      console.error("SSE connection closed");
    });
  } else if (req.method === "POST") {
    // Message endpoint - SSE transport handles this
    res.status(200).send("OK");
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

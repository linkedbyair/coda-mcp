import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { server } from "../src/server";
import { client } from "../src/client/client.gen";
import { config } from "../src/config";

// Initialize the Coda client once
client.setConfig({
  baseURL: "https://coda.io/apis/v1",
  headers: {
    Authorization: `Bearer ${config.apiKey}`,
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

  if (req.method === "GET") {
    // Health check
    if (req.url === "/api/mcp" || req.url === "/api/mcp/health") {
      res.status(200).json({ 
        status: "ok", 
        server: "coda-mcp", 
        version: "1.5.1" 
      });
      return;
    }

    // SSE endpoint
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

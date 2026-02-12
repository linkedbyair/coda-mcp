import "dotenv/config";
import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { client } from "./client/client.gen";
import { config } from "./config";
import { server } from "./server";

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (Claude.ai needs this)
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", server: "coda-mcp", version: "1.5.1" });
});

// SSE endpoint for MCP
app.get("/sse", async (req, res) => {
  console.error("New SSE connection established");

  // Initialize Axios Client with API key
  client.setConfig({
    baseURL: "https://coda.io/apis/v1",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);

  // Handle client disconnect
  req.on("close", () => {
    console.error("SSE connection closed");
  });
});

// POST endpoint for MCP messages
app.post("/messages", async (req, res) => {
  // This endpoint is used by the SSE transport to receive messages from the client
  // The SSE transport handles the routing internally
  res.status(200).send();
});

// Start server
async function main() {
  app.listen(PORT, () => {
    console.error(`Coda MCP HTTP server running on port ${PORT}`);
    console.error(`SSE endpoint: http://localhost:${PORT}/sse`);
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

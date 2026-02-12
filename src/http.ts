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

  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);

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

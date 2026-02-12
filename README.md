# Coda MCP Server

Model Context Protocol (MCP) server for interacting with the [Coda](https://coda.io/) API. Allows AI assistants to perform actions on Coda documents and pages.

## Features

- **`coda_list_documents`**: List all documents available to the user
- **`coda_list_pages`**: List all pages within a document with pagination
- **`coda_create_page`**: Create a new page with optional parent page and markdown content
- **`coda_get_page_content`**: Get page content as markdown
- **`coda_replace_page_content`**: Replace page content with new markdown
- **`coda_append_page_content`**: Append markdown content to a page
- **`coda_duplicate_page`**: Duplicate an existing page
- **`coda_rename_page`**: Rename a page
- **`coda_peek_page`**: Preview the first N lines of a page
- **`coda_resolve_link`**: Resolve metadata from a Coda browser link

## Usage

### Claude Desktop / Cursor

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "coda": {
      "command": "npx",
      "args": ["-y", "coda-mcp@latest"],
      "env": {
        "API_KEY": "your_coda_api_key"
      }
    }
  }
}
```

Get your API key from [Coda account settings](https://coda.io/account).

### Claude.ai Web

Deploy to Vercel to use with Claude.ai web application.

#### 1. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import this repository from GitHub
3. Vercel will detect the project automatically

#### 2. Add Environment Variable

In Vercel project settings:

1. Go to **Settings** → **Environment Variables**
2. Add `API_KEY` with your Coda API key from https://coda.io/account
3. Select **Production** environment
4. Save

#### 3. Deploy

Vercel will automatically deploy. Your deployment will be at: `https://your-project.vercel.app`

#### 4. Configure Claude.ai

1. Go to [Claude.ai](https://claude.ai) Settings
2. Navigate to **Capabilities** or **Extensions**
3. Add your MCP server URL: `https://your-project.vercel.app/api/mcp`

#### Verify Deployment

Visit `https://your-project.vercel.app/api/mcp/health` - you should see:

```json
{
  "status": "ok",
  "server": "coda-mcp",
  "version": "1.5.1"
}
```

## Local Development

**Requirements:** Node.js 24+ (use `nvm use` to switch)

```bash
# Install dependencies
yarn install

# Create .env file with your API key
cp .env.example .env
# Edit .env and add your Coda API key

# Build stdio version (for Claude Desktop)
yarn build

# Test HTTP server locally (for Claude.ai web)
yarn build:http
yarn start:http
```

Local server runs at `http://localhost:3000`

## Architecture

### Directory Structure

```
coda-mcp/
├── src/
│   ├── index.ts       # Stdio server (Claude Desktop)
│   ├── http.ts        # HTTP/SSE server (standalone)
│   ├── server.ts      # Core MCP server logic
│   └── client/        # Auto-generated Coda API client
│
├── api/
│   └── mcp.ts         # Vercel serverless function
│
└── dist/              # Compiled output (gitignored)
```

### Why `api/` is Separate

Vercel convention: files in `api/` automatically become serverless endpoints. `api/mcp.ts` is compiled by Vercel during deployment (not locally), creating the `/api/mcp` endpoint.

### Three Entry Points

| File | Transport | Use Case |
|------|-----------|----------|
| `src/index.ts` | stdio | Claude Desktop spawns as child process |
| `src/http.ts` | HTTP/SSE | Standalone Node.js server |
| `api/mcp.ts` | HTTP/SSE | Vercel serverless function |

All three share the same core logic in `src/server.ts`.

## Troubleshooting

### API Key Issues
- Verify `API_KEY` is set in Vercel environment variables
- Test your key at https://coda.io/apis/v1/docs

### Connection Issues
- Check health endpoint: `https://your-project.vercel.app/api/mcp/health`
- Verify URL in Claude.ai settings is correct
- Check Vercel logs in dashboard for errors

## License

MIT

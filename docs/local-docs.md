# Local MCP Knowledge Base

## MCP Server

This project contains a local Model Context Protocol server for a VS Code agent.
The server uses stdio transport, registers custom tools, and returns structured
JSON results.

## Tools

The server exposes three demonstration tools:

- `doc_lookup`: searches this local documentation file.
- `project_search`: searches files inside the project directory only.
- `safe_command`: runs a small whitelist of safe project commands.

## VS Code Integration

The `.vscode/mcp.json` file registers the server as `hw5-local-mcp`.
After installing dependencies and building the project, VS Code can start the
server with `node dist/index.js` and call its tools from agent chat.

## Security Notes

The project search tool keeps file access inside the workspace root. The command
tool does not execute arbitrary shell input and only runs commands defined in an
internal allowlist.

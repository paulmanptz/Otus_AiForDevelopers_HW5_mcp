# HW5 MCP Server

Учебный MCP-сервер на Node.js/TypeScript для подключения к агенту в VS Code.
Сервер работает через стандартный `stdio` transport и объявляет кастомные tools,
которые возвращают структурированные JSON-результаты.

## Что реализовано

- MCP endpoint через `StdioServerTransport`.
- Конфиг интеграции с VS Code: `.vscode/mcp.json`.
- 3 custom tools:
  - `doc_lookup` - поиск по локальной markdown-документации.
  - `project_search` - поиск по файлам проекта в пределах workspace.
  - `safe_command` - запуск только whitelisted dev-команд.

## Установка и сборка

```powershell
npm install
npm run build
```

После сборки сервер запускается командой:

```powershell
npm start
```

Обычно вручную запускать сервер не нужно: VS Code стартует его сам по конфигу
`.vscode/mcp.json`.

## VS Code MCP config

Файл `.vscode/mcp.json` регистрирует сервер `hw5-local-mcp`:

```json
{
  "servers": {
    "hw5-local-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"],
      "env": {
        "MCP_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

Если агент не видит tools сразу, перезапусти VS Code или выполни команду
обновления MCP-серверов в своем MCP-клиенте/расширении.

## Примеры запросов в IDE chat

Попроси агента явно использовать tools:

```text
Use the hw5-local-mcp doc_lookup tool to find information about VS Code integration.
```

```text
Use the hw5-local-mcp project_search tool to find where safe_command is implemented.
```

```text
Use the hw5-local-mcp safe_command tool to run npm run build.
```

## Tool schemas

### doc_lookup

Input:

```json
{
  "query": "MCP server",
  "section": "Tools"
}
```

Output:

```json
{
  "tool": "doc_lookup",
  "query": "MCP server",
  "section": "Tools",
  "count": 1,
  "matches": [
    {
      "heading": "Tools",
      "score": 1,
      "summary": "...",
      "source": "docs/local-docs.md"
    }
  ]
}
```

### project_search

Input:

```json
{
  "query": "registerTool",
  "fileGlob": "**/*.ts",
  "maxResults": 10
}
```

Output:

```json
{
  "tool": "project_search",
  "query": "registerTool",
  "fileGlob": "**/*.ts",
  "maxResults": 10,
  "count": 3,
  "root": "c:/path/to/project",
  "hits": [
    {
      "file": "src/index.ts",
      "line": 20,
      "preview": "server.registerTool(...)"
    }
  ]
}
```

### safe_command

Input:

```json
{
  "command": "npm run build"
}
```

Allowed commands:

- `npm run build`
- `npm run lint`
- `npm test`

Output:

```json
{
  "tool": "safe_command",
  "command": "npm run build",
  "exitCode": 0,
  "stdout": "...",
  "stderr": "",
  "durationMs": 1200,
  "allowedCommands": ["npm run build", "npm run lint", "npm test"]
}
```

## Security limits

- File search ignores `.git`, `.cursor`, `node_modules` and `dist`.
- File access is checked against `MCP_PROJECT_ROOT`.
- `safe_command` does not execute arbitrary user-provided shell strings.
- Command output is truncated to avoid returning overly large responses.

## Verification

```powershell
npm run build
npm run lint
```

For IDE verification, open the agent chat and ask it to call one of the
`hw5-local-mcp` tools. A successful call should return JSON-like structured
data from the MCP server.

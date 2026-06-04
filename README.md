# HW5 MCP Server

Учебный MCP-сервер на Node.js/TypeScript для подключения к агенту в VS Code.
Сервер работает через стандартный транспорт `stdio` и объявляет кастомные инструменты,
которые возвращают структурированные JSON-результаты.

## Что реализовано

- MCP-эндпоинт через `StdioServerTransport`.
- Конфиг интеграции с VS Code: `.vscode/mcp.json`.
- 3 кастомных инструмента:
  - `doc_lookup` - поиск по локальной markdown-документации.
  - `project_search` - поиск по файлам проекта в пределах рабочей папки.
  - `safe_command` - запуск только разрешенных dev-команд из whitelist.

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

## Конфиг MCP для VS Code

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

Если агент не видит инструменты сразу, перезапусти VS Code или выполни команду
обновления MCP-серверов в своем MCP-клиенте/расширении.

## Примеры запросов в IDE chat

Попроси агента явно использовать инструменты:

```text
Используй инструмент hw5-local-mcp doc_lookup, чтобы найти информацию об интеграции с VS Code.
```

```text
Используй инструмент hw5-local-mcp project_search, чтобы найти, где реализован safe_command.
```

```text
Используй инструмент hw5-local-mcp safe_command, чтобы выполнить npm run build.
```

## Схемы инструментов

### doc_lookup

Назначение: ищет по локальному markdown-файлу `docs/local-docs.md` и возвращает найденные разделы, краткую выжимку и путь к источнику.

Входные параметры:

```json
{
  "query": "MCP server",
  "section": "Tools"
}
```

Результат:

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

Назначение: ищет текстовые совпадения внутри файлов проекта, не выходя за пределы рабочей папки.

Входные параметры:

```json
{
  "query": "registerTool",
  "fileGlob": "**/*.ts",
  "maxResults": 10
}
```

Результат:

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

Назначение: запускает только заранее разрешенные команды разработки и возвращает код завершения, stdout, stderr и время выполнения.

Входные параметры:

```json
{
  "command": "npm run build"
}
```

Разрешенные команды:

- `npm run build`
- `npm run lint`
- `npm test`

Результат:

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

## Ограничения безопасности

- Поиск по файлам игнорирует `.git`, `.cursor`, `node_modules` и `dist`.
- Доступ к файлам проверяется относительно `MCP_PROJECT_ROOT`.
- `safe_command` не выполняет произвольные shell-строки от пользователя.
- Вывод команды обрезается, чтобы не возвращать слишком большие ответы.

## Проверка

```powershell
npm run build
npm run lint
```

Для проверки в IDE открой чат агента и попроси его вызвать один из инструментов
`hw5-local-mcp`. Успешный вызов должен вернуть структурированные JSON-данные от
MCP-сервера.

# System Patterns

## Общая архитектура

Проект построен как компактный MCP stdio-сервер. Весь runtime находится в `src/index.ts`:

- создаётся `McpServer`;
- регистрируются tools через `server.registerTool`;
- запускается `StdioServerTransport`;
- сервер подключается через `server.connect(transport)`.

Отдельных слоёв приложения, DI-контейнера, роутинга или модульной структуры пока нет.

## Формат ответов tools

Все tools возвращают результат через helper `jsonResult(payload)`.

Паттерн ответа:

- `content` содержит pretty-printed JSON как текст;
- `structuredContent` содержит тот же объект как структурированные данные.

Это удобно для агента: ответ читаем в чате и одновременно доступен как машинно-обрабатываемый объект.

## Tool: doc_lookup

`doc_lookup` читает `docs/local-docs.md`, разбивает markdown на секции по заголовкам `#`-`######`, ищет query по заголовку и содержимому, опционально фильтрует по heading через `section`.

Особенности:

- поиск case-insensitive;
- максимум 5 совпадений;
- summary ограничен 350 символами;
- source всегда указывает на `docs/local-docs.md`.

## Tool: project_search

`project_search` рекурсивно обходит файлы внутри `PROJECT_ROOT`, пропуская директории:

- `.git`
- `.cursor`
- `node_modules`
- `dist`

Для каждого текстового файла выполняется построчный case-insensitive поиск. В результате возвращаются `file`, `line`, `preview`.

Ограничения:

- glob реализован упрощённой функцией `globToRegExp`;
- поиск читает файлы напрямую через Node.js, без ripgrep или индекса;
- бинарные файлы пропускаются по наличию нулевого байта.

## Tool: safe_command

`safe_command` принимает только enum из трёх команд:

- `npm run build`
- `npm run lint`
- `npm test`

Команды запускаются через `spawn` с `shell: false` и `cwd: PROJECT_ROOT`. На Windows используется `npm.cmd`, на других платформах - `npm`.

Вывод stdout/stderr обрезается до `MAX_OUTPUT_CHARS = 12000`.

## Защитные инварианты

- Все файловые операции должны оставаться внутри `PROJECT_ROOT`.
- Для проверки используется `assertInsideProject`.
- MCP tool для команд не должен выполнять произвольный shell input.
- `dist/` считается generated output и не является источником правды.

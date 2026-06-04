# Progress

## Готово

- Настроен Node.js/TypeScript проект с ESM.
- Реализован MCP-сервер `hw5-local-mcp`.
- Подключён `StdioServerTransport`.
- Зарегистрированы tools `doc_lookup`, `project_search`, `safe_command`.
- Добавлена VS Code/Cursor MCP-конфигурация в `.vscode/mcp.json`.
- Добавлена локальная документация `docs/local-docs.md`.
- README описывает установку, запуск, tool schemas, security limits и verification.
- Создан memory bank для восстановления контекста проекта.

## Частично готово

- `npm test` существует, но тестовые файлы отсутствуют.
- `safe_command` ограничивает список команд, но не ограничивает время выполнения.
- `project_search` ограничен корнем проекта, но ignore-list минимальный.
- `doc_lookup` работает только с одним заранее заданным markdown-файлом.

## Не сделано

- Нет CI.
- Нет unit/integration tests.
- Нет автоматической проверки MCP tool calls.
- Нет модульного разделения tools/helpers.
- Нет Cursor rules или `AGENTS.md` с постоянными инструкциями для агента.

## Проверка проекта

Рекомендуемые команды перед сдачей или дальнейшей разработкой:

```powershell
npm run build
npm run lint
npm test
```

Для IDE-проверки нужно попросить агента вызвать один из tools сервера `hw5-local-mcp` и убедиться, что возвращается структурированный JSON.

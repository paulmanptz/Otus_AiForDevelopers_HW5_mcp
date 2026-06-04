# Tech Context

## Стек

- Runtime: Node.js.
- Язык: TypeScript.
- Module system: ESM, `"type": "module"`.
- TypeScript config: `module` и `moduleResolution` = `NodeNext`, `target` = `ES2022`, `strict` = `true`.
- MCP SDK: `@modelcontextprotocol/sdk`.
- Валидация входных параметров tools: `zod`.
- Dev runner: `tsx`.

## npm scripts

- `npm run build` - компилирует `src/**/*.ts` в `dist/` через `tsc`.
- `npm start` - запускает `node dist/index.js`.
- `npm run dev` - запускает `tsx src/index.ts`.
- `npm run lint` - выполняет `tsc --noEmit`.
- `npm test` - выполняет `node --test`; на текущий момент тестовых файлов в проекте нет.

## Runtime config

Основной конфиг интеграции с IDE находится в `.vscode/mcp.json`.

Сервер регистрируется как `hw5-local-mcp` и запускается командой:

```powershell
node ${workspaceFolder}/dist/index.js
```

Переменная окружения:

- `MCP_PROJECT_ROOT` - корень workspace. Если переменная не задана, сервер использует `process.cwd()`.

## Важные пути

- `src/index.ts` - единственный исходный файл с реализацией сервера и tools.
- `dist/index.js` - скомпилированная точка входа для IDE.
- `docs/local-docs.md` - локальная база знаний для `doc_lookup`.
- `.vscode/mcp.json` - регистрация MCP-сервера.
- `README.md` - пользовательская документация и примеры tool schemas.

## Зависимости

В `package.json` зависимости указаны как `latest`:

- `@modelcontextprotocol/sdk`
- `zod`
- `@types/node`
- `tsx`
- `typescript`

Фактические версии фиксируются через `package-lock.json`, но при изменении lockfile или повторной установке без него возможны несовместимости с будущими версиями SDK.

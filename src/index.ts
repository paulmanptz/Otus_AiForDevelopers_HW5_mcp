import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { z } from "zod";

const PROJECT_ROOT = path.resolve(process.env.MCP_PROJECT_ROOT ?? process.cwd());
const DOCS_FILE = path.join(PROJECT_ROOT, "docs", "local-docs.md");
const MAX_OUTPUT_CHARS = 12_000;
const IGNORED_DIRS = new Set([".git", ".cursor", "node_modules", "dist"]);
const SENSITIVE_KEY_PATTERN = /(api[_-]?key|auth|credential|password|secret|token)/i;

type JsonObject = Record<string, unknown>;

type DocSection = {
  heading: string;
  level: number;
  content: string;
};

type SearchHit = {
  file: string;
  line: number;
  preview: string;
};

const server = new McpServer({
  name: "hw5-local-mcp",
  version: "1.0.0"
});

server.registerTool(
  "doc_lookup",
  {
    title: "Поиск по локальной документации",
    description:
      "Ищет по подготовленной локальной markdown-документации и возвращает найденные разделы с краткими выжимками.",
    inputSchema: {
      query: z.string().min(1).describe("Поисковый запрос, например: MCP server, tools, VS Code."),
      section: z.string().optional().describe("Необязательный фильтр по заголовку, например: Tools.")
    }
  },
  async ({ query, section }) => {
    return withToolLogging("doc_lookup", { query, section: section ?? null }, async () => {
      const sections = parseMarkdownSections(await fs.readFile(DOCS_FILE, "utf8"));
      const normalizedQuery = query.toLowerCase();
      const normalizedSection = section?.toLowerCase();

      const matches = sections
        .map((item) => {
          const searchableText = `${item.heading}\n${item.content}`.toLowerCase();
          const sectionMatches = normalizedSection
            ? item.heading.toLowerCase().includes(normalizedSection)
            : true;
          const queryMatches = searchableText.includes(normalizedQuery);

          return {
            item,
            score: Number(queryMatches) + Number(item.heading.toLowerCase().includes(normalizedQuery)),
            sectionMatches
          };
        })
        .filter((result) => result.sectionMatches && result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(({ item, score }) => ({
          heading: item.heading,
          score,
          summary: summarize(item.content),
          source: relativeToRoot(DOCS_FILE)
        }));

      return jsonResult({
        tool: "doc_lookup",
        query,
        section: section ?? null,
        count: matches.length,
        matches
      });
    });
  }
);

server.registerTool(
  "project_search",
  {
    title: "Поиск по файлам проекта",
    description:
      "Ищет по текстовым файлам только внутри директории проекта и возвращает файл, строку и фрагмент найденного текста.",
    inputSchema: {
      query: z.string().min(1).describe("Текст для поиска внутри файлов проекта."),
      fileGlob: z
        .string()
        .default("**/*")
        .describe("Простой glob-фильтр, например: **/*.ts, **/*.md, package.json."),
      maxResults: z.number().int().min(1).max(50).default(20).describe("Максимальное количество совпадений.")
    }
  },
  async ({ query, fileGlob, maxResults }) => {
    return withToolLogging("project_search", { query, fileGlob, maxResults }, async () => {
      const files = await collectProjectFiles(PROJECT_ROOT);
      const matcher = globToRegExp(fileGlob);
      const hits: SearchHit[] = [];
      const normalizedQuery = query.toLowerCase();

      for (const file of files) {
        const relativeFile = relativeToRoot(file);
        if (!matcher.test(toPosixPath(relativeFile))) {
          continue;
        }

        const content = await safeReadTextFile(file);
        if (content === null) {
          continue;
        }

        const lines = content.split(/\r?\n/);
        for (const [index, line] of lines.entries()) {
          if (line.toLowerCase().includes(normalizedQuery)) {
            hits.push({
              file: relativeFile,
              line: index + 1,
              preview: line.trim().slice(0, 300)
            });
          }

          if (hits.length >= maxResults) {
            break;
          }
        }

        if (hits.length >= maxResults) {
          break;
        }
      }

      return jsonResult({
        tool: "project_search",
        query,
        fileGlob,
        maxResults,
        count: hits.length,
        root: PROJECT_ROOT,
        hits
      });
    });
  }
);

server.registerTool(
  "safe_command",
  {
    title: "Запуск безопасной команды проекта",
    description:
      "Запускает разрешенную команду разработки из whitelist и возвращает код завершения, stdout, stderr и длительность выполнения.",
    inputSchema: {
      command: z
        .enum(["npm run build", "npm run lint", "npm test"])
        .describe("Разрешенная команда для выполнения.")
    }
  },
  async ({ command }) => {
    return withToolLogging("safe_command", { command }, async () => {
      const commandMap: Record<string, { executable: string; args: string[] }> = {
        "npm run build": { executable: npmExecutable(), args: ["run", "build"] },
        "npm run lint": { executable: npmExecutable(), args: ["run", "lint"] },
        "npm test": { executable: npmExecutable(), args: ["test"] }
      };

      const startTime = performance.now();
      const result = await runAllowedCommand(commandMap[command]);

      return jsonResult({
        tool: "safe_command",
        command,
        exitCode: result.exitCode,
        stdout: truncate(result.stdout),
        stderr: truncate(result.stderr),
        durationMs: Math.round(performance.now() - startTime),
        allowedCommands: Object.keys(commandMap)
      });
    });
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function jsonResult(payload: JsonObject) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload
  };
}

async function withToolLogging<T>(
  toolName: string,
  input: JsonObject,
  handler: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await handler();
    logToolCall({
      toolName,
      input,
      status: "success",
      durationMs: Math.round(performance.now() - startTime)
    });
    return result;
  } catch (error) {
    logToolCall({
      toolName,
      input,
      status: "error",
      durationMs: Math.round(performance.now() - startTime),
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

function logToolCall(event: {
  toolName: string;
  input: JsonObject;
  status: "success" | "error";
  durationMs: number;
  error?: string;
}): void {
  console.error(
    JSON.stringify({
      event: "mcp_tool_call",
      toolName: event.toolName,
      input: redactSecrets(event.input),
      status: event.status,
      durationMs: event.durationMs,
      ...(event.error ? { error: event.error } : {})
    })
  );
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSecrets(nestedValue)
      ])
    );
  }

  return value;
}

function parseMarkdownSections(markdown: string): DocSection[] {
  const sections: DocSection[] = [];
  let current: DocSection | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      if (current) {
        current.content = current.content.trim();
        sections.push(current);
      }

      current = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        content: ""
      };
      continue;
    }

    if (current) {
      current.content += `${line}\n`;
    }
  }

  if (current) {
    current.content = current.content.trim();
    sections.push(current);
  }

  return sections;
}

function summarize(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 350 ? `${compact.slice(0, 347)}...` : compact;
}

async function collectProjectFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    assertInsideProject(absolutePath);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...(await collectProjectFiles(absolutePath)));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function safeReadTextFile(filePath: string): Promise<string | null> {
  assertInsideProject(filePath);

  const buffer = await fs.readFile(filePath);
  if (buffer.includes(0)) {
    return null;
  }

  return buffer.toString("utf8");
}

function assertInsideProject(targetPath: string): void {
  const resolvedTarget = path.resolve(targetPath);
  const relativePath = path.relative(PROJECT_ROOT, resolvedTarget);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Access outside project root is not allowed: ${targetPath}`);
  }
}

function relativeToRoot(filePath: string): string {
  return toPosixPath(path.relative(PROJECT_ROOT, filePath));
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function globToRegExp(pattern: string): RegExp {
  const normalizedPattern = toPosixPath(pattern);
  let source = "";

  for (let index = 0; index < normalizedPattern.length; index += 1) {
    const char = normalizedPattern[index];
    const next = normalizedPattern[index + 1];
    const afterNext = normalizedPattern[index + 2];

    if (char === "*" && next === "*" && afterNext === "/") {
      source += "(?:.*/)?";
      index += 2;
      continue;
    }

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    source += escapeRegExp(char);
  }

  return new RegExp(`^${source}$`, "i");
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function npmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runAllowedCommand(command: { executable: string; args: string[] }): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(command.executable, command.args, {
      cwd: PROJECT_ROOT,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });

    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

function truncate(value: string): string {
  return value.length > MAX_OUTPUT_CHARS ? `${value.slice(0, MAX_OUTPUT_CHARS)}...` : value;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});

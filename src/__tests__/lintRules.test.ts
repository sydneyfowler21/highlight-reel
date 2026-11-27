import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from '@jest/globals';

const repoRoot = join(__dirname, '..', '..');

type LintResult = {
  errorCount: number;
  ruleIds: Array<string | null>;
};

function lintAll(cases: { filePath: string; code: string }[]): LintResult[] {
  const script = `
    import { ESLint } from 'eslint';
    const cases = JSON.parse(process.env.LINT_CASES);
    const eslint = new ESLint({
      cwd: process.env.REPO_ROOT,
      overrideConfig: {
        languageOptions: {
          parserOptions: {
            projectService: {
              allowDefaultProject: JSON.parse(process.env.LINT_CASE_PATHS),
            },
          },
        },
      },
    });
    const results = [];
    for (const item of cases) {
      const [result] = await eslint.lintText(item.code, { filePath: item.filePath });
      results.push({
        errorCount: result.errorCount,
        ruleIds: result.messages.map((message) => message.ruleId),
      });
    }
    process.stdout.write(JSON.stringify(results));
  `;
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        REPO_ROOT: repoRoot,
        LINT_CASES: JSON.stringify(cases),
        LINT_CASE_PATHS: JSON.stringify([
          ...new Set(cases.map((item) => relative(repoRoot, item.filePath))),
        ]),
      },
    },
  );
  if (child.status !== 0) {
    throw new Error(child.stderr || child.stdout);
  }
  return JSON.parse(child.stdout) as LintResult[];
}

const blocked = [
  {
    source: './db/client',
    code: "import { createDb } from './db/client';\nexport const value = createDb;\n",
  },
  {
    source: './api/app',
    code: "import { createApp } from './api/app';\nexport const value = createApp;\n",
  },
  {
    source: 'hono',
    code: "import { Hono } from 'hono';\nexport const value = Hono;\n",
  },
  {
    source: '@hono/node-server',
    code: "import { serve } from '@hono/node-server';\nexport const value = serve;\n",
  },
  {
    source: 'drizzle-orm',
    code: "import { sql } from 'drizzle-orm';\nexport const value = sql;\n",
  },
  {
    source: 'better-sqlite3',
    code: "import Database from 'better-sqlite3';\nexport const value = Database;\n",
  },
  {
    source: '@hono/node-server/serve-static',
    code: "import { serveStatic } from '@hono/node-server/serve-static';\nexport const value = serveStatic;\n",
  },
  {
    source: 'hono/cors',
    code: "import { cors } from 'hono/cors';\nexport const value = cors;\n",
  },
  {
    source: './db/schema',
    code: "import { recordings } from './db/schema';\nexport const value = recordings;\n",
  },
];

describe('library import boundary', () => {
  let blockedResults: LintResult[] = [];
  let allowedResult: LintResult | undefined;

  beforeAll(() => {
    const results = lintAll([
      ...blocked.map((item) => ({
        filePath: join(repoRoot, 'src/example.ts'),
        code: item.code,
      })),
      {
        filePath: join(repoRoot, 'src/db/example.ts'),
        code: "import Database from 'better-sqlite3';\nimport { sql } from 'drizzle-orm';\nexport const value = { Database, sql };\n",
      },
    ]);
    blockedResults = results.slice(0, blocked.length);
    allowedResult = results[blocked.length];
  });

  it.each(blocked)('rejects $source in a top-level library file', (item) => {
    const result = blockedResults[blocked.indexOf(item)];
    expect(result?.errorCount).toBeGreaterThan(0);
    expect(result?.ruleIds).toContain('no-restricted-imports');
  });

  it('allows database code to import better-sqlite3 and drizzle-orm', () => {
    expect(allowedResult?.errorCount).toBe(0);
    expect(allowedResult?.ruleIds).not.toContain('no-restricted-imports');
  });
});

const statusType = "type Status = 'pending' | 'approved';\n";

describe('switch exhaustiveness', () => {
  let results: LintResult[] = [];

  beforeAll(() => {
    results = lintAll(
      [
        "export function label(status: Status): string {\n  switch (status) {\n    case 'pending':\n      return 'to review';\n  }\n  return 'unknown';\n}\n",
        "export function label(status: Status): string {\n  switch (status) {\n    case 'pending':\n      return 'to review';\n    default:\n      return 'done';\n  }\n}\n",
        "export function label(status: Status): string {\n  switch (status) {\n    case 'pending':\n      return 'to review';\n    case 'approved':\n      return 'done';\n  }\n}\n",
      ].map((body) => ({
        filePath: join(repoRoot, 'src/switchExample.ts'),
        code: statusType + body,
      })),
    );
  });

  it('rejects a switch over a union that leaves out a case', () => {
    expect(results[0]?.ruleIds).toContain(
      '@typescript-eslint/switch-exhaustiveness-check',
    );
  });

  it('rejects a switch that hides a missing case behind default', () => {
    expect(results[1]?.ruleIds).toContain(
      '@typescript-eslint/switch-exhaustiveness-check',
    );
  });

  it('allows a switch that handles every case', () => {
    expect(results[2]?.errorCount).toBe(0);
  });
});

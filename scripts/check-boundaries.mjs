#!/usr/bin/env node
/**
 * Enforces the ADR-0001 / ADR-0002 rules that Biome's rule set can't express
 * natively (as of Biome 1.9 there is no generic "ban type assertions" or
 * "ban class outside this folder" rule — ESLint has `no-restricted-syntax`
 * for this; Biome does not have an equivalent yet). This is a deliberately
 * small, dependency-free stand-in, run via lefthook and CI.
 *
 * Checks:
 *  1. No `as X` type assertions anywhere except `as const`.
 *  2. No `class` keyword outside a package's `src/internal/` directory.
 *  3. No package importing another package's `src/` directly.
 *  4. No `@opentelemetry/*` import outside packages/opentelemetry/src/.
 *
 * This is text-matching, not AST analysis — it will have rare false
 * positives (e.g. "class" inside a string literal or comment). Accepted
 * trade-off for a zero-dependency script. Replace with a ts-morph-based
 * checker if that becomes a real problem.
 *
 * Import statements are handled as whole spans (not line-by-line) because
 * Biome may wrap a single import onto multiple lines, and continuation
 * lines like `context as otelContext,` would otherwise false-positive as
 * an `as` type assertion.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function findTsFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      findTsFiles(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

/**
 * Finds every `import ... from '...';` / `export ... from '...';`
 * statement (single- or multi-line), checks its module specifier against
 * our two import rules, and returns the content with each such statement
 * blanked out (newlines preserved) so later checks don't see inside it.
 */
function checkImportsAndStripThem(content, relPath) {
  const importStatementPattern = /(?:^|\n)[ \t]*(?:import|export)\b[^;]*?from\s+['"][^'"]+['"];?/g;
  let failed = false;
  let stripped = content;

  for (const match of content.matchAll(importStatementPattern)) {
    const statement = match[0];
    const specifierMatch = statement.match(/from\s+['"]([^'"]+)['"]/);
    const specifier = specifierMatch ? specifierMatch[1] : undefined;
    const lineNo = lineNumberAt(content, match.index) + (statement.startsWith('\n') ? 1 : 0);

    if (specifier?.includes('/src/') && specifier.startsWith('@youssoufcherif/')) {
      console.error(
        `${relPath}:${lineNo}: import "${specifier}" reaches into another package's src/ (ADR-0002)`,
      );
      failed = true;
    }

    if (
      specifier?.startsWith('@opentelemetry/') &&
      !relPath.startsWith('packages/opentelemetry/src/')
    ) {
      console.error(
        `${relPath}:${lineNo}: only packages/opentelemetry/src/ may import "${specifier}" (ADR-0001/0002)`,
      );
      failed = true;
    }

    // Blank out the statement (preserving line breaks) so the as/class
    // scans below never see import-rename syntax like `x as y`.
    const blanked = statement.replace(/[^\n]/g, ' ');
    stripped =
      stripped.slice(0, match.index) + blanked + stripped.slice(match.index + statement.length);
  }

  return { stripped, failed };
}

const files = findTsFiles(join(ROOT, 'packages'));
let anyFailed = false;

for (const file of files) {
  const relPath = relative(ROOT, file);
  const content = readFileSync(file, 'utf8');

  const { stripped, failed: importsFailed } = checkImportsAndStripThem(content, relPath);
  if (importsFailed) anyFailed = true;

  const lines = stripped.split('\n');
  lines.forEach((line, i) => {
    const lineNo = i + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    const asMatch = line.match(/\bas\s+([A-Za-z_][A-Za-z0-9_<>[\].]*)/);
    if (asMatch && asMatch[1] !== 'const') {
      console.error(`${relPath}:${lineNo}: forbidden type assertion "as ${asMatch[1]}" (ADR-0001)`);
      anyFailed = true;
    }

    if (/\bclass\s+[A-Za-z_]/.test(line) && !relPath.includes(`src${'/'}internal${'/'}`)) {
      console.error(
        `${relPath}:${lineNo}: "class" is only allowed inside src/internal/ (ADR-0001/0002)`,
      );
      anyFailed = true;
    }
  });
}

if (anyFailed) {
  console.error('\nBoundary check failed. See docs/adr/0001 and 0002.');
  process.exit(1);
}
console.log(`Boundary check passed (${files.length} files).`);

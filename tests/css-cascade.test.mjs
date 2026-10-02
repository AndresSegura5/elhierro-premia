import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appDirectory = path.resolve('app');

function cssFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return cssFiles(filePath);
    return entry.isFile() && entry.name.endsWith('.css') ? [filePath] : [];
  });
}

test('application CSS does not use !important', () => {
  for (const filePath of cssFiles(appDirectory)) {
    assert.doesNotMatch(readFileSync(filePath, 'utf8'), /!\s*important\b/i, filePath);
  }
});

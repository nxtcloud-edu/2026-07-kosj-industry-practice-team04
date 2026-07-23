import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(testDirectory, '..', 'frontend-hosting.yml');

function extractFunctionCode(template) {
  const lines = template.split(/\r?\n/);
  const functionCodeIndex = lines.findIndex((line) => /^\s*FunctionCode:\s*\|\s*$/.test(line));

  assert.notEqual(functionCodeIndex, -1, 'CloudFront FunctionCode block must exist');

  const parentIndentation = lines[functionCodeIndex].match(/^\s*/)[0].length;
  const codeLines = [];

  for (let index = functionCodeIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const indentation = line.match(/^\s*/)[0].length;

    if (line.trim() && indentation <= parentIndentation) {
      break;
    }

    codeLines.push(line.slice(parentIndentation + 2));
  }

  return codeLines.join('\n').trim();
}

const template = await readFile(templatePath, 'utf8');
const functionCode = extractFunctionCode(template);
const invoke = new Function('event', `${functionCode}\nreturn handler(event);`);

function request(method, uri) {
  return { method, uri };
}

test('rewrites extensionless GET SPA routes to index.html', () => {
  for (const uri of ['/', '/admin', '/admin/', '/status/TEST', '/apiary']) {
    assert.equal(invoke({ request: request('GET', uri) }).uri, '/index.html', uri);
  }
});

test('rewrites extensionless HEAD SPA routes to index.html', () => {
  assert.equal(invoke({ request: request('HEAD', '/admin') }).uri, '/index.html');
});

test('preserves API, upload, and asset prefixes without matching lookalikes', () => {
  for (const uri of [
    '/api',
    '/api/reports',
    '/uploads',
    '/uploads/photo.jpg',
    '/assets',
    '/assets/app-123.js',
  ]) {
    assert.equal(invoke({ request: request('GET', uri) }).uri, uri, uri);
  }
});

test('preserves requests for files and non-GET/HEAD methods', () => {
  for (const uri of ['/favicon.ico', '/assets/styles.css', '/nested/file.json']) {
    assert.equal(invoke({ request: request('GET', uri) }).uri, uri, uri);
  }

  assert.equal(invoke({ request: request('POST', '/admin') }).uri, '/admin');
  assert.equal(invoke({ request: request('OPTIONS', '/status/TEST') }).uri, '/status/TEST');
});

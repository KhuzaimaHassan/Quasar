import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { downloadDocument, type DocumentDownloadDependencies } from '@/lib/document-download';
import { CitationChip } from '@/components/chat/CitationChip';

function fixture(overrides: Partial<DocumentDownloadDependencies> = {}) {
  const signed: { path: string; filename: string }[] = [];
  const dependencies: DocumentDownloadDependencies = {
    authenticate: async () => 'qa-clerk',
    findUser: async () => ({ id: 'qa-user' }),
    findDocument: async () => ({ filename: 'QA brief.pdf', storagePath: 'qa/private.pdf', workspace: { userId: 'qa-user' } }),
    signDownload: async (path, filename) => {
      signed.push({ path, filename });
      return `https://storage.example.invalid/qa.pdf?token=synthetic-${signed.length}`;
    },
    ...overrides,
  };
  return { dependencies, signed };
}

test('old and new citation chips use document identity instead of persisted expired URLs', () => {
  const markup = renderToStaticMarkup(createElement(CitationChip, {
    documentId: 'qa-doc/with space', filename: 'QA brief.pdf', url: 'https://storage.example.invalid/expired?token=old',
  }));
  assert.match(markup, /href="\/api\/documents\/qa-doc%2Fwith%20space\/download"/);
  assert.doesNotMatch(markup, /expired|token=old/);
  assert.match(markup, /Download source: QA brief.pdf/);
});

test('every authorized click receives a newly signed download and is never cached', async () => {
  const { dependencies, signed } = fixture();
  const first = await downloadDocument('qa-doc', dependencies);
  const second = await downloadDocument('qa-doc', dependencies);
  assert.equal(first.status, 302);
  assert.notEqual(first.headers.get('Location'), second.headers.get('Location'));
  assert.match(first.headers.get('Cache-Control')!, /private.*no-store/);
  assert.equal(first.headers.get('Vary'), 'Cookie, Authorization');
  assert.deepEqual(signed, Array(2).fill({ path: 'qa/private.pdf', filename: 'QA brief.pdf' }));
});

test('unauthenticated requests do not query or sign a document', async () => {
  const { dependencies, signed } = fixture({
    authenticate: async () => null,
    findUser: async () => { throw new Error('Must not query'); },
    findDocument: async () => { throw new Error('Must not query'); },
  });
  const result = await downloadDocument('qa-doc', dependencies);
  assert.equal(result.status, 401); assert.deepEqual(signed, []);
  assert.equal(result.headers.get('Location'), null);
});

for (const scenario of ['missing user', 'deleted document', 'foreign workspace'] as const) {
  test(`${scenario} receives the same 404 and no storage capability`, async () => {
    const { dependencies, signed } = fixture({
      ...(scenario === 'missing user' ? { findUser: async () => null } : {}),
      ...(scenario === 'deleted document' ? { findDocument: async () => null } : {}),
      ...(scenario === 'foreign workspace' ? { findDocument: async () => ({ filename: 'Private.pdf', storagePath: 'private/secret.pdf', workspace: { userId: 'other-user' } }) } : {}),
    });
    const result = await downloadDocument('qa-doc', dependencies);
    assert.equal(result.status, 404);
    assert.deepEqual(await result.json(), { message: 'Document not found', statusCode: 404 });
    assert.equal(result.headers.get('Location'), null); assert.deepEqual(signed, []);
  });
}

test('storage failure produces a safe retryable error without leaking paths', async () => {
  for (const signDownload of [async () => null, async () => { throw new Error('qa/private/secret.pdf'); }]) {
    const { dependencies } = fixture({ signDownload });
    const result = await downloadDocument('qa-doc', dependencies);
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('Location'), null);
    assert.doesNotMatch(await result.text(), /private|secret/);
    assert.match(result.headers.get('Cache-Control')!, /no-store/);
  }
});

test('database failure does not expose diagnostics or attempt signing', async () => {
  const { dependencies, signed } = fixture({ findDocument: async () => { throw new Error('private database diagnostic'); } });
  const result = await downloadDocument('qa-doc', dependencies);
  assert.equal(result.status, 503); assert.deepEqual(signed, []);
  assert.doesNotMatch(await result.text(), /diagnostic/);
});

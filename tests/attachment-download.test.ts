import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { AttachmentChip } from '@/components/chat/AttachmentChip';
import { attachmentFilePath } from '@/lib/attachment-types';
import { downloadAttachment, findStoredAttachment, type AttachmentDownloadDependencies } from '@/lib/attachment-download';

const conversationId = '11111111-1111-4111-8111-111111111111';
const attachmentId = '22222222-2222-4222-8222-222222222222';
const serverId = '33333333-3333-4333-8333-333333333333';
const attachment = {
  id: attachmentId, filename: 'QA photo.png', mimeType: 'image/png', sizeBytes: 500,
  storagePath: `chat-attachments/${conversationId}/${serverId}-QA photo.png`,
  url: 'https://storage.example.invalid/expired?token=old',
};
function fixture(overrides: Partial<AttachmentDownloadDependencies> = {}) {
  const signed: string[] = [];
  const dependencies: AttachmentDownloadDependencies = {
    authenticate: async () => 'qa-clerk',
    findUser: async () => ({ id: 'qa-user' }),
    findConversation: async () => ({ userId: 'qa-user' }),
    findMessages: async () => [{ metadata: { attachments: [attachment] } }],
    signFile: async path => { signed.push(path); return `https://storage.example.invalid/fresh-${signed.length}`; },
    ...overrides,
  };
  return { dependencies, signed };
}

test('saved PDF attachments ignore expired URLs and open the authenticated route', () => {
  const markup = renderToStaticMarkup(createElement(AttachmentChip, { ...attachment, conversationId, mimeType: 'application/pdf', filename: 'QA.pdf' }));
  assert.ok(markup.includes(`href="${attachmentFilePath(conversationId, attachmentId)}"`));
  assert.doesNotMatch(markup, /expired|token=old/);
});
test('saved image previews and their open links use the same renewable route', () => {
  const markup = renderToStaticMarkup(createElement(AttachmentChip, { ...attachment, conversationId }));
  const path = attachmentFilePath(conversationId, attachmentId);
  assert.ok(markup.includes(`src="${path}"`)); assert.ok(markup.includes(`href="${path}"`));
  assert.doesNotMatch(markup, /expired|token=old/);
});
test('optimistic drafts keep their upload-time URL before message persistence', () => {
  const markup = renderToStaticMarkup(createElement(AttachmentChip, { ...attachment, url: 'https://storage.example.invalid/new-upload' }));
  assert.match(markup, /src="https:\/\/storage.example.invalid\/new-upload"/);
});
test('attachment URLs encode both identity segments', () => {
  assert.equal(attachmentFilePath('a/b', 'c?d'), '/api/conversations/a%2Fb/attachments/c%3Fd');
});
test('an old attachment receives a fresh private capability on each request', async () => {
  const { dependencies, signed } = fixture();
  const first = await downloadAttachment(conversationId, attachmentId, dependencies);
  const second = await downloadAttachment(conversationId, attachmentId, dependencies);
  assert.equal(first.status, 302); assert.equal(second.status, 302);
  assert.notEqual(first.headers.get('Location'), second.headers.get('Location'));
  assert.match(first.headers.get('Cache-Control')!, /private.*no-store/);
  assert.equal(first.headers.get('Vary'), 'Cookie, Authorization');
  assert.deepEqual(signed, [attachment.storagePath, attachment.storagePath]);
});
test('anonymous requests do not read metadata or sign anything', async () => {
  const { dependencies, signed } = fixture({
    authenticate: async () => null,
    findUser: async () => { throw new Error('Must not read'); },
    findMessages: async () => { throw new Error('Must not read'); },
  });
  assert.equal((await downloadAttachment(conversationId, attachmentId, dependencies)).status, 401);
  assert.deepEqual(signed, []);
});
for (const scenario of ['missing user', 'missing conversation', 'foreign conversation', 'missing attachment'] as const) {
  test(`${scenario} receives a non-revealing 404`, async () => {
    const { dependencies, signed } = fixture({
      ...(scenario === 'missing user' ? { findUser: async () => null } : {}),
      ...(scenario === 'missing conversation' ? { findConversation: async () => null } : {}),
      ...(scenario === 'foreign conversation' ? { findConversation: async () => ({ userId: 'other-user' }), findMessages: async () => { throw new Error('Must not read'); } } : {}),
      ...(scenario === 'missing attachment' ? { findMessages: async () => [] } : {}),
    });
    const result = await downloadAttachment(conversationId, attachmentId, dependencies);
    assert.equal(result.status, 404); assert.equal(result.headers.get('Location'), null);
    assert.deepEqual(await result.json(), { message: 'Attachment not found', statusCode: 404 });
    assert.deepEqual(signed, []);
  });
}
test('legacy client IDs may differ from the server storage UUID', () => {
  assert.equal(findStoredAttachment([{ metadata: { attachments: [attachment] } }], conversationId, attachmentId)?.storagePath, attachment.storagePath);
});
test('forged paths, malformed metadata and unsupported files never reach signing', async () => {
  const invalid = [
    null, { ...attachment, sizeBytes: '500' }, { ...attachment, mimeType: 'text/html' },
    { ...attachment, filename: '../QA photo.png' },
    { ...attachment, storagePath: `documents/private/${serverId}-QA photo.png` },
    { ...attachment, storagePath: `chat-attachments/${conversationId}-other/${serverId}-QA photo.png` },
    { ...attachment, storagePath: `chat-attachments/${conversationId}/nested/${serverId}-QA photo.png` },
    { ...attachment, storagePath: `chat-attachments/${conversationId}/${serverId}-other.png` },
    { ...attachment, storagePath: `chat-attachments/${conversationId}/%2e%2e%2f${serverId}-QA photo.png` },
  ];
  for (const value of invalid) {
    const { dependencies, signed } = fixture({ findMessages: async () => [{ metadata: { attachments: [value] } }] });
    assert.equal((await downloadAttachment(conversationId, attachmentId, dependencies)).status, 404);
    assert.deepEqual(signed, []);
  }
  for (const metadata of [null, [], 'bad', { attachments: {} }, { attachments: [null] }]) {
    assert.equal(findStoredAttachment([{ metadata }], conversationId, attachmentId), null);
  }
});
test('an attachment cannot be reused under another owned conversation', async () => {
  const { dependencies, signed } = fixture();
  assert.equal((await downloadAttachment('other-conversation', attachmentId, dependencies)).status, 404);
  assert.deepEqual(signed, []);
});
test('storage and database failures return safe retryable errors', async () => {
  for (const overrides of [
    { signFile: async () => null },
    { signFile: async () => { throw new Error('private storage diagnostic'); } },
    { findMessages: async () => { throw new Error('private database diagnostic'); } },
  ]) {
    const { dependencies } = fixture(overrides);
    const result = await downloadAttachment(conversationId, attachmentId, dependencies);
    assert.equal(result.status, 503); assert.equal(result.headers.get('Location'), null);
    assert.doesNotMatch(await result.text(), /private|diagnostic/);
    assert.match(result.headers.get('Cache-Control')!, /no-store/);
  }
});

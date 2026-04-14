import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionBackgroundHandler,
  validateSessionName
} from './sessionBackgroundRoute.js';

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };
}

test('validateSessionName rejects empty values', () => {
  const result = validateSessionName('   ');
  assert.equal(result.isValid, false);
});

test('validateSessionName accepts normal session names', () => {
  const result = validateSessionName("Gandalf's Tower");
  assert.equal(result.isValid, true);
  assert.equal(result.value, "Gandalf's Tower");
});

test('route returns 400 for invalid session names', async () => {
  const handler = createSessionBackgroundHandler({
    generateSessionBackground: async () => {
      throw new Error('should not be called');
    },
    mapErrorToStatus: () => 503
  });
  const res = createMockResponse();

  await handler({ body: { sessionName: '' } }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { message: 'sessionName is required' });
});

test('route returns image data for valid requests', async () => {
  const expectedBuffer = Buffer.from([1, 2, 3]);
  const handler = createSessionBackgroundHandler({
    generateSessionBackground: async () => ({
      buffer: expectedBuffer,
      mimeType: 'image/png'
    }),
    mapErrorToStatus: () => 503
  });
  const res = createMockResponse();

  await handler({ body: { sessionName: 'R2-D2 Base' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'image/png');
  assert.equal(res.body, expectedBuffer);
});

test('route maps service errors to HTTP response', async () => {
  const handler = createSessionBackgroundHandler({
    generateSessionBackground: async () => {
      throw new Error('Gemini unavailable');
    },
    mapErrorToStatus: () => 503
  });
  const res = createMockResponse();

  await handler({ body: { sessionName: 'Neo Retreat' } }, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { message: 'Failed to generate session background' });
});

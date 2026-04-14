import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  __setHuggingFaceClientFactoryForTests,
  __resetSessionBackgroundCacheForTests,
  deleteSessionBackground,
  ensureSessionBackground,
  generateSessionBackground,
  getSessionBackground
} from './geminiBackgroundService.js';

const originalFetch = global.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalHuggingFaceKey = process.env.HUGGING_FACE_API_KEY;
const originalCacheDir = process.env.SESSION_BACKGROUND_CACHE_DIR;
let tempCacheDir = null;

beforeEach(() => {
  __resetSessionBackgroundCacheForTests();
  delete process.env.GEMINI_API_KEY;
  delete process.env.HUGGING_FACE_API_KEY;
  delete process.env.SESSION_BACKGROUND_CACHE_DIR;
});

afterEach(async () => {
  global.fetch = originalFetch;
  __resetSessionBackgroundCacheForTests();

  if (originalGeminiKey) {
    process.env.GEMINI_API_KEY = originalGeminiKey;
  } else {
    delete process.env.GEMINI_API_KEY;
  }

  if (originalHuggingFaceKey) {
    process.env.HUGGING_FACE_API_KEY = originalHuggingFaceKey;
  } else {
    delete process.env.HUGGING_FACE_API_KEY;
  }

  if (originalCacheDir) {
    process.env.SESSION_BACKGROUND_CACHE_DIR = originalCacheDir;
  } else {
    delete process.env.SESSION_BACKGROUND_CACHE_DIR;
  }

  if (tempCacheDir) {
    await rm(tempCacheDir, { recursive: true, force: true });
    tempCacheDir = null;
  }
});

test('uses Hugging Face when Gemini returns quota error', async () => {
  process.env.GEMINI_API_KEY = 'gemini-key';
  process.env.HUGGING_FACE_API_KEY = 'hf-key';
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  let huggingFaceCalls = 0;
  __setHuggingFaceClientFactoryForTests(() => ({
    async textToImage(request) {
      huggingFaceCalls += 1;
      assert.equal(request.provider, 'auto');
      return {
        type: 'image/png',
        async arrayBuffer() {
          return Uint8Array.from([1, 2, 3, 4]).buffer;
        }
      };
    }
  }));

  global.fetch = async (url) => {
    if (String(url).includes('generativelanguage.googleapis.com')) {
      return {
        ok: false,
        status: 429,
        text: async () => '{"error":"RESOURCE_EXHAUSTED"}'
      };
    }

    throw new Error(`Unexpected URL in test: ${url}`);
  };

  const result = await generateSessionBackground(`quota-fallback-${Date.now()}`);
  assert.equal(result.mimeType, 'image/png');
  assert.deepEqual(Array.from(result.buffer), [1, 2, 3, 4]);
  assert.equal(huggingFaceCalls, 1);

});

test('supports Hugging Face-only configuration', async () => {
  process.env.HUGGING_FACE_API_KEY = 'hf-key';
  process.env.HUGGING_FACE_PROVIDER = 'fal-ai';
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  __setHuggingFaceClientFactoryForTests(() => ({
    async textToImage(request) {
      assert.equal(request.provider, 'fal-ai');
      return {
        type: 'image/jpeg',
        async arrayBuffer() {
          return Uint8Array.from([9, 8, 7]).buffer;
        }
      };
    }
  }));

  const result = await generateSessionBackground(`hf-only-${Date.now()}`);
  assert.equal(result.mimeType, 'image/jpeg');
  delete process.env.HUGGING_FACE_PROVIDER;

});

test('reads cached image from disk without additional provider calls', async () => {
  process.env.HUGGING_FACE_API_KEY = 'hf-key';
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  let providerCalls = 0;
  __setHuggingFaceClientFactoryForTests(() => ({
    async textToImage() {
      providerCalls += 1;
      return {
        type: 'image/png',
        async arrayBuffer() {
          return Uint8Array.from([5, 6, 7]).buffer;
        }
      };
    }
  }));

  const sessionId = `disk-hit-${Date.now()}`;
  await ensureSessionBackground(sessionId);
  assert.equal(providerCalls, 1);

  __resetSessionBackgroundCacheForTests();
  const cached = await getSessionBackground(sessionId);
  assert.ok(cached);
  assert.equal(cached.mimeType, 'image/png');
  assert.deepEqual(Array.from(cached.buffer), [5, 6, 7]);
  assert.equal(providerCalls, 1);

});

test('dedupes concurrent generation for the same session', async () => {
  process.env.HUGGING_FACE_API_KEY = 'hf-key';
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  let providerCalls = 0;
  __setHuggingFaceClientFactoryForTests(() => ({
    async textToImage() {
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        type: 'image/png',
        async arrayBuffer() {
          return Uint8Array.from([9, 9, 9]).buffer;
        }
      };
    }
  }));

  const sessionId = `dedupe-${Date.now()}`;
  const [first, second] = await Promise.all([
    ensureSessionBackground(sessionId),
    ensureSessionBackground(sessionId)
  ]);

  assert.equal(providerCalls, 1);
  assert.deepEqual(Array.from(first.buffer), [9, 9, 9]);
  assert.deepEqual(Array.from(second.buffer), [9, 9, 9]);

});

test('deleteSessionBackground removes cached image', async () => {
  process.env.HUGGING_FACE_API_KEY = 'hf-key';
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  __setHuggingFaceClientFactoryForTests(() => ({
    async textToImage() {
      return {
        type: 'image/png',
        async arrayBuffer() {
          return Uint8Array.from([3, 2, 1]).buffer;
        }
      };
    }
  }));

  const sessionId = `delete-${Date.now()}`;
  await ensureSessionBackground(sessionId);
  await deleteSessionBackground(sessionId);
  __resetSessionBackgroundCacheForTests();

  const resultAfterDelete = await getSessionBackground(sessionId);
  assert.equal(resultAfterDelete, null);

});

import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateSessionBackground } from './geminiBackgroundService.js';

const originalFetch = global.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalHuggingFaceKey = process.env.HUGGING_FACE_API_KEY;

function createHeaders(contentType) {
  return {
    get(name) {
      if (name.toLowerCase() === 'content-type') {
        return contentType;
      }
      return null;
    }
  };
}

beforeEach(() => {
  global.fetch = undefined;
  delete process.env.GEMINI_API_KEY;
  delete process.env.HUGGING_FACE_API_KEY;
});

afterEach(() => {
  global.fetch = originalFetch;

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
});

test('uses Hugging Face when Gemini returns quota error', async () => {
  process.env.GEMINI_API_KEY = 'gemini-key';
  process.env.HUGGING_FACE_API_KEY = 'hf-key';

  const imageBytes = Uint8Array.from([1, 2, 3, 4]);
  let huggingFaceCalls = 0;

  global.fetch = async (url) => {
    if (String(url).includes('generativelanguage.googleapis.com')) {
      return {
        ok: false,
        status: 429,
        text: async () => '{"error":"RESOURCE_EXHAUSTED"}'
      };
    }

    assert.ok(
      String(url).startsWith('https://router.huggingface.co/hf-inference/models/'),
      'Expected Hugging Face router endpoint'
    );

    huggingFaceCalls += 1;
    return {
      ok: true,
      status: 200,
      headers: createHeaders('image/png'),
      arrayBuffer: async () => imageBytes.buffer
    };
  };

  const result = await generateSessionBackground(`quota-fallback-${Date.now()}`);
  assert.equal(result.mimeType, 'image/png');
  assert.deepEqual(Array.from(result.buffer), [1, 2, 3, 4]);
  assert.equal(huggingFaceCalls, 1);
});

test('supports Hugging Face-only configuration', async () => {
  process.env.HUGGING_FACE_API_KEY = 'hf-key';

  global.fetch = async (url) => {
    assert.ok(
      String(url).startsWith('https://router.huggingface.co/hf-inference/models/'),
      'Expected Hugging Face router endpoint'
    );

    return {
      ok: true,
      status: 200,
      headers: createHeaders('image/jpeg'),
      arrayBuffer: async () => Uint8Array.from([9, 8, 7]).buffer
    };
  };

  const result = await generateSessionBackground(`hf-only-${Date.now()}`);
  assert.equal(result.mimeType, 'image/jpeg');
});

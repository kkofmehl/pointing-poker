import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  __setHuggingFaceClientFactoryForTests,
  __setRandomIndexSelectorForTests,
  __resetSessionBackgroundCacheForTests,
  deleteSessionBackground,
  ensureSessionBackground,
  findArchiveBackground,
  generateSessionBackground,
  getSessionBackground,
  parseSessionTheme,
  slugFromSessionName
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

async function writeArchiveEntry({ sessionName, bufferBytes, mimeType = 'image/png' }) {
  const theme = parseSessionTheme(sessionName);
  const slug = slugFromSessionName(sessionName);
  await mkdir(tempCacheDir, { recursive: true });
  await Promise.all([
    writeFile(join(tempCacheDir, `${slug}.bin`), Buffer.from(bufferBytes)),
    writeFile(
      join(tempCacheDir, `${slug}.json`),
      JSON.stringify({
        mimeType,
        sessionName: theme.sessionName,
        character: theme.character,
        place: theme.place
      })
    )
  ]);
}

test('parses character and place from session names', () => {
  assert.deepEqual(parseSessionTheme("Superman's Den"), {
    sessionName: "Superman's Den",
    character: 'Superman',
    place: 'Den'
  });
  assert.deepEqual(parseSessionTheme("Harry Potter's Command Center"), {
    sessionName: "Harry Potter's Command Center",
    character: 'Harry Potter',
    place: 'Command Center'
  });
  assert.deepEqual(parseSessionTheme('Custom Room'), {
    sessionName: 'Custom Room',
    character: null,
    place: null
  });
});

test('slugFromSessionName creates filesystem-safe names', () => {
  assert.equal(slugFromSessionName("Superman's Den"), 'Superman_s_Den');
  assert.equal(slugFromSessionName("Harry Potter's Command Center"), 'Harry_Potter_s_Command_Center');
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

test('writes session-name slug files with character/place metadata', async () => {
  process.env.HUGGING_FACE_API_KEY = 'hf-key';
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  __setHuggingFaceClientFactoryForTests(() => ({
    async textToImage() {
      return {
        type: 'image/png',
        async arrayBuffer() {
          return Uint8Array.from([1, 2, 3]).buffer;
        }
      };
    }
  }));

  await ensureSessionBackground("Superman's Den");

  const files = await readdir(tempCacheDir);
  assert.ok(files.includes('Superman_s_Den.bin'));
  assert.ok(files.includes('Superman_s_Den.json'));

  const metadata = JSON.parse(await readFile(join(tempCacheDir, 'Superman_s_Den.json'), 'utf8'));
  assert.deepEqual(metadata, {
    mimeType: 'image/png',
    sessionName: "Superman's Den",
    character: 'Superman',
    place: 'Den'
  });
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

  const sessionId = "Neo's Retreat";
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

test('deleteSessionBackground clears memory but leaves disk files', async () => {
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

  const sessionId = "Batman's Cave";
  await ensureSessionBackground(sessionId);
  await deleteSessionBackground(sessionId);

  // Memory was cleared; disk still has the image and can be reloaded.
  const resultFromDisk = await getSessionBackground(sessionId);
  assert.ok(resultFromDisk);
  assert.deepEqual(Array.from(resultFromDisk.buffer), [3, 2, 1]);

  const files = await readdir(tempCacheDir);
  assert.ok(files.includes('Batman_s_Cave.bin'));
  assert.ok(files.includes('Batman_s_Cave.json'));
});

test('archive prefers both character and place matches', async () => {
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  await writeArchiveEntry({ sessionName: "Superman's Den", bufferBytes: [1, 1, 1] });
  await writeArchiveEntry({ sessionName: "Superman's Tower", bufferBytes: [2, 2, 2] });
  await writeArchiveEntry({ sessionName: "Batman's Den", bufferBytes: [3, 3, 3] });

  const result = await findArchiveBackground("Superman's Den");
  assert.deepEqual(Array.from(result.buffer), [1, 1, 1]);
});

test('archive falls back to character or place matches', async () => {
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  await writeArchiveEntry({ sessionName: "Superman's Tower", bufferBytes: [4, 4, 4] });
  await writeArchiveEntry({ sessionName: "Batman's Cave", bufferBytes: [5, 5, 5] });

  __setRandomIndexSelectorForTests(() => 0);
  const result = await findArchiveBackground("Superman's Den");
  assert.deepEqual(Array.from(result.buffer), [4, 4, 4]);
});

test('archive falls back to a random saved image when no theme matches', async () => {
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  await writeArchiveEntry({ sessionName: "Yoda's Library", bufferBytes: [6, 6, 6] });
  __setRandomIndexSelectorForTests(() => 0);

  const result = await findArchiveBackground("Custom Room");
  assert.deepEqual(Array.from(result.buffer), [6, 6, 6]);
});

test('falls back to archive when Hugging Face fails', async () => {
  process.env.HUGGING_FACE_API_KEY = 'hf-key';
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  await writeArchiveEntry({ sessionName: "Gandalf's Tower", bufferBytes: [7, 7, 7] });

  __setHuggingFaceClientFactoryForTests(() => ({
    async textToImage() {
      const error = new Error('quota exceeded');
      error.status = 429;
      throw error;
    }
  }));

  const result = await ensureSessionBackground("Gandalf's Fortress");
  assert.deepEqual(Array.from(result.buffer), [7, 7, 7]);

  const files = await readdir(tempCacheDir);
  assert.equal(files.includes('Gandalf_s_Fortress.bin'), false);
});

test('uses archive when no provider keys are configured', async () => {
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  await writeArchiveEntry({ sessionName: "Neo's Retreat", bufferBytes: [8, 8, 8] });

  const result = await ensureSessionBackground("Neo's Vault");
  assert.deepEqual(Array.from(result.buffer), [8, 8, 8]);
});

test('fails when providers fail and archive is empty', async () => {
  process.env.HUGGING_FACE_API_KEY = 'hf-key';
  tempCacheDir = await mkdtemp(join(tmpdir(), 'pp-bg-cache-'));
  process.env.SESSION_BACKGROUND_CACHE_DIR = tempCacheDir;

  __setHuggingFaceClientFactoryForTests(() => ({
    async textToImage() {
      const error = new Error('unavailable');
      error.status = 503;
      throw error;
    }
  }));

  await assert.rejects(
    () => ensureSessionBackground("Unknown's Nowhere"),
    (error) => error.code === 'HUGGING_FACE_HTTP_ERROR'
  );
});

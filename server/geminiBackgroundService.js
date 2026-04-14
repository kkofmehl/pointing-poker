import nodeFetch from 'node-fetch';
import { InferenceClient } from '@huggingface/inference';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { join } from 'path';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_IMAGE_MODELS = ['gemini-3.1-flash-image-preview'];
const DEFAULT_HUGGING_FACE_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';
const DEFAULT_HUGGING_FACE_PROVIDER = 'auto';

const imageCache = new Map();
const inFlightGeneration = new Map();
const defaultHuggingFaceClientFactory = (apiKey) => new InferenceClient(apiKey);
let huggingFaceClientFactory = defaultHuggingFaceClientFactory;

function fetchWithFallback(...args) {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch(...args);
  }

  return nodeFetch(...args);
}

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = (...args) => fetchWithFallback(...args);
}

function buildPrompt(sessionId) {
  return [
    'Create a cinematic, background image.',
    `Theme inspiration: "${sessionId}".`,
    'No logos, no text, no numbers.',
    'Use a dark but colorful palette that keeps UI text readable.'
  ].join(' ');
}

function getCacheDirectory() {
  return (
    process.env.SESSION_BACKGROUND_CACHE_DIR?.trim() ||
    join(process.cwd(), 'server', '.cache', 'session-backgrounds')
  );
}

function getCacheFilePaths(sessionId) {
  const cacheKey = createHash('sha256').update(sessionId).digest('hex');
  const cacheDirectory = getCacheDirectory();

  return {
    binaryPath: join(cacheDirectory, `${cacheKey}.bin`),
    metadataPath: join(cacheDirectory, `${cacheKey}.json`)
  };
}

async function readCachedImageFromDisk(sessionId) {
  const { binaryPath, metadataPath } = getCacheFilePaths(sessionId);

  try {
    const [binaryBuffer, metadataRaw] = await Promise.all([
      readFile(binaryPath),
      readFile(metadataPath, 'utf8')
    ]);
    const metadata = JSON.parse(metadataRaw);
    if (typeof metadata?.mimeType !== 'string' || !metadata.mimeType.startsWith('image/')) {
      return null;
    }

    return {
      buffer: binaryBuffer,
      mimeType: metadata.mimeType
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function writeCachedImageToDisk(sessionId, imageData) {
  const cacheDirectory = getCacheDirectory();
  const { binaryPath, metadataPath } = getCacheFilePaths(sessionId);
  await mkdir(cacheDirectory, { recursive: true });

  await Promise.all([
    writeFile(binaryPath, imageData.buffer),
    writeFile(
      metadataPath,
      JSON.stringify(
        {
          mimeType: imageData.mimeType
        },
        null,
        2
      )
    )
  ]);
}

export async function getSessionBackground(sessionId) {
  const cached = imageCache.get(sessionId);
  if (!cached) {
    const diskCachedImage = await readCachedImageFromDisk(sessionId);
    if (!diskCachedImage) {
      return null;
    }

    imageCache.set(sessionId, diskCachedImage);
    return diskCachedImage;
  }

  return cached;
}

function setCachedImage(sessionId, imageData) {
  imageCache.set(sessionId, imageData);
}

function extractInlineImage(responseJson) {
  const candidates = responseJson?.candidates;
  if (!Array.isArray(candidates)) {
    return null;
  }

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of parts) {
      const inlineData = part?.inlineData;
      if (inlineData?.data && inlineData?.mimeType?.startsWith('image/')) {
        return inlineData;
      }
    }
  }

  return null;
}

export function mapGeminiErrorToHttpStatus(error) {
  if (typeof error?.httpStatus === 'number') {
    return error.httpStatus;
  }
  if (error?.name === 'AbortError') {
    return 504;
  }
  return 503;
}

async function requestGeminiImage({ sessionId, apiKey, abortController }) {
  const configuredModel = process.env.GEMINI_IMAGE_MODEL?.trim();
  const candidateModels = configuredModel
    ? [configuredModel]
    : DEFAULT_IMAGE_MODELS;

  let lastError = null;

  for (const model of candidateModels) {
    const response = await fetchWithFallback(
      `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: buildPrompt(sessionId) }]
            }
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        }),
        signal: abortController.signal
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const geminiError = new Error(`Gemini request failed with status ${response.status}`);
      geminiError.code = 'GEMINI_HTTP_ERROR';
      geminiError.provider = 'gemini';
      geminiError.model = model;
      geminiError.httpStatus = response.status;
      geminiError.details = errorBody;

      // Try next model only if model itself is unavailable.
      if (response.status === 404 && !configuredModel) {
        lastError = geminiError;
        continue;
      }

      throw geminiError;
    }

    const responseJson = await response.json();
    const inlineImage = extractInlineImage(responseJson);
    if (!inlineImage) {
      const noImageError = new Error('Gemini response did not include an image');
      noImageError.code = 'NO_IMAGE_IN_RESPONSE';
      noImageError.provider = 'gemini';
      noImageError.model = model;
      throw noImageError;
    }

    return {
      buffer: Buffer.from(inlineImage.data, 'base64'),
      mimeType: inlineImage.mimeType
    };
  }

  throw lastError || new Error('No Gemini image model candidates succeeded');
}

async function requestHuggingFaceImage({ sessionName, apiKey }) {
  const model = process.env.HUGGING_FACE_IMAGE_MODEL?.trim() || DEFAULT_HUGGING_FACE_MODEL;
  const provider = process.env.HUGGING_FACE_PROVIDER?.trim() || DEFAULT_HUGGING_FACE_PROVIDER;
  const client = huggingFaceClientFactory(apiKey);

  try {
    const imageBlob = await client.textToImage({
      provider,
      model,
      inputs: buildPrompt(sessionName),
      options: {
        wait_for_model: true
      }
    });

    const imageArrayBuffer = await imageBlob.arrayBuffer();
    return {
      buffer: Buffer.from(imageArrayBuffer),
      mimeType: imageBlob.type || 'image/png'
    };
  } catch (error) {
    const details =
      typeof error?.message === 'string' ? error.message : JSON.stringify(error || {});
    const huggingFaceError = new Error(
      `Hugging Face request failed${error?.status ? ` with status ${error.status}` : ''}`
    );
    huggingFaceError.code = 'HUGGING_FACE_HTTP_ERROR';
    huggingFaceError.provider = 'hugging_face';
    if (typeof error?.status === 'number') {
      huggingFaceError.httpStatus = error.status;
    }
    huggingFaceError.details = details;
    throw huggingFaceError;
  }
}

async function generateFromProviders(sessionId) {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const huggingFaceApiKey = process.env.HUGGING_FACE_API_KEY?.trim();
  if (!geminiApiKey && !huggingFaceApiKey) {
    const missingProviderError = new Error(
      'No image provider key configured (GEMINI_API_KEY or HUGGING_FACE_API_KEY)'
    );
    missingProviderError.code = 'MISSING_API_KEY';
    throw missingProviderError;
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    let lastError = null;

    if (geminiApiKey) {
      try {
        const imageData = await requestGeminiImage({
          sessionId,
          apiKey: geminiApiKey,
          abortController
        });
        return imageData;
      } catch (error) {
        lastError = error;
      }
    }

    if (huggingFaceApiKey) {
      const imageData = await requestHuggingFaceImage({
        sessionName: sessionId,
        apiKey: huggingFaceApiKey,
        abortController
      });
      return imageData;
    }

    throw lastError || new Error('No image providers succeeded');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function ensureSessionBackground(sessionId) {
  const cachedImage = await getSessionBackground(sessionId);
  if (cachedImage) {
    return cachedImage;
  }

  if (inFlightGeneration.has(sessionId)) {
    return inFlightGeneration.get(sessionId);
  }

  const generationPromise = (async () => {
    const imageData = await generateFromProviders(sessionId);
    await writeCachedImageToDisk(sessionId, imageData);
    setCachedImage(sessionId, imageData);
    return imageData;
  })().finally(() => {
    inFlightGeneration.delete(sessionId);
  });

  inFlightGeneration.set(sessionId, generationPromise);
  return generationPromise;
}

export async function deleteSessionBackground(sessionId) {
  imageCache.delete(sessionId);
  inFlightGeneration.delete(sessionId);

  const { binaryPath, metadataPath } = getCacheFilePaths(sessionId);
  await Promise.all([
    rm(binaryPath, { force: true }),
    rm(metadataPath, { force: true })
  ]);
}

export async function generateSessionBackground(sessionId) {
  return ensureSessionBackground(sessionId);
}

export function __resetSessionBackgroundCacheForTests() {
  imageCache.clear();
  inFlightGeneration.clear();
  huggingFaceClientFactory = defaultHuggingFaceClientFactory;
}

export function __setHuggingFaceClientFactoryForTests(factory) {
  huggingFaceClientFactory = factory;
}

import nodeFetch from 'node-fetch';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const HUGGING_FACE_API_BASE_URL = 'https://router.huggingface.co/hf-inference/models';
const CACHE_TTL_MS = 1000 * 60 * 60;
const CACHE_MAX_ENTRIES = 100;
const REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_IMAGE_MODELS = ['gemini-3.1-flash-image-preview'];
const DEFAULT_HUGGING_FACE_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';

const imageCache = new Map();

function fetchWithFallback(...args) {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch(...args);
  }

  return nodeFetch(...args);
}

function buildPrompt(sessionName) {
  return [
    'Create a cinematic, background image.',
    `Theme inspiration: "${sessionName}".`,
    'No logos, no text, no numbers.',
    'Use a dark but colorful palette that keeps UI text readable.'
  ].join(' ');
}

function pruneCache() {
  const now = Date.now();
  for (const [key, value] of imageCache.entries()) {
    if (now - value.createdAt > CACHE_TTL_MS) {
      imageCache.delete(key);
    }
  }

  while (imageCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    imageCache.delete(oldestKey);
  }
}

function getCachedImage(sessionName) {
  const cached = imageCache.get(sessionName);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
    imageCache.delete(sessionName);
    return null;
  }

  return cached;
}

function setCachedImage(sessionName, imageData) {
  imageCache.set(sessionName, {
    ...imageData,
    createdAt: Date.now()
  });
  pruneCache();
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

async function requestGeminiImage({ sessionName, apiKey, abortController }) {
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
              parts: [{ text: buildPrompt(sessionName) }]
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

async function requestHuggingFaceImage({ sessionName, apiKey, abortController }) {
  const model = process.env.HUGGING_FACE_IMAGE_MODEL?.trim() || DEFAULT_HUGGING_FACE_MODEL;
  const generationResponse = await fetchWithFallback(`${HUGGING_FACE_API_BASE_URL}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: buildPrompt(sessionName),
      options: {
        wait_for_model: true
      }
    }),
    signal: abortController.signal
  });

  if (!generationResponse.ok) {
    const errorBody = await generationResponse.text();
    const huggingFaceError = new Error(
      `Hugging Face request failed with status ${generationResponse.status}`
    );
    huggingFaceError.code = 'HUGGING_FACE_HTTP_ERROR';
    huggingFaceError.provider = 'hugging_face';
    huggingFaceError.httpStatus = generationResponse.status;
    huggingFaceError.details = errorBody;
    throw huggingFaceError;
  }

  const contentType = generationResponse.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const errorPayload = await generationResponse.json();
    const invalidPayloadError = new Error('Hugging Face did not return image bytes');
    invalidPayloadError.code = 'HUGGING_FACE_INVALID_RESPONSE';
    invalidPayloadError.provider = 'hugging_face';
    invalidPayloadError.details = JSON.stringify(errorPayload);
    throw invalidPayloadError;
  }

  const imageArrayBuffer = await generationResponse.arrayBuffer();
  const mimeType = contentType || 'image/png';
  return {
    buffer: Buffer.from(imageArrayBuffer),
    mimeType
  };
}

export async function generateSessionBackground(sessionName) {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const huggingFaceApiKey = process.env.HUGGING_FACE_API_KEY?.trim();
  if (!geminiApiKey && !huggingFaceApiKey) {
    const missingProviderError = new Error(
      'No image provider key configured (GEMINI_API_KEY or HUGGING_FACE_API_KEY)'
    );
    missingProviderError.code = 'MISSING_API_KEY';
    throw missingProviderError;
  }

  const cached = getCachedImage(sessionName);
  if (cached) {
    return cached;
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    let lastError = null;

    if (geminiApiKey) {
      try {
        const imageData = await requestGeminiImage({
          sessionName,
          apiKey: geminiApiKey,
          abortController
        });
        setCachedImage(sessionName, imageData);
        return imageData;
      } catch (error) {
        lastError = error;
      }
    }

    if (huggingFaceApiKey) {
      const imageData = await requestHuggingFaceImage({
        sessionName,
        apiKey: huggingFaceApiKey,
        abortController
      });
      setCachedImage(sessionName, imageData);
      return imageData;
    }

    throw lastError || new Error('No image providers succeeded');
  } finally {
    clearTimeout(timeoutId);
  }
}

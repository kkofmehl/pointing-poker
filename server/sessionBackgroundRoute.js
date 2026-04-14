const MAX_SESSION_NAME_LENGTH = 120;
const SESSION_NAME_PATTERN = /^[\w\s'’.-]+$/;

export function validateSessionName(value) {
  if (typeof value !== 'string') {
    return { isValid: false, message: 'sessionName must be a string' };
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { isValid: false, message: 'sessionName is required' };
  }

  if (trimmedValue.length > MAX_SESSION_NAME_LENGTH) {
    return {
      isValid: false,
      message: `sessionName exceeds maximum length of ${MAX_SESSION_NAME_LENGTH}`
    };
  }

  if (!SESSION_NAME_PATTERN.test(trimmedValue)) {
    return { isValid: false, message: 'sessionName contains unsupported characters' };
  }

  return { isValid: true, value: trimmedValue };
}

export function createSessionBackgroundHandler({ generateSessionBackground, mapErrorToStatus }) {
  return async function handleSessionBackground(req, res) {
    const validation = validateSessionName(req.body?.sessionName);
    if (!validation.isValid) {
      res.status(400).json({ message: validation.message });
      return;
    }

    try {
      const result = await generateSessionBackground(validation.value);
      res.setHeader('Content-Type', result.mimeType);
      res.status(200).send(result.buffer);
    } catch (error) {
      const statusCode = typeof mapErrorToStatus === 'function' ? mapErrorToStatus(error) : 503;
      const message =
        error?.code === 'MISSING_API_KEY'
          ? 'Image generation is not configured'
          : 'Failed to generate session background';

      console.error('Session background generation failed', {
        sessionName: validation.value,
        statusCode,
        errorCode: error?.code || 'UNKNOWN',
        errorName: error?.name || 'Error',
        errorMessage: error?.message || 'Unknown error',
        errorDetails: error?.details || null
      });

      res.status(statusCode).json({ message });
    }
  };
}

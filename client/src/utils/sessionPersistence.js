export const CURRENT_SESSION_STORAGE_KEY = 'pointing-poker:current-session';

export function readPersistedSession() {
  const raw = sessionStorage.getItem(CURRENT_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.sessionId || !parsed?.userName) {
      return null;
    }

    return {
      sessionId: String(parsed.sessionId),
      userName: String(parsed.userName)
    };
  } catch {
    return null;
  }
}

export function persistSession(sessionId, userName) {
  const payload = JSON.stringify({ sessionId, userName });
  sessionStorage.setItem(CURRENT_SESSION_STORAGE_KEY, payload);
}

export function clearPersistedSession() {
  sessionStorage.removeItem(CURRENT_SESSION_STORAGE_KEY);
}

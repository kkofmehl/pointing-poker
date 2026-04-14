let activeObjectUrl = null;

function revokeActiveObjectUrl() {
  if (!activeObjectUrl) {
    return;
  }

  URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = null;
}

function setBackgroundImage(urlValue) {
  document.body.style.setProperty('--session-background-image', urlValue);
}

export async function applySessionBackground(sessionName) {
  const response = await fetch('/api/session-background', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionName })
  });

  if (!response.ok) {
    throw new Error(`Background request failed with status ${response.status}`);
  }

  const imageBlob = await response.blob();
  const newObjectUrl = URL.createObjectURL(imageBlob);

  revokeActiveObjectUrl();
  activeObjectUrl = newObjectUrl;
  setBackgroundImage(`url("${newObjectUrl}")`);
}

export function clearSessionBackground() {
  revokeActiveObjectUrl();
  setBackgroundImage('none');
}

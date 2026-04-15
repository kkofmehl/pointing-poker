<template>
  <div id="app">
    <main class="app-content">
      <SessionJoin v-if="!joined" @joined="handleJoined" />
      <VotingRoom
        v-else
        :session-id="sessionId"
        :user-name="userName"
        :initial-session-state="sessionState"
        @leave="handleLeave"
      />
    </main>
    <footer class="app-footer">
      Feel no obligation, but if you want to help offset hosting costs of this dandy little app,
      Venmo @kmozzler or Paypal kkash2206@gmail.com
      <br>
      © {{ new Date().getFullYear() }} Kmofy Consulting
    </footer>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import SessionJoin from './components/SessionJoin.vue';
import VotingRoom from './components/VotingRoom.vue';
import { socketService } from './services/socketService.js';
import {
  applySessionBackground,
  clearSessionBackground
} from './services/backgroundImageService.js';
import {
  clearPersistedSession,
  persistSession,
  readPersistedSession
} from './utils/sessionPersistence.js';

const joined = ref(false);
const sessionId = ref('');
const userName = ref('');
const sessionState = ref({});
const backgroundLoadedForSessionId = ref('');

function requestSessionBackground(targetSessionId) {
  if (!targetSessionId) {
    return;
  }

  if (backgroundLoadedForSessionId.value === targetSessionId) {
    return;
  }

  backgroundLoadedForSessionId.value = targetSessionId;
  void applySessionBackground(targetSessionId).catch((backgroundError) => {
    console.error('Failed to apply session background image:', backgroundError);
    clearSessionBackground();
  });
}

function getCurrentUserNameFromState(state) {
  const socketId = socketService.getSocketId();
  if (!socketId || !Array.isArray(state?.users)) {
    return '';
  }

  const currentUser = state.users.find((user) => user.id === socketId);
  return currentUser?.name || '';
}

function autoRejoinPersistedSession() {
  const persistedSession = readPersistedSession();
  if (!persistedSession) {
    return;
  }

  socketService.connect();
  socketService.emit('join_session', persistedSession);
}

function handleSessionState(state) {
  const persistedSession = readPersistedSession();
  const resolvedUserName =
    persistedSession?.userName ||
    userName.value ||
    getCurrentUserNameFromState(state);

  if (!resolvedUserName) {
    return;
  }

  handleJoined({
    sessionId: state.sessionId,
    userName: resolvedUserName,
    sessionState: state
  });
}

function handleSessionClosed() {
  handleLeave();
}

function handleSessionBackgroundReady(data) {
  if (!joined.value) {
    return;
  }

  if (data?.sessionId !== sessionId.value) {
    return;
  }

  requestSessionBackground(data.sessionId);
}

function handleJoined(data) {
  const previousSessionId = sessionId.value;
  sessionId.value = data.sessionId;
  userName.value = data.userName;
  sessionState.value = data.sessionState;
  joined.value = true;
  persistSession(data.sessionId, data.userName);

  if (previousSessionId && previousSessionId !== data.sessionId) {
    clearSessionBackground();
    backgroundLoadedForSessionId.value = '';
  }
}

function handleLeave() {
  clearPersistedSession();
  clearSessionBackground();
  backgroundLoadedForSessionId.value = '';
  joined.value = false;
  sessionId.value = '';
  userName.value = '';
  sessionState.value = {};
}

onMounted(() => {
  socketService.onConnect(autoRejoinPersistedSession);
  socketService.on('session_state', handleSessionState);
  socketService.on('session_closed', handleSessionClosed);
  socketService.on('session_background_ready', handleSessionBackgroundReady);
  autoRejoinPersistedSession();
});

onUnmounted(() => {
  socketService.offConnect(autoRejoinPersistedSession);
  socketService.off('session_state', handleSessionState);
  socketService.off('session_closed', handleSessionClosed);
  socketService.off('session_background_ready', handleSessionBackgroundReady);
});
</script>

<style>
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-content {
  flex: 1;
}

.app-footer {
  margin-top: 16px;
  padding: 10px 4px 0;
  font-size: 0.8rem;
  font-style: italic;
  text-align: center;
  color: rgba(255, 255, 255, 0.72);
}
</style>


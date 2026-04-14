<template>
  <div id="app">
    <SessionJoin v-if="!joined" @joined="handleJoined" />
    <VotingRoom
      v-else
      :session-id="sessionId"
      :user-name="userName"
      :initial-session-state="sessionState"
      @leave="handleLeave"
    />
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

function handleJoined(data) {
  const previousSessionId = sessionId.value;
  sessionId.value = data.sessionId;
  userName.value = data.userName;
  sessionState.value = data.sessionState;
  joined.value = true;
  persistSession(data.sessionId, data.userName);

  if (backgroundLoadedForSessionId.value !== data.sessionId || previousSessionId !== data.sessionId) {
    backgroundLoadedForSessionId.value = data.sessionId;
    void applySessionBackground(data.sessionId).catch((backgroundError) => {
      console.error('Failed to apply session background image:', backgroundError);
      clearSessionBackground();
    });
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
  autoRejoinPersistedSession();
});

onUnmounted(() => {
  socketService.offConnect(autoRejoinPersistedSession);
  socketService.off('session_state', handleSessionState);
  socketService.off('session_closed', handleSessionClosed);
});
</script>

<style>
#app {
  min-height: 100vh;
}
</style>


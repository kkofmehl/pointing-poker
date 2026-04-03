<template>
  <div class="session-join">
    <div class="join-card">
      <h1>Pointing Poker</h1>
      <p class="subtitle">Join a session to start estimating</p>
      
      <form @submit.prevent="handleJoin" class="join-form">
        <div class="form-group" v-if="activeSessions.length > 0">
          <label for="sessionSelect">Select Active Session</label>
          <select
            id="sessionSelect"
            v-model="selectedSessionId"
            class="input select"
            @change="onSessionSelectChange"
          >
            <option value="">Start new Session</option>
            <option
              v-for="session in activeSessions"
              :key="session.sessionId"
              :value="session.sessionId"
            >
              {{ session.sessionId }}
            </option>
          </select>
        </div>
        
        <div class="form-group" v-if="!selectedSessionId">
          <label for="sessionName">Session Name</label>
          <div class="session-name-display">
            <input
              id="sessionName"
              :value="sessionId"
              type="text"
              readonly
              class="input readonly"
            />
            <button
              type="button"
              @click="generateNewSessionName"
              class="btn-refresh"
              title="Generate new session name"
            >
              🔄
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label for="userName">Your Name</label>
          <input
            id="userName"
            v-model="userName"
            type="text"
            placeholder="Enter your name"
            required
            class="input"
          />
        </div>
        
        <button type="submit" class="btn btn-primary" :disabled="!effectiveSessionId || !userName">
          Join Session
        </button>
      </form>
      
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { socketService } from '../services/socketService.js';
import { generateSessionName } from '../utils/sessionNameGenerator.js';

const emit = defineEmits(['joined']);

const sessionId = ref(generateSessionName());
const userName = ref('');
const error = ref('');
const activeSessions = ref([]);
const selectedSessionId = ref('');
const pendingJoinUserName = ref('');
const isJoinPending = ref(false);

socketService.connect();

// Computed property for effective session ID (dropdown takes precedence)
const effectiveSessionId = computed(() => {
  return selectedSessionId.value || sessionId.value.trim();
});

// Generate a new random session name
function generateNewSessionName() {
  sessionId.value = generateSessionName();
}

// Handle session selection from dropdown
function onSessionSelectChange() {
  if (selectedSessionId.value) {
    // When selecting an existing session, use that session ID
    // sessionId is not used in this case, but we keep it for consistency
  } else {
    // Generate a new random name when returning to "Start new Session"
    generateNewSessionName();
  }
}

function handleSocketError(err) {
  error.value = err.message || 'An error occurred';
  isJoinPending.value = false;
  pendingJoinUserName.value = '';
}

// Handle active sessions updates
function handleActiveSessionsUpdate(data) {
  activeSessions.value = data.sessions || [];
}

function handleSessionState(state) {
  if (!isJoinPending.value) {
    return;
  }

  isJoinPending.value = false;
  emit('joined', {
    sessionId: state.sessionId,
    userName: pendingJoinUserName.value || userName.value.trim(),
    sessionState: state
  });
  pendingJoinUserName.value = '';
}

function handleJoin() {
  const finalSessionId = effectiveSessionId.value;
  if (!finalSessionId || !userName.value.trim()) {
    return;
  }

  error.value = '';
  
  socketService.emit('join_session', {
    sessionId: finalSessionId,
    userName: userName.value.trim()
  });
  isJoinPending.value = true;
  pendingJoinUserName.value = userName.value.trim();
}

onMounted(() => {
  socketService.on('error', handleSocketError);
  socketService.on('active_sessions_updated', handleActiveSessionsUpdate);
  socketService.on('session_state', handleSessionState);

  // Request active sessions when component mounts
  socketService.emit('get_active_sessions');
});

onUnmounted(() => {
  // Clean up listeners
  socketService.off('error', handleSocketError);
  socketService.off('active_sessions_updated', handleActiveSessionsUpdate);
  socketService.off('session_state', handleSessionState);
});
</script>

<style scoped>
.session-join {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.join-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

h1 {
  font-size: 2.5rem;
  color: #d32f2f;
  margin-bottom: 8px;
  text-align: center;
}

.subtitle {
  color: #666;
  text-align: center;
  margin-bottom: 32px;
  font-size: 1rem;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.input {
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: #d32f2f;
}

.input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.7;
}

.select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.form-group {
  transition: opacity 0.3s ease, max-height 0.3s ease;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #d32f2f;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #b71c1c;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(211, 47, 47, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  text-align: center;
  font-size: 0.9rem;
}

.session-name-display {
  display: flex;
  gap: 8px;
  align-items: center;
}

.session-name-display .readonly {
  flex: 1;
  background-color: #f5f5f5;
  cursor: default;
}

.btn-refresh {
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
  min-width: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-refresh:hover {
  border-color: #d32f2f;
  background: #fff5f5;
  transform: rotate(180deg);
}
</style>


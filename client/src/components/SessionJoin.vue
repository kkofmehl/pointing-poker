<template>
  <div class="session-join">
    <div class="join-card">
      <h1>Pointing Poker</h1>
      <p class="subtitle">Join a session to start estimating</p>
      
      <form @submit.prevent="handleJoin" class="join-form">
        <div class="form-group">
          <label for="sessionId">Session ID</label>
          <input
            id="sessionId"
            v-model="sessionId"
            type="text"
            placeholder="Enter session ID"
            required
            class="input"
          />
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
        
        <button type="submit" class="btn btn-primary" :disabled="!sessionId || !userName">
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
import { ref } from 'vue';
import { socketService } from '../services/socketService.js';

const emit = defineEmits(['joined']);

const sessionId = ref('');
const userName = ref('');
const error = ref('');

socketService.connect();

socketService.on('error', (err) => {
  error.value = err.message || 'An error occurred';
});

function handleJoin() {
  if (!sessionId.value.trim() || !userName.value.trim()) {
    return;
  }

  error.value = '';
  
  socketService.emit('join_session', {
    sessionId: sessionId.value.trim(),
    userName: userName.value.trim()
  });

  socketService.on('session_state', (state) => {
    emit('joined', {
      sessionId: state.sessionId,
      userName: userName.value.trim(),
      sessionState: state
    });
  });
}
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
</style>


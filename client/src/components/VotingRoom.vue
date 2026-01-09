<template>
  <div class="voting-room">
    <div class="room-header">
      <div class="session-info">
        <h1>Session: {{ sessionId }}</h1>
        <p class="user-name">You: {{ userName }}</p>
      </div>
      <button @click="handleReset" class="btn btn-secondary" v-if="allVoted">
        New Round
      </button>
    </div>

    <div class="participants">
      <h2>Participants ({{ users.length }})</h2>
      <div class="users-list">
        <div
          v-for="user in users"
          :key="user.id"
          :class="['user-badge', { 'has-voted': hasUserVoted(user.id) }]"
        >
          {{ user.name }}
          <span v-if="hasUserVoted(user.id)" class="checkmark">✓</span>
        </div>
      </div>
    </div>

    <div v-if="!allVoted" class="voting-section">
      <CardSelector
        :disabled="hasVoted"
        :initial-selected="userVote"
        @vote-submitted="handleVoteSubmitted"
      />
      
      <div v-if="hasVoted" class="waiting-message">
        <p>✓ You've submitted your vote!</p>
        <p>Waiting for other participants...</p>
      </div>
    </div>

    <div v-else class="results-section">
      <ResultsDisplay
        :users="users"
        :votes="votes"
        :userName="userName"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import CardSelector from './CardSelector.vue';
import ResultsDisplay from './ResultsDisplay.vue';
import { socketService } from '../services/socketService.js';

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  initialSessionState: {
    type: Object,
    default: () => ({})
  }
});

const users = ref(props.initialSessionState.users || []);
const votes = ref(props.initialSessionState.votes || {});
const allVoted = ref(props.initialSessionState.allVoted || false);
const hasVoted = ref(props.initialSessionState.hasVoted || false);
const userVote = ref(null);

const socketId = computed(() => socketService.getSocketId());

function hasUserVoted(userId) {
  return userId in votes;
}

function handleVoteSubmitted(cardValue) {
  socketService.emit('submit_vote', {
    sessionId: props.sessionId,
    cardValue: cardValue
  });
  
  userVote.value = cardValue;
  hasVoted.value = true;
}

function handleReset() {
  socketService.emit('reset_session', {
    sessionId: props.sessionId
  });
}

function updateSessionState(state) {
  users.value = state.users || [];
  votes.value = state.votes || {};
  allVoted.value = state.allVoted || false;
  hasVoted.value = state.hasVoted || false;
  
  // Update user's vote display
  if (socketId.value && votes.value[socketId.value]) {
    userVote.value = votes.value[socketId.value];
  }
}

onMounted(() => {
  socketService.on('session_state', updateSessionState);
  socketService.on('user_joined', (data) => {
    users.value = data.users || users.value;
  });
  socketService.on('user_left', (data) => {
    users.value = data.users || users.value;
    votes.value = data.votes || votes.value;
    allVoted.value = data.allVoted || false;
  });
});

onUnmounted(() => {
  socketService.off('session_state', updateSessionState);
});
</script>

<style scoped>
.voting-room {
  max-width: 1200px;
  margin: 0 auto;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 20px 30px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.session-info h1 {
  color: white;
  font-size: 1.8rem;
  margin-bottom: 4px;
}

.user-name {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid white;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: white;
  color: #667eea;
}

.participants {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.participants h2 {
  color: white;
  font-size: 1.2rem;
  margin-bottom: 16px;
}

.users-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.user-badge {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-badge.has-voted {
  background: rgba(76, 175, 80, 0.3);
  border: 2px solid #4caf50;
}

.checkmark {
  color: #4caf50;
  font-weight: bold;
}

.voting-section {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 30px;
  border-radius: 12px;
}

.waiting-message {
  margin-top: 24px;
  text-align: center;
  color: white;
}

.waiting-message p {
  font-size: 1.1rem;
  margin: 8px 0;
}

.results-section {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 30px;
  border-radius: 12px;
}

@media (max-width: 768px) {
  .room-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .session-info h1 {
    font-size: 1.4rem;
  }
}
</style>


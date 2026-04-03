<template>
  <div class="voting-room">
    <div class="room-header">
      <div class="session-info">
        <h1>Session: {{ sessionId }}</h1>
        <p class="user-name">You: {{ userName }}</p>
      </div>
      <div class="header-actions">
        <button @click="handleReset" class="btn btn-secondary" v-if="allVoted">
          New Round
        </button>
        <button
          @click="showCloseSessionModal = true"
          class="btn btn-close-session"
          data-test="close-session-btn"
        >
          Close Session
        </button>
        <button @click="handleLeaveSession" class="btn btn-leave">
          Leave Session
        </button>
      </div>
    </div>

    <div class="participants">
      <div class="participants-header">
        <h2>Participants ({{ users.length }})</h2>
        <button 
          v-if="!allVoted" 
          @click="showRevealModal = true" 
          class="btn btn-reveal"
        >
          Reveal Votes Now
        </button>
      </div>
      <div class="users-list">
        <div
          v-for="user in users"
          :key="user.id"
          :class="['user-badge', { 
            'has-voted': hasUserVoted(user.id),
            'actively-voting': isUserActivelyVoting(user.id)
          }]"
        >
          {{ user.name }}
          <span v-if="hasUserVoted(user.id)" class="checkmark">✓</span>
          <span v-if="allVoted && !hasUserVoted(user.id)" class="coffee-icon">☕</span>
          <span v-if="isUserActivelyVoting(user.id)" class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </span>
        </div>
      </div>
    </div>

    <!-- Reveal Votes Modal -->
    <div v-if="showRevealModal" class="modal-overlay" @click="showRevealModal = false">
      <div class="modal-content" @click.stop>
        <h3>Reveal Votes Now?</h3>
        <p>This will reveal all votes even though some participants have not submitted. Continue?</p>
        <div class="modal-actions">
          <button @click="handleForceReveal" class="btn btn-modal-confirm">It's Okay</button>
          <button @click="showRevealModal = false" class="btn btn-modal-cancel">Nevermind</button>
        </div>
      </div>
    </div>

    <!-- Close Session Modal -->
    <div v-if="showCloseSessionModal" class="modal-overlay" @click="showCloseSessionModal = false">
      <div class="modal-content" @click.stop>
        <h3>Close Session?</h3>
        <p>This will close the session for all users. Everyone will be returned to the join screen.</p>
        <div class="modal-actions">
          <button
            @click="handleCloseSession"
            class="btn btn-modal-confirm"
            data-test="confirm-close-session-btn"
          >
            Close Session
          </button>
          <button @click="showCloseSessionModal = false" class="btn btn-modal-cancel">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <div v-if="!allVoted" class="voting-section">
      <CardSelector
        :disabled="hasVoted || allVoted"
        :initial-selected="userVote"
        :initial-confidence="userConfidence"
        @vote-submitted="handleVoteSubmitted"
        @vote-undo="handleVoteUndo"
        @card-selected="handleCardSelected"
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
        :confidences="confidences"
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

const emit = defineEmits(['leave']);

const users = ref(props.initialSessionState.users || []);
const votes = ref(props.initialSessionState.votes && typeof props.initialSessionState.votes === 'object' ? props.initialSessionState.votes : {});
const confidences = ref(props.initialSessionState.confidences && typeof props.initialSessionState.confidences === 'object' ? props.initialSessionState.confidences : {});
const allVoted = ref(props.initialSessionState.allVoted || false);
const hasVoted = ref(false);
const userVote = ref(null);
const userConfidence = ref(10);
const selectedUsers = ref(props.initialSessionState.selectedCards || []);
const showRevealModal = ref(false);
const showCloseSessionModal = ref(false);

const socketId = computed(() => socketService.getSocketId());

function hasUserVoted(userId) {
  return userId in votes.value && votes.value[userId] !== null && votes.value[userId] !== undefined;
}

function isUserActivelyVoting(userId) {
  // Don't show typing indicator after votes are revealed
  if (allVoted.value) {
    return false;
  }
  return selectedUsers.value.includes(userId) && !hasUserVoted(userId);
}

function handleForceReveal() {
  socketService.emit('force_reveal', {
    sessionId: props.sessionId
  });
  showRevealModal.value = false;
}

function handleVoteSubmitted(payload) {
  const cardValue = typeof payload === 'object' && payload !== null ? payload.cardValue : payload;
  const confidenceValue = typeof payload === 'object' && payload !== null && 'confidence' in payload
    ? payload.confidence
    : 10;
  // Optimistically update local state immediately
  if (socketId.value) {
    votes.value = { ...votes.value, [socketId.value]: cardValue };
    confidences.value = { ...confidences.value, [socketId.value]: confidenceValue };
  }
  userVote.value = cardValue;
  userConfidence.value = confidenceValue;
  hasVoted.value = true;
  
  socketService.emit('submit_vote', {
    sessionId: props.sessionId,
    cardValue: cardValue,
    confidence: confidenceValue
  });
}

function handleVoteUndo() {
  // Optimistically update local state immediately
  if (socketId.value && socketId.value in votes.value) {
    const updatedVotes = { ...votes.value };
    delete updatedVotes[socketId.value];
    votes.value = updatedVotes;
  }
  if (socketId.value && socketId.value in confidences.value) {
    const updatedConfidences = { ...confidences.value };
    delete updatedConfidences[socketId.value];
    confidences.value = updatedConfidences;
  }
  hasVoted.value = false;
  userVote.value = null;
  userConfidence.value = 10;
  
  socketService.emit('retract_vote', {
    sessionId: props.sessionId
  });
}

function handleCardSelected(cardValue) {
  if (cardValue === null) {
    // Clear selection
    socketService.emit('card_cleared', {
      sessionId: props.sessionId
    });
  } else {
    // Track selection
    socketService.emit('card_selected', {
      sessionId: props.sessionId
    });
  }
}

function handleReset() {
  socketService.emit('reset_session', {
    sessionId: props.sessionId
  });
}

function handleLeaveSession() {
  socketService.emit('leave_session', {
    sessionId: props.sessionId
  });
  emit('leave');
}

function handleCloseSession() {
  socketService.emit('close_session', {
    sessionId: props.sessionId
  });
  showCloseSessionModal.value = false;
}

function updateSessionState(state) {
  users.value = state.users || [];
  // Ensure votes is always an object, even if empty
  votes.value = state.votes && typeof state.votes === 'object' ? state.votes : {};
  confidences.value = state.confidences && typeof state.confidences === 'object' ? state.confidences : {};
  allVoted.value = state.allVoted || false;
  selectedUsers.value = state.selectedCards || [];
  
  // Calculate hasVoted based on current user's socket ID
  hasVoted.value = socketId.value ? (socketId.value in votes.value && votes.value[socketId.value] != null) : false;
  
  // Update user's vote display
  if (socketId.value && votes.value[socketId.value]) {
    userVote.value = votes.value[socketId.value];
    const rawConfidence = confidences.value && socketId.value in confidences.value
      ? confidences.value[socketId.value]
      : 10;
    const numericConfidence = typeof rawConfidence === 'string' ? parseInt(rawConfidence, 10) : rawConfidence;
    userConfidence.value = Number.isFinite(numericConfidence) ? numericConfidence : 10;
  } else {
    // Reset userVote when no vote exists (e.g., after reset or undo)
    userVote.value = null;
    userConfidence.value = 10;
  }
}

function handleUserJoined(data) {
  users.value = data.users || users.value;
}

function handleUserLeft(data) {
  users.value = data.users || users.value;
  votes.value = data.votes || votes.value;
  confidences.value = data.confidences || confidences.value;
  selectedUsers.value = data.selectedCards || [];
  allVoted.value = data.allVoted || false;
  // Recalculate hasVoted after user left
  hasVoted.value = socketId.value ? (socketId.value in votes.value) : false;
  if (!hasVoted.value) {
    userVote.value = null;
  }
}

function handleSessionClosed() {
  emit('leave');
}

onMounted(() => {
  socketService.on('session_state', updateSessionState);
  socketService.on('user_joined', handleUserJoined);
  socketService.on('user_left', handleUserLeft);
  socketService.on('session_closed', handleSessionClosed);
  
  // Initialize hasVoted from initial state
  if (socketId.value && props.initialSessionState.votes) {
    hasVoted.value = socketId.value in props.initialSessionState.votes;
    if (hasVoted.value) {
      userVote.value = props.initialSessionState.votes[socketId.value];
      const rawConfidence = props.initialSessionState.confidences && socketId.value in props.initialSessionState.confidences
        ? props.initialSessionState.confidences[socketId.value]
        : 10;
      const numericConfidence = typeof rawConfidence === 'string' ? parseInt(rawConfidence, 10) : rawConfidence;
      userConfidence.value = Number.isFinite(numericConfidence) ? numericConfidence : 10;
    }
  }
});

onUnmounted(() => {
  socketService.off('session_state', updateSessionState);
  socketService.off('user_joined', handleUserJoined);
  socketService.off('user_left', handleUserLeft);
  socketService.off('session_closed', handleSessionClosed);
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
  background: rgba(211, 47, 47, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(211, 47, 47, 0.2);
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
  color: #d32f2f;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.btn-leave {
  background: rgba(255, 87, 34, 0.2);
  color: white;
  border: 2px solid rgba(255, 87, 34, 0.5);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-leave:hover {
  background: rgba(255, 87, 34, 0.4);
  border-color: rgba(255, 87, 34, 0.8);
}

.btn-close-session {
  background: rgba(244, 67, 54, 0.2);
  color: white;
  border: 2px solid rgba(244, 67, 54, 0.5);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close-session:hover {
  background: rgba(244, 67, 54, 0.35);
  border-color: rgba(244, 67, 54, 0.9);
}

.participants {
  background: rgba(211, 47, 47, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(211, 47, 47, 0.2);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.participants-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.participants h2 {
  color: white;
  font-size: 1.2rem;
  margin: 0;
}

.btn-reveal {
  background: rgba(255, 193, 7, 0.2);
  color: white;
  border: 2px solid rgba(255, 193, 7, 0.5);
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reveal:hover {
  background: rgba(255, 193, 7, 0.3);
  border-color: rgba(255, 193, 7, 0.8);
  transform: translateY(-1px);
}

.users-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.user-badge {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-badge.has-voted {
  background: rgba(76, 175, 80, 0.4) !important;
  border: 2px solid #4caf50 !important;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
}

.user-badge.actively-voting:not(.has-voted) {
  border: 1px solid rgba(255, 193, 7, 0.5);
  background: rgba(255, 193, 7, 0.1);
}

.checkmark {
  color: #4caf50;
  font-weight: bold;
  font-size: 1.2rem;
  line-height: 1;
}

.coffee-icon {
  font-size: 1.1rem;
  line-height: 1;
  opacity: 0.8;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.7);
  animation: typing 1.4s infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
  color: #333;
  font-size: 1.5rem;
  margin-bottom: 16px;
}

.modal-content p {
  color: #666;
  font-size: 1rem;
  margin-bottom: 24px;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-modal-confirm {
  background: #d32f2f;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-modal-confirm:hover {
  background: #b71c1c;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(211, 47, 47, 0.4);
}

.btn-modal-cancel {
  background: #f5f5f5;
  color: #333;
  border: 2px solid #e0e0e0;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-modal-cancel:hover {
  background: #e0e0e0;
  border-color: #bdbdbd;
}

.voting-section {
  background: rgba(211, 47, 47, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(211, 47, 47, 0.2);
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
  background: rgba(211, 47, 47, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(211, 47, 47, 0.2);
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
  
  .header-actions {
    width: 100%;
    flex-direction: column;
  }
  
  .header-actions .btn {
    width: 100%;
  }
}
</style>


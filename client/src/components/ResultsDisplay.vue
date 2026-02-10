<template>
  <div class="results-display">
    <h2 class="results-title fade-in">All Votes Revealed!</h2>
    
    <div class="results-grid">
      <div
        v-for="(user, index) in usersWithVotes"
        :key="user.id"
        :class="['result-card', 'fade-in', { 'current-user': user.name === userName }]"
        :style="{
          ...getCardStyle(votes[user.id]),
          animationDelay: `${index * 0.16}s`
        }"
      >
        <div class="user-name">{{ user.name }}</div>
        <div class="vote-value">
          <span v-if="getVoteIcon(votes[user.id])" class="vote-icon">{{ getVoteIcon(votes[user.id]) }}</span>
          <span v-if="getVoteDisplay(votes[user.id])">{{ getVoteDisplay(votes[user.id]) }}</span>
        </div>
        <div class="confidence-value" v-if="shouldShowConfidence(user.id)">
          Confidence: <strong>{{ getUserConfidence(user.id) }}</strong>/10
        </div>
      </div>
    </div>

    <div class="statistics fade-in" v-if="hasVotes" :style="{ animationDelay: `${usersWithVotes.length * 0.08}s` }">
      <div class="stat-item">
        <span class="stat-label">Average:</span>
        <span class="stat-value">{{ average.toFixed(2) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Min:</span>
        <span class="stat-value">{{ min }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Max:</span>
        <span class="stat-value">{{ max }}</span>
      </div>
      <div class="stat-item" v-if="hasConfidence">
        <span class="stat-label">Aggregate Confidence:</span>
        <span class="stat-value">{{ aggregateConfidencePercent }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getCardColor, getCardConfig } from '../config/cards.js';

const props = defineProps({
  users: {
    type: Array,
    required: true
  },
  votes: {
    type: Object,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  confidences: {
    type: Object,
    required: true
  }
});

// Filter users to only show those who have voted
const usersWithVotes = computed(() => {
  return props.users.filter(user => 
    user.id in props.votes && 
    props.votes[user.id] !== null && 
    props.votes[user.id] !== undefined
  );
});

// Exclude value 0 (Not Voting) from statistics
const voteValues = computed(() => {
  return Object.values(props.votes)
    .map(v => typeof v === 'string' ? parseFloat(v) : v)
    .filter(v => !isNaN(v) && v !== 0);
});

const hasVotes = computed(() => {
  return voteValues.value.length > 0;
});

const average = computed(() => {
  if (!hasVotes.value) return 0;
  const sum = voteValues.value.reduce((a, b) => a + b, 0);
  return sum / voteValues.value.length;
});

const min = computed(() => {
  if (!hasVotes.value) return 0;
  return Math.min(...voteValues.value);
});

const max = computed(() => {
  if (!hasVotes.value) return 0;
  return Math.max(...voteValues.value);
});

// Confidence calculations (1–10), only for users with numerical votes (excluding 0)
const confidenceValues = computed(() => {
  const values = [];
  for (const user of props.users) {
    const rawVote = props.votes[user.id];
    if (rawVote === undefined || rawVote === null) {
      continue;
    }
    const numericVote = typeof rawVote === 'string' ? parseFloat(rawVote) : rawVote;
    if (isNaN(numericVote) || numericVote === 0) {
      continue;
    }
    const rawConfidence = props.confidences && user.id in props.confidences
      ? props.confidences[user.id]
      : 10;
    const numericConfidence = typeof rawConfidence === 'string'
      ? parseInt(rawConfidence, 10)
      : rawConfidence;
    if (Number.isFinite(numericConfidence)) {
      values.push(Math.min(10, Math.max(1, numericConfidence)));
    }
  }
  return values;
});

const hasConfidence = computed(() => confidenceValues.value.length > 0);

const aggregateConfidencePercent = computed(() => {
  if (!hasConfidence.value) {
    return 0;
  }
  const sum = confidenceValues.value.reduce((a, b) => a + b, 0);
  const averageConfidence = sum / confidenceValues.value.length;
  return Math.round(averageConfidence * 10);
});

function getCardStyle(voteValue) {
  if (voteValue === undefined || voteValue === null) {
    return {};
  }
  const numValue = typeof voteValue === 'string' ? parseFloat(voteValue) : voteValue;
  if (isNaN(numValue)) {
    return {};
  }
  // Use uniform red for all cards except "Not Voting" (0) which stays gray
  const color = numValue === 0 ? '#757575' : '#d32f2f';
  return {
    backgroundColor: color,
    borderColor: color
  };
}

function getVoteDisplay(voteValue) {
  if (voteValue === undefined || voteValue === null) {
    return '—';
  }
  const card = getCardConfig(voteValue);
  if (card) {
    // If card has an icon but no label (like "Not Voting"), return empty string
    if (card.icon && !card.label) {
      return '';
    }
    return card.label;
  }
  return voteValue;
}

function getVoteIcon(voteValue) {
  if (voteValue === undefined || voteValue === null) {
    return null;
  }
  const card = getCardConfig(voteValue);
  return card ? card.icon : null;
}

function getUserConfidence(userId) {
  const rawConfidence = props.confidences && userId in props.confidences
    ? props.confidences[userId]
    : 10;
  const numericConfidence = typeof rawConfidence === 'string'
    ? parseInt(rawConfidence, 10)
    : rawConfidence;
  if (!Number.isFinite(numericConfidence)) {
    return 10;
  }
  return Math.min(10, Math.max(1, numericConfidence));
}

function shouldShowConfidence(userId) {
  const rawVote = props.votes[userId];
  if (rawVote === undefined || rawVote === null) {
    return false;
  }
  const numericVote = typeof rawVote === 'string' ? parseFloat(rawVote) : rawVote;
  // Hide confidence for coffee / Not Voting (0) so it doesn't appear to affect the aggregate
  if (isNaN(numericVote) || numericVote === 0) {
    return false;
  }
  return true;
}
</script>

<style scoped>
.results-display {
  text-align: center;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.8s ease-out forwards;
  opacity: 0;
}

.results-title {
  color: white;
  font-size: 2rem;
  margin-bottom: 32px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.result-card {
  background: white;
  border: 3px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s;
  color: #333;
}

.result-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.result-card.current-user {
  background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
  color: white;
  border: 3px solid #fff;
}

.user-name {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 12px;
  font-weight: 600;
}

.result-card.current-user .user-name {
  color: rgba(255, 255, 255, 0.9);
}

.vote-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.vote-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.result-card.current-user .vote-value {
  color: white;
}

.confidence-value {
  margin-top: 8px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
}

.result-card:not(.current-user) {
  color: white;
}

.result-card:not(.current-user) .vote-value {
  color: white;
}

.result-card:not(.current-user) .user-name {
  color: rgba(255, 255, 255, 0.9);
}

.statistics {
  display: flex;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
  background: rgba(211, 47, 47, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(211, 47, 47, 0.2);
  padding: 20px;
  border-radius: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.stat-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-value {
  color: white;
  font-size: 1.8rem;
  font-weight: bold;
}

@media (max-width: 768px) {
  .results-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 16px;
  }
  
  .vote-value {
    font-size: 2rem;
  }
  
  .statistics {
    gap: 20px;
  }
}
</style>


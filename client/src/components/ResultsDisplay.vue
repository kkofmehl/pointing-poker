<template>
  <div class="results-display">
    <h2 class="results-title">All Votes Revealed!</h2>
    
    <div class="results-grid">
      <div
        v-for="user in users"
        :key="user.id"
        :class="['result-card', { 'current-user': user.name === userName }]"
        :style="getCardStyle(votes[user.id])"
      >
        <div class="user-name">{{ user.name }}</div>
        <div class="vote-value">
          <span v-if="getVoteIcon(votes[user.id])" class="vote-icon">{{ getVoteIcon(votes[user.id]) }}</span>
          <span v-if="getVoteDisplay(votes[user.id])">{{ getVoteDisplay(votes[user.id]) }}</span>
        </div>
      </div>
    </div>

    <div class="statistics" v-if="hasVotes">
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
  }
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
</script>

<style scoped>
.results-display {
  text-align: center;
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


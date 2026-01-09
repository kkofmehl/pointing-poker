<template>
  <div class="card-selector">
    <h2>Select Your Estimate</h2>
    <div class="cards-grid">
      <button
        v-for="card in cardConfig"
        :key="card.value"
        @click="selectCard(card.value)"
        :class="['card', { 'selected': selectedCard === card.value }]"
        :style="{
          backgroundColor: getCardColor(card.value),
          borderColor: getCardColor(card.value)
        }"
        :disabled="disabled"
      >
        <span v-if="card.icon" class="card-icon">{{ card.icon }}</span>
        <span v-if="card.label" class="card-label">{{ card.label }}</span>
      </button>
    </div>
    <div v-if="selectedCard !== null" class="selected-info">
      <p>Selected: <strong>{{ getSelectedCardLabel() }}</strong></p>
      <button @click="submitVote" class="btn btn-submit" :disabled="disabled || submitting">
        {{ submitting ? 'Submitting...' : 'Submit Vote' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { CARD_CONFIG, getCardColor, getCardConfig } from '../config/cards.js';

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  initialSelected: {
    type: [Number, String, null],
    default: null
  }
});

const emit = defineEmits(['vote-submitted']);

const cardConfig = CARD_CONFIG;
const selectedCard = ref(props.initialSelected);
const submitting = ref(false);

function selectCard(value) {
  if (!props.disabled) {
    selectedCard.value = value;
  }
}

function submitVote() {
  if (selectedCard.value === null || props.disabled || submitting.value) {
    return;
  }

  submitting.value = true;
  emit('vote-submitted', selectedCard.value);
  
  // Reset submitting state after a short delay
  setTimeout(() => {
    submitting.value = false;
  }, 500);
}

function getSelectedCardLabel() {
  const card = getCardConfig(selectedCard.value);
  if (card) {
    if (card.icon && !card.label) {
      return card.icon;
    }
    return card.icon ? `${card.icon} ${card.label}` : card.label;
  }
  return selectedCard.value;
}
</script>

<style scoped>
.card-selector {
  text-align: center;
}

h2 {
  color: white;
  margin-bottom: 24px;
  font-size: 1.5rem;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 16px;
  max-width: 800px;
  margin: 0 auto 24px;
}

.card {
  aspect-ratio: 2/3;
  background: white;
  border: 3px solid #e0e0e0;
  border-radius: 12px;
  font-size: 2rem;
  font-weight: bold;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transform: scale(0.9);
}

.card-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.card-label {
  font-size: 2rem;
  line-height: 1;
}

.card:hover:not(:disabled):not(.selected) {
  transform: scale(0.9) translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  border-color: #d32f2f;
}

.card.selected:hover:not(:disabled) {
  transform: scale(1.1) translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.card.selected {
  border-width: 4px;
  transform: scale(1.1);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.4);
  color: white;
  filter: brightness(1.1);
}

.card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.selected-info {
  background: rgba(211, 47, 47, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(211, 47, 47, 0.2);
  padding: 20px;
  border-radius: 12px;
  margin-top: 24px;
}

.selected-info p {
  color: white;
  font-size: 1.1rem;
  margin-bottom: 16px;
}

.btn-submit {
  background: white;
  color: #d32f2f;
  padding: 12px 32px;
  font-size: 1rem;
  font-weight: 600;
  border: 2px solid #d32f2f;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-submit:hover:not(:disabled) {
  background: #f0f0f0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 12px;
  }
  
  .card-label {
    font-size: 1.5rem;
  }
  
  .card-icon {
    font-size: 2rem;
  }
}
</style>


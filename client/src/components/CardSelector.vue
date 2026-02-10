<template>
  <div class="card-selector">
    <h2>Select Your Estimate</h2>
    <p class="helper-text">All estimates will be displayed once everyone has submitted</p>
    <div 
      v-if="selectedCard !== null && !voted" 
      class="confidence-section"
    >
      <label class="confidence-label" for="confidence-slider">
        Confidence: <strong>{{ confidence }}</strong>/10
      </label>
      <input
        id="confidence-slider"
        type="range"
        min="1"
        max="10"
        step="1"
        v-model.number="confidence"
        :disabled="disabled || voted"
        class="confidence-slider"
      />
      <div class="confidence-scale">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
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
        :disabled="disabled || voted"
      >
        <span v-if="card.icon" class="card-icon">{{ card.icon }}</span>
        <span v-if="card.label" class="card-label">{{ card.label }}</span>
        <span
          v-if="selectedCard === card.value && !voted"
          class="card-helper-text"
        >
          Click again to submit this estimate
        </span>
      </button>
    </div>
    <div v-if="selectedCard !== null && !voted" class="selected-info">
      <p>Selected: <strong>{{ getSelectedCardLabel() }}</strong></p>
      <button @click="submitVote" class="btn btn-submit" :disabled="disabled || submitting">
        {{ submitting ? 'Submitting...' : 'Submit' }}
      </button>
    </div>
    <div v-if="voted" class="submission-success">
      <div class="success-message">
        <span class="checkmark">✓</span>
        <span>Vote submitted successfully!</span>
      </div>
      <button @click="handleUndo" class="btn btn-undo">
        Undo
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { CARD_CONFIG, getCardColor, getCardConfig } from '../config/cards.js';

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  initialSelected: {
    type: [Number, String, null],
    default: null
  },
  initialConfidence: {
    type: Number,
    default: 10
  }
});

const emit = defineEmits(['vote-submitted', 'vote-undo', 'card-selected']);

const cardConfig = CARD_CONFIG;
const selectedCard = ref(props.initialSelected);
const submitting = ref(false);
const voted = ref(!!props.initialSelected);
const isUndoing = ref(false);
const confidence = ref(props.initialConfidence || 10);

// Watch for changes to initialSelected (e.g., when vote is undone from parent)
watch(() => props.initialSelected, (newValue) => {
  // If we're in the process of undoing, don't update from props until undo is complete
  if (isUndoing.value) {
    return;
  }
  
  if (newValue === null) {
    selectedCard.value = null;
    voted.value = false;
    confidence.value = props.initialConfidence || 10;
    // Don't emit card-selected(null) here to avoid loops - parent handles this
  } else if (newValue !== selectedCard.value) {
    selectedCard.value = newValue;
    voted.value = true;
  }
});

function selectCard(value) {
  if (props.disabled || voted.value) {
    return;
  }
  
  // If the same card is clicked again, submit the vote
  if (selectedCard.value === value && !voted.value) {
    submitVote();
  } else {
    // Different card or first selection
    selectedCard.value = value;
    emit('card-selected', value);
  }
}

function submitVote() {
  if (selectedCard.value === null || props.disabled || submitting.value || voted.value) {
    return;
  }

  submitting.value = true;
  emit('vote-submitted', {
    cardValue: selectedCard.value,
    confidence: confidence.value || 10
  });
  
  // Mark as voted after a short delay
  setTimeout(() => {
    submitting.value = false;
    voted.value = true;
  }, 500);
}

function handleUndo() {
  // Allow undo even when component is disabled (user has voted)
  isUndoing.value = true;
  voted.value = false;
  selectedCard.value = null;
  confidence.value = props.initialConfidence || 10;
  emit('vote-undo');
  emit('card-selected', null); // Clear selection tracking
  
  // Reset isUndoing flag after a short delay to allow server response
  setTimeout(() => {
    isUndoing.value = false;
  }, 1000);
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
  margin-bottom: 8px;
  font-size: 1.5rem;
}

.helper-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  margin-bottom: 24px;
}

.confidence-section {
  max-width: 600px;
  margin: 0 auto 24px;
  text-align: left;
}

.confidence-label {
  display: block;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
  margin-bottom: 8px;
}

.confidence-slider {
  width: 100%;
  accent-color: #ffd54f;
}

.confidence-scale {
  display: flex;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  margin-top: 4px;
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

.card-helper-text {
  font-size: 0.7rem;
  font-weight: 500;
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
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

.submission-success {
  background: rgba(76, 175, 80, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(76, 175, 80, 0.3);
  padding: 20px;
  border-radius: 12px;
  margin-top: 24px;
}

.success-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #4caf50;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.checkmark {
  font-size: 1.5rem;
  color: #4caf50;
  font-weight: bold;
}

.btn-undo {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 10px 24px;
  font-size: 0.95rem;
  font-weight: 600;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-undo:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.8);
  transform: translateY(-2px);
}

.btn-undo:disabled {
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


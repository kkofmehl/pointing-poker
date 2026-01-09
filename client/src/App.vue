<template>
  <div id="app">
    <SessionJoin v-if="!joined" @joined="handleJoined" />
    <VotingRoom
      v-else
      :session-id="sessionId"
      :user-name="userName"
      :initial-session-state="sessionState"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import SessionJoin from './components/SessionJoin.vue';
import VotingRoom from './components/VotingRoom.vue';

const joined = ref(false);
const sessionId = ref('');
const userName = ref('');
const sessionState = ref({});

function handleJoined(data) {
  sessionId.value = data.sessionId;
  userName.value = data.userName;
  sessionState.value = data.sessionState;
  joined.value = true;
}
</script>

<style>
#app {
  min-height: 100vh;
}
</style>


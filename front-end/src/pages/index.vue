<script setup lang="ts">
import { definePageMeta } from '#app/composables/pages'
import ChessGame from '~/components/ChessGame.vue'
import DarkToggle from '~/components/DarkToggle.vue'

definePageMeta({
  layout: 'home',
})
</script>

<template>
  <div class="chess-page">
    <a class="skip-link" href="#game">Skip to the game</a>
    <header class="site-header">
      <div>
        <h1>Jacob Anderson Chess</h1>
      </div>
      <DarkToggle />
    </header>

    <ChessGame />
  </div>
</template>

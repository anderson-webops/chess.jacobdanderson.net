<script setup lang="ts">
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

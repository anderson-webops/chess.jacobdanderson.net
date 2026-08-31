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
        <p class="eyebrow">
          Jacob Anderson Chess
        </p>
        <h1>Chess, your way.</h1>
        <p class="lede">
          Use the board or play entirely in notation. Share the device with a friend or challenge the computer.
        </p>
      </div>
      <DarkToggle />
    </header>

    <ChessGame />
  </div>
</template>

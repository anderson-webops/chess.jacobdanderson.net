<script setup lang="ts">
import Footer from '~/components/Footer.vue'
</script>

<template>
  <div class="site-frame">
    <main id="main-content">
      <slot />
    </main>
    <Footer />
  </div>
</template>

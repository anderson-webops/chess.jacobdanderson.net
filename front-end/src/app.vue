<script setup lang="ts">
import { appDescription, appName } from '~/constants'

const canonicalUrl = 'https://chess.jacobdanderson.net/'

useHead({
  title: appName,
  htmlAttrs: {
    lang: 'en',
  },
  link: [
    { href: canonicalUrl, rel: 'canonical' },
  ],
})

useSeoMeta({
  description: appDescription,
  ogDescription: appDescription,
  ogImage: `${canonicalUrl}og.png`,
  ogImageAlt: 'Jacob Anderson Chess: Board or notation. Friend or computer.',
  ogSiteName: appName,
  ogTitle: appName,
  ogType: 'website',
  ogUrl: canonicalUrl,
  title: appName,
  twitterCard: 'summary_large_image',
  twitterDescription: appDescription,
  twitterImage: `${canonicalUrl}og.png`,
  twitterTitle: appName,
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

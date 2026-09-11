<template><section class="metric-strip"><div v-for="item in items" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.note }}</small></div></section></template>
<script setup lang="ts">defineProps<{ items: { label: string; value: string | number; note?: string }[] }>();</script>

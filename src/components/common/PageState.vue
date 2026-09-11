<template><div :class="['page-state', type]"><component :is="icon" /><strong>{{ title }}</strong><p v-if="description">{{ description }}</p><t-button v-if="retry" theme="primary" variant="outline" @click="retry">重试</t-button></div></template>
<script setup lang="ts">
import { computed } from "vue"; import { AppIcon, ErrorCircleIcon, LoadingIcon } from "tdesign-icons-vue-next";
const props = defineProps<{ type: "loading" | "error" | "empty"; title: string; description?: string; retry?: () => void }>();
const icon = computed(() => props.type === "loading" ? LoadingIcon : props.type === "error" ? ErrorCircleIcon : AppIcon);
</script>

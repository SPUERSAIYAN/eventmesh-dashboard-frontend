<template><t-config-provider :global-config="config"><AppShell /></t-config-provider></template>

<script setup lang="ts">
import { computed } from "vue";
import enConfig from "tdesign-vue-next/es/locale/en_US";
import zhConfig from "tdesign-vue-next/es/locale/zh_CN";
import AppShell from "./layouts/AppShell.vue";
import { useI18n } from "./composables/useI18n";
const { language } = useI18n();
const config = computed(() => language.value === "zh" ? zhConfig : enConfig);
</script>

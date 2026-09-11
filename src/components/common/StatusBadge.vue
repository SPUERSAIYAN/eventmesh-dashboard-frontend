<template><span :class="['status-badge', tone]"><component :is="icon" /><span><strong>{{ text }}</strong><small v-if="code">{{ code }}</small></span></span></template>
<script setup lang="ts">
import { computed } from "vue";
import { CheckCircleIcon, ErrorCircleIcon, HelpCircleIcon, TimeIcon } from "tdesign-icons-vue-next";
const props = defineProps<{ value?: string; label?: string; code?: string }>();
const normalized = computed(() => String(props.value ?? "unknown").toLowerCase());
const tone = computed(() => /healthy|normal|success|online|create_success|reset_success|pause_success/.test(normalized.value) ? "normal" : /warn|wait|ing|pause/.test(normalized.value) ? "warning" : /error|fail|uninstall/.test(normalized.value) ? "abnormal" : "unknown");
const icon = computed(() => tone.value === "normal" ? CheckCircleIcon : tone.value === "warning" ? TimeIcon : tone.value === "abnormal" ? ErrorCircleIcon : HelpCircleIcon);
const text = computed(() => props.label ?? ({ normal: "正常", warning: "处理中", abnormal: "异常", unknown: "未知" } as any)[tone.value]);
</script>

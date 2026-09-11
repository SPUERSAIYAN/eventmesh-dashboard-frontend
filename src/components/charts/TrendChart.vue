<template><div class="trend-wrap"><div ref="host" class="trend-chart" /><PageState v-if="input.status === 'loading'" type="loading" title="正在加载趋势" /><PageState v-else-if="input.status === 'error' || state === 'error'" type="error" title="趋势图加载失败" :retry="refresh" /><PageState v-else-if="!hasData" type="empty" title="暂无趋势数据" /></div></template>
<script setup lang="ts">
import { ref } from "vue"; import PageState from "../common/PageState.vue"; import { useG2Chart, type TrendChartInput } from "../../composables/useG2Chart";
const props = defineProps<{ input: TrendChartInput }>(); const host = ref<HTMLElement | null>(null); const { state, hasData, refresh } = useG2Chart(host, () => props.input);
</script>

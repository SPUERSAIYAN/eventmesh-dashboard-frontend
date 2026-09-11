import { computed, readonly, ref } from "vue";

export type Language = "zh" | "en";
const initial = (): Language => {
  if (typeof window === "undefined") return "zh";
  const saved = window.localStorage.getItem("eventmesh-language");
  if (saved === "zh" || saved === "en") return saved;
  return window.navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
};

const language = ref<Language>(initial());
const messages: Record<string, string> = {
  "全部集群": "All clusters", "工作台": "Workbench", "全部资源": "All resources",
  "全局": "Global", "组织": "Organization", "搜索集群、Topic 或操作": "Search clusters, topics or operations",
  "刷新": "Refresh", "本地时间": "Local time", "概览": "Overview", "概要": "Summary",
  "集群拓扑": "Cluster topology", "关联列表": "Relations", "集群列表": "Clusters",
  "客户端连接": "Client connections", "连接列表": "Connections", "操作记录": "Operations",
  "存储集群": "Storage clusters", "运行时集群": "Runtime clusters", "暂无数据": "No data",
  "加载失败": "Failed to load", "重试": "Retry", "搜索": "Search", "状态": "Status",
  "操作": "Actions", "版本": "Version", "地域": "Region", "返回全部集群": "Back to all clusters",
};

function t(value: string) { return language.value === "zh" ? value : (messages[value] ?? value); }
function toggleLanguage() {
  language.value = language.value === "zh" ? "en" : "zh";
  if (typeof window !== "undefined") window.localStorage.setItem("eventmesh-language", language.value);
}

export function useI18n() {
  return { language: readonly(language), locale: computed(() => language.value === "zh" ? "zh-CN" : "en-US"), t, toggleLanguage };
}

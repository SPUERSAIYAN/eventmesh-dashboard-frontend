<template>
  <div :class="['app-shell', { 'with-sidebar': inCluster, collapsed }]">
    <aside v-if="inCluster" class="sidebar">
      <button class="brand" aria-label="EventMesh home" @click="router.push('/clusters')"><img :src="logo" alt="EventMesh" /></button>
      <nav class="side-nav" aria-label="Cluster navigation">
        <div class="cluster-caption">{{ clusterId }}</div>
        <template v-for="group in groups" :key="group.key">
          <button :class="['nav-parent', { active: groupActive(group) }]" @click="openGroup(group)">
            <component :is="group.icon" /><span>{{ t(group.label) }}</span><ChevronDownIcon v-if="group.children" :class="{ open: expanded.has(group.key) }" />
          </button>
          <div v-if="group.children && expanded.has(group.key) && !collapsed" class="nav-children">
            <button v-for="child in group.children" :key="child.label" :class="{ active: childActive(group, child) }" @click="openChild(group, child)">{{ t(child.label) }}</button>
          </div>
        </template>
      </nav>
      <button class="collapse" @click="collapsed = !collapsed"><ViewListIcon /><span>{{ collapsed ? '展开' : '收起' }}</span></button>
    </aside>

    <header class="topbar">
      <div class="top-brand"><button @click="router.push('/clusters')"><img :src="headerLogo" alt="EventMesh" /></button><button @click="router.push('/clusters')"><HomeIcon />{{ t('工作台') }}</button><button @click="router.push('/clusters')"><ServerIcon />{{ t('全部资源') }}</button></div>
      <t-input v-model="search" clearable class="global-search" :placeholder="t('搜索集群、Topic 或操作')" @enter="submitSearch"><template #prefix-icon><SearchIcon /></template></t-input>
      <div class="top-actions"><span><GlobeIcon />{{ t('全局') }}</span><span><DataBaseIcon />{{ t('组织') }} #{{ organizationId }}</span><t-button variant="outline" size="small" @click="toggleLanguage">{{ language === 'zh' ? 'EN' : '中' }}</t-button></div>
    </header>

    <main class="workspace">
      <div class="breadcrumb"><button @click="router.push('/clusters')">{{ t('全部集群') }}</button><template v-if="inCluster"><span>/</span><strong>{{ clusterId }}</strong></template></div>
      <router-view />
    </main>
    <footer class="statusbar"><span class="status-source"><CheckCircleIcon />混合数据模式 · 实时数据与模拟操作均明确标注</span><span>{{ t('本地时间') }} {{ nowText }}</span><button @click="refresh"><RefreshIcon />{{ t('刷新') }}</button></footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import { CheckCircleIcon, ChevronDownIcon, DataBaseIcon, DashboardIcon, EarthIcon, HomeIcon, LinkIcon, RefreshIcon, SearchIcon, ServerIcon, TreeRoundDotIcon, UsergroupIcon, ViewListIcon } from "tdesign-icons-vue-next";
import logo from "../assets/eventmesh-logo.svg";
import headerLogo from "../assets/eventmesh-header-logo.png";
import { apiConfig } from "../api/config";
import { useI18n } from "../composables/useI18n";

const route = useRoute(); const router = useRouter(); const queryClient = useQueryClient();
const { t, language, toggleLanguage, locale } = useI18n();
const GlobeIcon = EarthIcon;
const organizationId = apiConfig.organizationId; const collapsed = ref(false); const search = ref(String(route.query.search ?? ""));
const expanded = ref(new Set(["eventmesh", "runtime", "meta", "storage", "topics", "connections"]));
const inCluster = computed(() => Boolean(route.params.clusterId)); const clusterId = computed(() => String(route.params.clusterId ?? ""));
const now = ref(new Date()); const timer = window.setInterval(() => now.value = new Date(), 1000); onBeforeUnmount(() => clearInterval(timer));
const nowText = computed(() => now.value.toLocaleString(locale.value, { hour12: false }));
const groups: any[] = [
  { key: "summary", label: "概览", icon: DashboardIcon, view: "summary" },
  { key: "eventmesh", label: "EventMesh 集群", icon: ServerIcon, children: [{ label: "概要", view: "overview" }, { label: "集群拓扑", view: "topology" }, { label: "关联列表", view: "relations" }] },
  { key: "runtime", label: "Runtime 集群", icon: TreeRoundDotIcon, children: [{ label: "概要", view: "runtime", section: "overview" }, { label: "集群列表", view: "runtime", section: "clusters" }, { label: "关联列表", view: "runtime", section: "relations" }] },
  { key: "meta", label: "Meta 集群", icon: DataBaseIcon, children: [{ label: "概要", view: "meta", section: "overview" }, { label: "集群列表", view: "meta", section: "clusters" }, { label: "关联列表", view: "meta", section: "relations" }] },
  { key: "storage", label: "存储集群", icon: ServerIcon, children: [{ label: "概要", view: "storage", section: "overview" }, { label: "Kafka 集群", view: "storage", section: "kafka" }, { label: "RocketMQ 集群", view: "storage", section: "rocketmq" }, { label: "关联列表", view: "storage", section: "relations" }] },
  { key: "topics", label: "Topics", icon: TreeRoundDotIcon, children: [{ label: "概览", view: "topics", section: "overview" }, { label: "Topic 列表", view: "topics", section: "list" }] },
  { key: "connections", label: "客户端连接", icon: LinkIcon, children: [{ label: "概览", view: "connections", section: "overview" }, { label: "连接列表", view: "connections", section: "list" }] },
  { key: "consumers", label: "Consumer", icon: UsergroupIcon, view: "consumers" }, { key: "operations", label: "Operations", icon: ViewListIcon, view: "operations" },
];
function section() { return String(route.query.section ?? "overview"); }
function groupActive(group: any) { return group.view === route.params.view || group.children?.some((c: any) => c.view === route.params.view); }
function childActive(group: any, child: any) { return child.view === route.params.view && (child.section ?? "overview") === section(); }
function go(view: string, childSection?: string) { router.push({ path: `/clusters/${encodeURIComponent(clusterId.value)}/${view}`, query: childSection && childSection !== "overview" ? { section: childSection } : {} }); }
function openGroup(group: any) { if (!group.children) return go(group.view); if (collapsed.value) return go(group.children[0].view, group.children[0].section); const next = new Set(expanded.value); next.has(group.key) ? next.delete(group.key) : next.add(group.key); expanded.value = next; }
function openChild(_group: any, child: any) { go(child.view, child.section); }
function submitSearch() { router.push({ path: "/clusters", query: search.value.trim() ? { search: search.value.trim() } : {} }); }
async function refresh() { await queryClient.invalidateQueries(); }
</script>

import { defineStore } from "pinia";
import { mockClusters } from "../mock/mockClusterData";
const KEY = "eventmesh-mock-copy-state-v2";
function read() { try { const value = JSON.parse(localStorage.getItem(KEY) || "null"); return value && Array.isArray(value.tasks) && Array.isArray(value.copiedClusters) ? value : { tasks: [], copiedClusters: [] }; } catch { return { tasks: [], copiedClusters: [] }; } }
function copied(task: any) { return { ...task.sourceSnapshot, id: task.targetId, name: task.targetName, description: `从 ${task.sourceName} 复制创建的集群`, status: "healthy", uptime: "刚刚创建", cpu: 0, memory: 0, storage: 0, inRate: 0, outRate: 0, topics: task.topics, consumers: task.consumers }; }
export const useCopyTaskStore = defineStore("copy-tasks", {
  state: read,
  actions: {
    persist() { localStorage.setItem(KEY, JSON.stringify(this.$state)); },
    create(source: any, targetName: string) {
      const stamp = Date.now(); const safe = targetName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "eventmesh-copy";
      const ids = new Set([...mockClusters, ...this.copiedClusters].map((item: any) => item.id)); const targetId = ids.has(safe) ? `${safe}-${String(stamp).slice(-5)}` : safe;
      const task = { id: `copy-${stamp}`, targetId, createdAt: new Date().toISOString(), progress: 8, sourceName: source.name, targetName: targetName.trim(), topicCount: source.topics?.length ?? 0, consumerCount: source.consumers?.length ?? 0, runtimes: source.runtimes ?? 0, metaNodes: source.metaNodes ?? 0, topics: [...(source.topics ?? [])], consumers: [...(source.consumers ?? [])], sourceSnapshot: { ...source }, operation: "copy" };
      this.tasks = [task, ...this.tasks]; this.persist(); return task;
    },
    tick() {
      let changed = false; this.tasks = this.tasks.map((task: any) => task.progress >= 100 ? task : (changed = true, { ...task, progress: Math.min(100, task.progress + 8) }));
      this.tasks.forEach((task: any) => { if (task.progress >= 100 && !this.copiedClusters.some((item: any) => item.id === task.targetId)) { this.copiedClusters.unshift(copied(task)); changed = true; } });
      if (changed) this.persist();
    },
  },
});

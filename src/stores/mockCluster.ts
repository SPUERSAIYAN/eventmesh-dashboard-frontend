import { defineStore } from "pinia";
import {
  MOCK_RELATION_STORAGE_KEY, addClusterRelations, defaultMockRelationState, inheritClusterRelations,
  normalizeMockRelationState, removeClusterRelation,
} from "../mock/mockClusterRelations";
import {
  MOCK_WRITABLE_RESOURCE_KEY, addWritableConsumer, addWritableNode, addWritablePhysicalTopic,
  addWritableTopic, defaultWritableResourceState, normalizeWritableResourceState,
} from "../mock/mockWritableResources";

function read<T>(key: string, fallback: () => T, normalize: (value: unknown) => T): T {
  if (typeof window === "undefined") return fallback();
  try { return normalize(JSON.parse(window.localStorage.getItem(key) || "null")); } catch { return fallback(); }
}

export const useMockClusterStore = defineStore("mock-cluster", {
  state: () => ({
    relationsState: read(MOCK_RELATION_STORAGE_KEY, defaultMockRelationState, normalizeMockRelationState),
    resources: read(MOCK_WRITABLE_RESOURCE_KEY, defaultWritableResourceState, normalizeWritableResourceState),
  }),
  getters: { relations: (state) => state.relationsState.relations },
  actions: {
    persist() {
      window.localStorage.setItem(MOCK_RELATION_STORAGE_KEY, JSON.stringify(this.relationsState));
      window.localStorage.setItem(MOCK_WRITABLE_RESOURCE_KEY, JSON.stringify(this.resources));
    },
    addRelations(eventMeshClusterId: string, ids: string[], type?: any) { this.relationsState = addClusterRelations(this.relationsState, eventMeshClusterId, ids, new Date().toISOString(), type); this.persist(); },
    removeRelation(id: string) { this.relationsState = removeClusterRelation(this.relationsState, id); this.persist(); },
    inheritRelations(source: string, target: string) { this.relationsState = inheritClusterRelations(this.relationsState, source, target); this.persist(); },
    addNode(item: any) { this.resources = addWritableNode(this.resources, item); this.persist(); },
    addTopic(item: any) { this.resources = addWritableTopic(this.resources, item); this.persist(); },
    addPhysicalTopic(item: any) { this.resources = addWritablePhysicalTopic(this.resources, item); this.persist(); },
    addConsumer(item: any) { this.resources = addWritableConsumer(this.resources, item); this.persist(); },
  },
});

import { useSyncExternalStore } from "react";
import {
  MOCK_RELATION_STORAGE_KEY,
  addClusterRelations,
  defaultMockRelationState,
  inheritClusterRelations,
  normalizeMockRelationState,
  removeClusterRelation,
  type MockRelationState,
} from "../mock/mockClusterRelations";
import {
  MOCK_WRITABLE_RESOURCE_KEY,
  addWritableConsumer,
  addWritableNode,
  addWritablePhysicalTopic,
  addWritableTopic,
  defaultWritableResourceState,
  normalizeWritableResourceState,
} from "../mock/mockWritableResources";

export type MockClusterStoreState = {
  relations: MockRelationState;
  resources: ReturnType<typeof defaultWritableResourceState>;
};

function readStorage<T>(key: string, fallback: () => T, normalize: (value: unknown) => T): T {
  if (typeof window === "undefined") return fallback();
  try { return normalize(JSON.parse(window.localStorage.getItem(key) || "null")); }
  catch { return fallback(); }
}

function initialState(): MockClusterStoreState {
  return {
    relations: readStorage(MOCK_RELATION_STORAGE_KEY, defaultMockRelationState, normalizeMockRelationState),
    resources: readStorage(MOCK_WRITABLE_RESOURCE_KEY, defaultWritableResourceState, normalizeWritableResourceState),
  };
}

let state = initialState();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function commit(next: MockClusterStoreState) {
  if (next === state) return;
  state = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MOCK_RELATION_STORAGE_KEY, JSON.stringify(state.relations));
    window.localStorage.setItem(MOCK_WRITABLE_RESOURCE_KEY, JSON.stringify(state.resources));
  }
  emit();
}

function updateRelations(producer: (current: MockRelationState) => MockRelationState) {
  const relations = producer(state.relations);
  if (relations !== state.relations) commit({ ...state, relations });
}

function updateResources(producer: (current: MockClusterStoreState["resources"]) => MockClusterStoreState["resources"]) {
  const resources = producer(state.resources);
  if (resources !== state.resources) commit({ ...state, resources });
}

export const mockClusterStore = {
  getState: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  addRelations(eventMeshClusterId: string, componentIds: string[]) { updateRelations((current) => addClusterRelations(current, eventMeshClusterId, componentIds)); },
  removeRelation(relationId: string) { updateRelations((current) => removeClusterRelation(current, relationId)); },
  inheritRelations(sourceId: string, targetId: string) { updateRelations((current) => inheritClusterRelations(current, sourceId, targetId)); },
  addNode(item: unknown) { updateResources((current) => addWritableNode(current, item)); },
  addTopic(item: unknown) { updateResources((current) => addWritableTopic(current, item)); },
  addPhysicalTopic(item: unknown) { updateResources((current) => addWritablePhysicalTopic(current, item)); },
  addConsumer(item: unknown) { updateResources((current) => addWritableConsumer(current, item)); },
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== MOCK_RELATION_STORAGE_KEY && event.key !== MOCK_WRITABLE_RESOURCE_KEY) return;
    state = initialState();
    emit();
  });
}

export function useMockClusterStore() {
  const snapshot = useSyncExternalStore(mockClusterStore.subscribe, mockClusterStore.getState, mockClusterStore.getState);
  return { ...snapshot, ...mockClusterStore };
}

export function useMockRelations() {
  const store = useMockClusterStore();
  return { relations: store.relations.relations, addRelations: store.addRelations, removeRelation: store.removeRelation, inheritRelations: store.inheritRelations };
}

export function useMockWritableResources() {
  const store = useMockClusterStore();
  return { state: store.resources, addNode: store.addNode, addTopic: store.addTopic, addPhysicalTopic: store.addPhysicalTopic, addConsumer: store.addConsumer };
}

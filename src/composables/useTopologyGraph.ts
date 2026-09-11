import { onBeforeUnmount, onMounted, shallowRef, watch, type Ref } from "vue";
export function useTopologyGraph(host: Ref<HTMLElement | null>, data: Ref<any>, onSelect: (node: any) => void) {
  const error = shallowRef<Error | null>(null); let graph: any; let observer: ResizeObserver | undefined; let revision = 0;
  async function render() {
    const target = host.value; if (!target) return; const token = ++revision;
    try {
      const { Graph } = await import("@antv/g6"); if (token !== revision || !host.value) return;
      if (!graph) {
        graph = new Graph({ container: target, autoFit: "view", padding: 36, data: data.value,
          layout: { type: "dagre", rankdir: "LR", nodesep: 34, ranksep: 95 },
          node: { style: { size: [176, 64], radius: 2, fill: "#f8fbfe", stroke: "#8da9c4", lineWidth: 1, labelText: (d: any) => d.data.label, labelFill: "#203247", labelFontSize: 12, labelFontWeight: 600, labelWordWrap: true, labelMaxWidth: 148 } },
          edge: { style: { stroke: (d: any) => d.data?.color ?? "#225aa0", lineWidth: 1.5, lineDash: [7, 5], endArrow: true }, animation: { enter: false, update: false, exit: false } },
          behaviors: ["drag-canvas", "zoom-canvas", "drag-element", "hover-activate"],
        });
        graph.on("node:click", (event: any) => onSelect(event.target?.data ?? event.item?.data ?? event.target));
        observer = new ResizeObserver(() => graph?.resize()); observer.observe(target);
        await graph.render();
      } else { graph.setData(data.value); await graph.render(); graph.fitView(); }
      error.value = null;
    } catch (cause) { error.value = cause instanceof Error ? cause : new Error(String(cause)); }
  }
  onMounted(render); watch(data, render, { deep: false }); onBeforeUnmount(() => { revision++; observer?.disconnect(); graph?.destroy(); graph = undefined; });
  return { error, refresh: render };
}

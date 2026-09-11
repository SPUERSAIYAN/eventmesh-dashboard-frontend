import { computed, onBeforeUnmount, onMounted, readonly, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import type { Chart } from '@antv/g2';
import { buildTrendOptions, hasTrendData, readTrendColors } from '../components/charts/trendChartOptions';
import type { TrendChartInput } from '../components/charts/trendChartOptions';

export type { TrendChartInput, TrendPoint } from '../components/charts/trendChartOptions';
export type G2ChartState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Call in setup. Points are immutable snapshots (replace the array to update).
 * A host owns one non-reactive Chart. Input/resize bursts are coalesced per frame,
 * renders are serialized, and obsolete async completions never publish state.
 */
export function useG2Chart(
  container: Readonly<Ref<HTMLElement | null>>,
  input: MaybeRefOrGetter<TrendChartInput>,
) {
  const state = shallowRef<G2ChartState>('idle');
  const error = shallowRef<Error | null>(null);
  const hasData = computed(() => hasTrendData(toValue(input).points));
  const enabled = () => toValue(input).status === 'ready' && hasData.value;
  let mounted = false;
  let session: ReturnType<typeof createSession> | undefined;

  function createSession(host: HTMLElement) {
    let chart: Chart | undefined;
    let observer: ResizeObserver | undefined;
    let frame: number | undefined;
    let running = false;
    let disposed = false;
    let dirty = false;
    let revision = 0;
    let observedWidth = -1;
    let observedHeight = -1;

    function destroy() {
      const instance = chart;
      chart = undefined;
      instance?.destroy();
    }

    function queue() {
      if (disposed || running || frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        void renderLatest();
      });
    }

    function update() {
      if (disposed) return;
      revision++;
      dirty = true;
      error.value = null;
      state.value = enabled() ? 'loading' : 'idle';
      queue();
    }

    async function renderLatest() {
      if (disposed || running || !dirty) return;
      dirty = false;
      if (!enabled()) return;
      // Read layout once per frame, before G2 performs any DOM writes.
      const { width: rawWidth, height: rawHeight } = host.getBoundingClientRect();
      const width = Math.floor(rawWidth);
      const height = Math.floor(rawHeight);
      observedWidth = width;
      observedHeight = height;
      if (width <= 0 || height <= 0) return;
      running = true;
      const token = revision;
      const current = () => !disposed && token === revision;
      try {
        if (!chart) {
          const { Chart } = await import('@antv/g2');
          // import() cannot be aborted; cancel its effects instead.
          if (!current() || !enabled()) return;
          chart = new Chart({ container: host, width, height, autoFit: false });
        }
        const { points, unit } = toValue(input);
        chart.options({
          ...buildTrendOptions(points, unit, readTrendColors(host)),
          width,
          height,
        });
        await chart.render();
        if (current()) state.value = 'ready';
      } catch (cause) {
        if (current()) {
          error.value = cause instanceof Error ? cause : new Error(String(cause));
          state.value = 'error';
        }
      } finally {
        running = false;
        // G2 5.4.x may leave render pending forever if destroyed mid-render.
        // Retire immediately, but release the canvas after the in-flight work settles.
        if (disposed) destroy();
        else if (dirty) queue();
      }
    }

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        if (disposed) return;
        const entry = entries.find((item) => item.target === host);
        if (!entry) return;
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (width === observedWidth && height === observedHeight) return;
        observedWidth = width;
        observedHeight = height;
        update();
      });
      observer.observe(host);
    } else {
      window.addEventListener('resize', update, { passive: true });
    }
    update();
    return {
      update,
      dispose() {
        if (disposed) return;
        disposed = true;
        revision++;
        dirty = false;
        if (frame !== undefined) cancelAnimationFrame(frame);
        observer?.disconnect();
        window.removeEventListener('resize', update);
        if (!running) destroy();
      },
    };
  }

  function attach(host: HTMLElement | null) {
    session?.dispose();
    session = undefined;
    error.value = null;
    state.value = 'idle';
    if (host) session = createSession(host);
  }

  // No deep watcher: large time series do not need recursive proxy traversal.
  const stopInput = watch(
    () => [toValue(input).points, toValue(input).unit, toValue(input).status],
    () => session?.update(),
    { flush: 'sync' },
  );
  const stopContainer = watch(container, (host) => {
    if (mounted) attach(host);
  }, { flush: 'post' });

  onMounted(() => {
    mounted = true;
    attach(container.value);
  });
  onBeforeUnmount(() => {
    mounted = false;
    stopInput();
    stopContainer();
    session?.dispose();
    session = undefined;
  });

  return {
    state: readonly(state),
    error: readonly(error),
    hasData,
    /** Retry a failed import/render, or re-read theme variables. */
    refresh: () => session?.update(),
  };
}

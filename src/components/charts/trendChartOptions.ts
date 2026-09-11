import type { G2Spec } from '@antv/g2';

export interface TrendPoint {
  time: string;
  series: string;
  value: number | null;
}

export interface TrendChartInput {
  /** Replace the array when updating; time categories retain first-seen order. */
  points: readonly TrendPoint[];
  unit: string;
  source: 'mock' | 'live';
  status: 'ready' | 'loading' | 'error';
}

export const trendColors = {
  primary: '#225aa0',
  cyan: '#4cb6d4',
  muted: '#5f7388',
  border: '#d4e1ef',
};

export type TrendColors = typeof trendColors;

export function readTrendColors(element: HTMLElement): TrendColors {
  const style = getComputedStyle(element);
  return Object.fromEntries(
    Object.entries(trendColors).map(([name, fallback]) => [
      name,
      style.getPropertyValue(`--em-${name}`).trim() || fallback,
    ]),
  ) as TrendColors;
}

export function hasTrendData(points: readonly TrendPoint[]): boolean {
  return points.some((point) => Number.isFinite(point.value));
}

export function formatTrendValue(value: number | null, unit: string): string {
  if (!Number.isFinite(value)) return '—';
  return unit ? `${value} ${unit}` : String(value);
}

/** Native G2 grammar, not an ECharts option adapter. No stacking or null filling. */
export function buildTrendOptions(
  points: readonly TrendPoint[],
  unit: string,
  colors: TrendColors = trendColors,
): G2Spec {
  // Own the rows passed to G2; never let rendering mutate caller-owned data.
  const data = points.map(({ time, series, value }) => ({
    time,
    series,
    value: Number.isFinite(value) ? value : null,
  }));
  const encode = { x: 'time', y: 'value', color: 'series', shape: 'smooth' };
  return {
    type: 'view',
    autoFit: false,
    animate: false,
    data,
    paddingLeft: 56,
    paddingRight: 20,
    paddingTop: 40,
    paddingBottom: 32,
    scale: {
      x: { type: 'point', domain: [...new Set(data.map((point) => point.time))] },
      // Explicit unknown prevents any numeric coercion of null into zero.
      y: { type: 'linear', nice: true, zero: true, unknown: Number.NaN },
      color: {
        type: 'ordinal',
        domain: [...new Set(data.map((point) => point.series))],
        range: [colors.primary, colors.cyan, colors.muted],
      },
    },
    axis: {
      x: { title: false, labelFill: colors.muted, line: true, lineStroke: colors.border, tick: false },
      y: { title: unit || false, titleFill: colors.muted, labelFill: colors.muted, gridStroke: colors.border },
    },
    legend: {
      color: { position: 'top', layout: { justifyContent: 'flex-end' }, title: false, itemLabelFill: colors.muted },
    },
    interaction: { tooltip: { shared: true, crosshairs: true }, legendFilter: true },
    children: [
      {
        type: 'area',
        encode,
        style: { fillOpacity: 0.05, connect: false },
        // Areas share line values; do not duplicate tooltip entries.
        tooltip: false,
        animate: false,
      },
      {
        type: 'line',
        encode,
        style: { lineWidth: 2, connect: false },
        tooltip: {
          title: 'time',
          items: [(point: TrendPoint) => ({
            name: point.series,
            value: formatTrendValue(point.value, unit),
          })],
        },
        animate: false,
      },
    ],
  };
}

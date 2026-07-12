import { stats as S } from "./statistics";

export interface ChartLike { destroy(): void; canvas: HTMLCanvasElement; width: number }
type ChartConstructor = new (canvas: HTMLCanvasElement, config: Record<string, unknown>) => ChartLike;
declare global { interface Window { Chart?: ChartConstructor } }

const instances = new Map<string, ChartLike>();
export interface Palette { text: string; muted: string; grid: string; primary: string; accent: string; warning: string; surface: string }

export function colors(): Palette {
  const dark = document.documentElement.hasAttribute("dark") || document.documentElement.getAttribute("data-theme") === "dark";
  return dark
    ? { text: "#e5e5e5", muted: "#a3a3a3", grid: "rgba(255,255,255,.1)", primary: "#3ea6ff", accent: "#2ba640", warning: "#f4b400", surface: "#212121" }
    : { text: "#0f0f0f", muted: "#606060", grid: "rgba(0,0,0,.1)", primary: "#065fd4", accent: "#188038", warning: "#b06000", surface: "#ffffff" };
}

export function destroy(key: string): void { instances.get(key)?.destroy(); instances.delete(key); }
export function destroyAll(): void {
  instances.forEach((chart) => chart.destroy());
  instances.clear();
  document.querySelectorAll(".yt-outlier-chart-tooltip").forEach((node) => node.remove());
}

export function render(key: string, element: Element | null | undefined, config: Record<string, unknown>): ChartLike | null {
  destroy(key);
  const Chart = window.Chart;
  if (!(element instanceof HTMLCanvasElement) || !Chart) return null;
  const canvas = element;
  const palette = colors();
  const suppliedOptions = isRecord(config.options) ? config.options : {};
  const suppliedPlugins = isRecord(suppliedOptions.plugins) ? suppliedOptions.plugins : {};
  const legend = isRecord(suppliedPlugins.legend) ? suppliedPlugins.legend : {};
  const tooltip = isRecord(suppliedPlugins.tooltip) ? suppliedPlugins.tooltip : {};
  const chart = new Chart(canvas, {
    ...config,
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { intersect: false, mode: "nearest" }, ...suppliedOptions,
      plugins: {
        ...suppliedPlugins,
        legend: { labels: { color: palette.text, boxWidth: 12 }, ...legend },
        tooltip: { backgroundColor: palette.surface, titleColor: palette.text, bodyColor: palette.text, borderColor: palette.grid, borderWidth: 1, ...tooltip },
      },
      scales: buildScales(isRecord(suppliedOptions.scales) ? suppliedOptions.scales : {}, palette),
    },
  });
  instances.set(key, chart);
  return chart;
}

function buildScales(scales: Record<string, unknown>, palette: Palette): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, rawScale] of Object.entries(scales)) {
    const scale = isRecord(rawScale) ? rawScale : {};
    const ticks = isRecord(scale.ticks) ? scale.ticks : {};
    const grid = isRecord(scale.grid) ? scale.grid : {};
    const title = isRecord(scale.title) ? scale.title : {};
    output[key] = { ...scale,
      ticks: { color: palette.muted, callback: ticks.callback || ((value: unknown) => S.compactNumber(Number(value))), ...ticks },
      grid: { color: palette.grid, ...grid },
      title: { color: palette.muted, display: Boolean(title.text), ...title },
    };
  }
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export const charts = { render, destroy, destroyAll, colors };

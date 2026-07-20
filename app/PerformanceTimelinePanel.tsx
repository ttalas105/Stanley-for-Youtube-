"use client";

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import dashboardStyles from "./dashboard.module.css";

export type PerformancePoint = {
  date: string;
  views: number;
  watchMinutes: number;
  netSubscribers: number;
};

export type PerformanceUploadMarker = {
  id: string;
  title: string;
  index: number;
};

type ChartMetric = "views" | "watchMinutes" | "netSubscribers";
type PerformanceRange = 7 | 30 | 90 | 180 | 365;

type HoverState = {
  index: number;
  left: number;
  date: string;
  current: number;
  previous: number | null;
};

const dayFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const fullDateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
const smoothPath = uPlot.paths.spline ? uPlot.paths.spline() : undefined;
const performanceRanges: Array<{ value: PerformanceRange; label: string; short: string }> = [
  { value: 7, label: "Last 7 days", short: "7D" },
  { value: 30, label: "Last 30 days", short: "30D" },
  { value: 90, label: "Last 90 days", short: "90D" },
  { value: 180, label: "Last 6 months", short: "6M" },
  { value: 365, label: "Last year", short: "1Y" },
];

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: Math.abs(value) >= 1_000_000 ? 1 : 0 }).format(value);
}

function formatMetric(value: number, metric: ChartMetric) {
  if (metric === "watchMinutes") return `${compact(value / 60)} hrs`;
  if (metric === "netSubscribers") return `${value > 0 ? "+" : ""}${compact(Math.round(value))}`;
  return compact(value);
}

function metricLabel(metric: ChartMetric) {
  if (metric === "watchMinutes") return "Watch time";
  if (metric === "netSubscribers") return "Net subscribers";
  return "Views";
}

function toTimestamp(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1_000);
}

const FastTimeSeriesChart = memo(function FastTimeSeriesChart({
  timeline,
  comparisonTimeline,
  metric,
  uploadMarkers,
  selectedVideoId,
  onSelectUpload,
}: {
  timeline: PerformancePoint[];
  comparisonTimeline: PerformancePoint[];
  metric: ChartMetric;
  uploadMarkers: PerformanceUploadMarker[];
  selectedVideoId: string;
  onSelectUpload: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectUploadRef = useRef(onSelectUpload);
  const [hover, setHover] = useState<HoverState | null>(null);
  selectUploadRef.current = onSelectUpload;

  const alignedData = useMemo<uPlot.AlignedData>(() => {
    const timestamps = timeline.map((point) => toTimestamp(point.date));
    const previous = timeline.map((_, index) => comparisonTimeline[index]?.[metric] ?? null);
    const current = timeline.map((point) => point[metric]);
    return [timestamps, previous, current, current];
  }, [comparisonTimeline, metric, timeline]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !timeline.length) return;

    const timestamps = alignedData[0] as number[];
    const previousValues = alignedData[1] as Array<number | null>;
    const currentValues = alignedData[3] as number[];
    const pixelRatio = window.devicePixelRatio || 1;
    let markerHitZones: Array<{ id: string; x: number }> = [];

    const drawSignals = (chart: uPlot) => {
      const context = chart.ctx;
      const plotBottom = chart.bbox.top + chart.bbox.height;
      markerHitZones = [];
      context.save();
      for (const marker of uploadMarkers) {
        const timestamp = timestamps[marker.index];
        const value = currentValues[marker.index];
        if (timestamp === undefined || value === undefined) continue;
        const x = chart.valToPos(timestamp, "x", true);
        const y = chart.valToPos(value, "y", true);
        const selected = marker.id === selectedVideoId;
        markerHitZones.push({ id: marker.id, x: (x - chart.bbox.left) / pixelRatio });
        context.beginPath();
        context.setLineDash([2 * pixelRatio, 6 * pixelRatio]);
        context.strokeStyle = selected ? "rgba(166, 156, 255, .62)" : "rgba(93, 104, 126, .48)";
        context.lineWidth = pixelRatio;
        context.moveTo(x, y + 8 * pixelRatio);
        context.lineTo(x, plotBottom);
        context.stroke();
        context.setLineDash([]);
        context.shadowColor = "rgba(143, 128, 255, .75)";
        context.shadowBlur = selected ? 11 * pixelRatio : 6 * pixelRatio;
        context.beginPath();
        context.arc(x, y, (selected ? 5 : 3.5) * pixelRatio, 0, Math.PI * 2);
        context.fillStyle = selected ? "#a69cff" : "#101722";
        context.fill();
        context.shadowBlur = 0;
        context.strokeStyle = "#9a8fff";
        context.lineWidth = 1.5 * pixelRatio;
        context.stroke();
      }

      const lastIndex = currentValues.length - 1;
      if (lastIndex >= 0) {
        const x = chart.valToPos(timestamps[lastIndex], "x", true);
        const y = chart.valToPos(currentValues[lastIndex], "y", true);
        context.shadowColor = "rgba(147, 135, 255, .9)";
        context.shadowBlur = 10 * pixelRatio;
        context.beginPath();
        context.arc(x, y, 4 * pixelRatio, 0, Math.PI * 2);
        context.fillStyle = "#f5f3ff";
        context.fill();
        context.shadowBlur = 0;
        context.strokeStyle = "#8172ff";
        context.lineWidth = 2 * pixelRatio;
        context.stroke();
      }
      context.restore();
    };

    const size = () => ({ width: Math.max(320, host.clientWidth), height: Math.max(280, host.clientHeight) });
    const initialSize = size();
    const options: uPlot.Options = {
      width: initialSize.width,
      height: initialSize.height,
      padding: [18, 16, 0, 0],
      legend: { show: false },
      select: { show: false },
      scales: {
        x: { time: true },
        y: {
          auto: true,
          range: (_chart, minimum, maximum) => {
            const span = Math.max(1, maximum - minimum);
            return [Math.min(0, minimum - span * .08), maximum + span * .14];
          },
        },
      },
      cursor: {
        drag: { x: false, y: false, setScale: false },
        points: { show: false },
      },
      axes: [
        {
          stroke: "#737e8f",
          font: "500 10px system-ui, sans-serif",
          gap: 11,
          size: 34,
          ticks: { show: false },
          grid: { show: false },
          values: (_chart, values) => values.map((value) => dayFormatter.format(new Date(value * 1_000))),
        },
        {
          stroke: "#737e8f",
          font: "500 10px system-ui, sans-serif",
          gap: 8,
          size: 56,
          ticks: { show: false },
          grid: { show: true, stroke: "#2b3342", width: 1, dash: [2, 8] },
          values: (_chart, values) => values.map((value) => formatMetric(value, metric)),
        },
      ],
      series: [
        {},
        {
          label: "Previous period",
          stroke: "rgba(93, 105, 125, .76)",
          width: 1.25,
          dash: [5, 8],
          points: { show: false },
          paths: smoothPath,
        },
        {
          label: "Current glow",
          stroke: "rgba(128, 111, 255, .16)",
          width: 10,
          points: { show: false },
          paths: smoothPath,
        },
        {
          label: metricLabel(metric),
          stroke: "#9b91ff",
          width: 2.6,
          points: { show: false },
          paths: smoothPath,
          fill: (chart) => {
            const gradient = chart.ctx.createLinearGradient(0, chart.bbox.top, 0, chart.bbox.top + chart.bbox.height);
            gradient.addColorStop(0, "rgba(147, 135, 255, .46)");
            gradient.addColorStop(.5, "rgba(111, 94, 255, .13)");
            gradient.addColorStop(1, "rgba(76, 62, 190, 0)");
            return gradient;
          },
        },
      ],
      hooks: {
        setCursor: [(chart) => {
          const index = chart.cursor.idx;
          if (index === null || index === undefined || !timeline[index]) {
            setHover(null);
            return;
          }
          const left = timeline.length > 1 ? Math.min(86, Math.max(14, (index / (timeline.length - 1)) * 100)) : 50;
          setHover((current) => current?.index === index ? current : {
            index,
            left,
            date: timeline[index].date,
            current: currentValues[index],
            previous: previousValues[index] ?? null,
          });
        }],
        draw: [drawSignals],
      },
    };

    const chart = new uPlot(options, alignedData, host);
    const handleLeave = () => setHover(null);
    const handleClick = (event: MouseEvent) => {
      const bounds = chart.over.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const closest = markerHitZones.reduce<{ id: string; distance: number } | null>((best, marker) => {
        const distance = Math.abs(marker.x - x);
        return !best || distance < best.distance ? { id: marker.id, distance } : best;
      }, null);
      if (closest && closest.distance <= 9) selectUploadRef.current(closest.id);
    };
    chart.over.addEventListener("mouseleave", handleLeave);
    chart.over.addEventListener("click", handleClick);

    let resizeFrame = 0;
    let pendingSize = initialSize;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      pendingSize = {
        width: Math.max(320, Math.round(entry.contentRect.width)),
        height: Math.max(280, Math.round(entry.contentRect.height)),
      };
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        if (pendingSize.width !== chart.width || pendingSize.height !== chart.height) chart.setSize(pendingSize);
      });
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      chart.over.removeEventListener("mouseleave", handleLeave);
      chart.over.removeEventListener("click", handleClick);
      chart.destroy();
    };
  }, [alignedData, metric, selectedVideoId, timeline, uploadMarkers]);

  return <div className={dashboardStyles.uplotHost} ref={hostRef}>
    {hover ? <div className={dashboardStyles.uplotTooltip} style={{ left: `${hover.left}%` }}>
      <span>{fullDateFormatter.format(new Date(`${hover.date}T00:00:00Z`))}</span>
      <strong>{formatMetric(hover.current, metric)}</strong>
      {hover.previous !== null ? <small>Previous: {formatMetric(hover.previous, metric)}</small> : null}
    </div> : null}
  </div>;
});

export const PerformanceTimelinePanel = memo(function PerformanceTimelinePanel({
  timeline,
  comparisonTimeline,
  uploadMarkers,
  loading,
  rangeLabel,
  range,
  selectedVideoId,
  onSelectUpload,
  onRangeChange,
  onMetricChange,
  children,
}: {
  timeline: PerformancePoint[];
  comparisonTimeline: PerformancePoint[];
  uploadMarkers: PerformanceUploadMarker[];
  loading: boolean;
  rangeLabel: string;
  range: PerformanceRange;
  selectedVideoId: string;
  onSelectUpload: (id: string) => void;
  onRangeChange: (range: PerformanceRange) => void;
  onMetricChange: (metric: ChartMetric) => void;
  children?: ReactNode;
}) {
  const [metric, setMetric] = useState<ChartMetric>("views");

  return <section className={dashboardStyles.timelinePanel} aria-labelledby="performance-timeline-heading">
    <header className={dashboardStyles.timelineHeader}>
      <h2 className={dashboardStyles.visuallyHidden} id="performance-timeline-heading">Performance over time · {rangeLabel}</h2>
      <div className={dashboardStyles.timelineControls}>
        <div className={dashboardStyles.periodControl} role="group" aria-label="Dashboard period"><div>{performanceRanges.map((item) => <button type="button" key={item.value} aria-pressed={range === item.value} title={item.label} onClick={() => onRangeChange(item.value)}>{item.short}</button>)}</div></div>
        <div className={dashboardStyles.metricTabs} role="tablist" aria-label="Performance timeline metric">
          {([{ value: "views", label: "Views" }, { value: "watchMinutes", label: "Watch time" }, { value: "netSubscribers", label: "Subscribers" }] as const).map((item) => <button type="button" role="tab" key={item.value} aria-selected={metric === item.value} className={metric === item.value ? dashboardStyles.activeTab : ""} onClick={() => { setMetric(item.value); onMetricChange(item.value); }}>{item.label}</button>)}
        </div>
      </div>
    </header>
    {loading && !timeline.length ? <div className={dashboardStyles.chartSkeleton} aria-label="Loading performance timeline">{[48, 62, 54, 76, 68, 84, 72, 91, 78, 87, 82, 96].map((height, index) => <i key={`${height}-${index}`} style={{ "--skeleton-height": `${height}%` } as CSSProperties} />)}</div> : timeline.length ? <>
      <div className={dashboardStyles.chartFrame}><FastTimeSeriesChart timeline={timeline} comparisonTimeline={comparisonTimeline} metric={metric} uploadMarkers={uploadMarkers} selectedVideoId={selectedVideoId} onSelectUpload={onSelectUpload} /></div>
      <div className={dashboardStyles.chartFooter}><div className={dashboardStyles.chartLegend}><span><i /> Current period</span>{comparisonTimeline.length ? <span><i className={dashboardStyles.previousLegend} /> Previous period</span> : null}{uploadMarkers.length ? <span>{uploadMarkers.length} upload events</span> : null}</div>{children}</div>
    </> : <p className={dashboardStyles.emptyChart}>There is no YouTube timeline data for these dates.</p>}
  </section>;
});

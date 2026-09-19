"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Zap, CheckCircle2 } from "lucide-react";

export interface TrendPoint {
  date: string;
  fullDate: string;
  impressions: number;
  reach: number;
  engagement: number;
  leads?: number;
}

export interface PlatformMetric {
  platform: string;
  reach: number;
  impressions: number;
  engagement: number;
  color: string;
  isLive?: boolean;
}

export interface LeadSourceItem {
  source: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Growth Trend Area Chart (Impressions, Reach, Engagement over time)
// ─────────────────────────────────────────────────────────────────────────────
export function GrowthTrendAreaChart({
  data,
  title = "Audience Growth & Telemetry",
  description = "Daily impressions and reach velocity",
}: {
  data: TrendPoint[];
  title?: string;
  description?: string;
}) {
  const [chartMode, setChartMode] = useState<"line" | "bar">("line");
  const [activeMetric, setActiveMetric] = useState<"both" | "impressions" | "reach" | "engagement">("both");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 25, bottom: 35, left: 55 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = useMemo(() => {
    if (!data || data.length === 0) return 100;
    const vals = data.flatMap((d) => [d.impressions, d.reach]);
    return Math.max(...vals, 10);
  }, [data]);

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
      const yImp = padding.top + chartH - (d.impressions / maxVal) * chartH;
      const yReach = padding.top + chartH - (d.reach / maxVal) * chartH;
      const yEng = padding.top + chartH - ((d.engagement * 10) / maxVal) * chartH;
      return { ...d, x, yImp, yReach, yEng };
    });
  }, [data, maxVal, chartW, chartH, padding.left, padding.top]);

  // Generate SVG path string
  const buildPath = (key: "yImp" | "yReach") => {
    if (points.length === 0) return "";
    return points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p[key]}`, "");
  };

  const buildAreaPath = (key: "yImp" | "yReach") => {
    if (points.length === 0) return "";
    const linePath = buildPath(key);
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const baseY = padding.top + chartH;
    return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  };

  const hoveredPoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> {title}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Visual Chart Type Toggle: Line/Area vs Vertical Bar */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
              <button
                type="button"
                onClick={() => setChartMode("line")}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  chartMode === "line"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Continuous Area / Line Chart"
              >
                <TrendingUp className="size-3.5" /> Line
              </button>
              <button
                type="button"
                onClick={() => setChartMode("bar")}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  chartMode === "bar"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Vertical Column Bar Chart"
              >
                <BarChart3 className="size-3.5" /> Bar
              </button>
            </div>

            {/* Metric Filter */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
              <button
                type="button"
                onClick={() => setActiveMetric("both")}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  activeMetric === "both"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Metrics
              </button>
              <button
                type="button"
                onClick={() => setActiveMetric("impressions")}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  activeMetric === "impressions"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="size-2 rounded-full bg-blue-500" /> Impressions
              </button>
              <button
                type="button"
                onClick={() => setActiveMetric("reach")}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  activeMetric === "reach"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="size-2 rounded-full bg-purple-500" /> Reach
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none"
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id="impGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="impBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
              <linearGradient id="reachBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#7e22ce" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padding.top + chartH * ratio;
              const val = Math.round(maxVal * (1 - ratio));
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="currentColor"
                    className="text-muted/40"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[10px] fill-muted-foreground font-mono"
                  >
                    {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                  </text>
                </g>
              );
            })}

            {/* When in Line Mode: Smooth Area Fills & Line Strokes */}
            {chartMode === "line" && (
              <>
                {(activeMetric === "both" || activeMetric === "impressions") && (
                  <path d={buildAreaPath("yImp")} fill="url(#impGradient)" />
                )}
                {(activeMetric === "both" || activeMetric === "reach") && (
                  <path d={buildAreaPath("yReach")} fill="url(#reachGradient)" />
                )}

                {(activeMetric === "both" || activeMetric === "impressions") && (
                  <path
                    d={buildPath("yImp")}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {(activeMetric === "both" || activeMetric === "reach") && (
                  <path
                    d={buildPath("yReach")}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </>
            )}

            {/* When in Bar Mode: Vertical Column Bar Chart */}
            {chartMode === "bar" && (
              <g>
                {/* Column highlight backdrop when hovered */}
                {hoveredPoint && (
                  <rect
                    x={hoveredPoint.x - (chartW / Math.max(points.length, 1)) / 2}
                    y={padding.top}
                    width={chartW / Math.max(points.length, 1)}
                    height={chartH}
                    fill="currentColor"
                    className="text-muted/15"
                    rx="4"
                    pointerEvents="none"
                  />
                )}

                {points.map((p, i) => {
                  const slotW = chartW / Math.max(points.length, 1);
                  const isHovered = hoveredIdx === i;
                  const isDimmed = hoveredIdx !== null && !isHovered;

                  if (activeMetric === "both") {
                    const groupW = Math.max(8, Math.min(slotW * 0.72, 32));
                    const gap = Math.max(1, Math.min(groupW * 0.08, 3));
                    const barW = (groupW - gap) / 2;

                    const hImp = Math.max(2, (p.impressions / maxVal) * chartH);
                    const yImp = padding.top + chartH - hImp;
                    const xImp = p.x - groupW / 2;

                    const hReach = Math.max(2, (p.reach / maxVal) * chartH);
                    const yReach = padding.top + chartH - hReach;
                    const xReach = xImp + barW + gap;

                    return (
                      <g key={i} className="transition-opacity duration-200" opacity={isDimmed ? 0.45 : 1}>
                        <rect
                          x={xImp}
                          y={yImp}
                          width={barW}
                          height={hImp}
                          rx="2"
                          fill="url(#impBarGradient)"
                          className="transition-all duration-300"
                        />
                        <rect
                          x={xReach}
                          y={yReach}
                          width={barW}
                          height={hReach}
                          rx="2"
                          fill="url(#reachBarGradient)"
                          className="transition-all duration-300"
                        />
                      </g>
                    );
                  }

                  const singleBarW = Math.max(6, Math.min(slotW * 0.65, 32));
                  const isImp = activeMetric === "impressions";
                  const val = isImp ? p.impressions : p.reach;
                  const h = Math.max(2, (val / maxVal) * chartH);
                  const y = padding.top + chartH - h;
                  const x = p.x - singleBarW / 2;
                  const fill = isImp ? "url(#impBarGradient)" : "url(#reachBarGradient)";

                  return (
                    <g key={i} className="transition-opacity duration-200" opacity={isDimmed ? 0.45 : 1}>
                      <rect
                        x={x}
                        y={y}
                        width={singleBarW}
                        height={h}
                        rx="3"
                        fill={fill}
                        className="transition-all duration-300"
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* X-axis Date Labels */}
            {points.map((p, i) => {
              // Show label for every point if <= 8, otherwise every 4th
              const shouldShow = points.length <= 8 || i % Math.ceil(points.length / 7) === 0 || i === points.length - 1;
              if (!shouldShow) return null;
              return (
                <text
                  key={i}
                  x={p.x}
                  y={height - 10}
                  textAnchor="middle"
                  className="text-[10px] fill-muted-foreground font-mono"
                >
                  {p.date}
                </text>
              );
            })}

            {/* Interactive Vertical Crosshair and Data Dots (Line mode only) */}
            {chartMode === "line" && hoveredPoint && (
              <g>
                <line
                  x1={hoveredPoint.x}
                  y1={padding.top}
                  x2={hoveredPoint.x}
                  y2={padding.top + chartH}
                  stroke="currentColor"
                  className="text-foreground/40"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                {(activeMetric === "both" || activeMetric === "impressions") && (
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.yImp}
                    r="5"
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                )}
                {(activeMetric === "both" || activeMetric === "reach") && (
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.yReach}
                    r="5"
                    fill="#a855f7"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                )}
              </g>
            )}

            {/* Invisible Hit Boxes for hover detection */}
            {points.map((p, i) => {
              const sliceW = chartW / Math.max(points.length, 1);
              return (
                <rect
                  key={i}
                  x={p.x - sliceW / 2}
                  y={padding.top}
                  width={sliceW}
                  height={chartH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                />
              );
            })}
          </svg>

          {/* Interactive Floating Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none p-2.5 rounded-lg border bg-popover text-popover-foreground shadow-lg text-xs font-sans space-y-1 transition-all"
              style={{
                left: `${Math.min(Math.max((hoveredPoint.x / width) * 100, 15), 85)}%`,
                top: "10px",
                transform: "translateX(-50%)",
              }}
            >
              <p className="font-bold border-b pb-1 text-[11px] text-muted-foreground">{hoveredPoint.date}</p>
              <div className="flex items-center justify-between gap-3 text-blue-500 font-medium">
                <span>Impressions:</span>
                <span className="font-bold font-mono">{hoveredPoint.impressions.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-purple-500 font-medium">
                <span>Unique Reach:</span>
                <span className="font-bold font-mono">{hoveredPoint.reach.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-emerald-500 font-medium">
                <span>Engagement:</span>
                <span className="font-bold font-mono">{hoveredPoint.engagement.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Platform Comparison Bar Chart
// ─────────────────────────────────────────────────────────────────────────────
export function PlatformComparisonBarChart({
  platforms,
}: {
  platforms: PlatformMetric[];
}) {
  const maxReach = useMemo(() => {
    if (!platforms || platforms.length === 0) return 1000;
    return Math.max(...platforms.map((p) => Math.max(p.reach, p.impressions)), 100);
  }, [platforms]);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Cross-Platform Telemetry Comparison
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" /> Impressions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary/40" /> Reach
            </span>
          </div>
        </div>
        <CardDescription className="text-xs">
          Direct comparison across Instagram, Facebook, LinkedIn & Meta Ads
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        {platforms.map((item) => {
          const impPct = Math.min(100, Math.round((item.impressions / maxReach) * 100));
          const reachPct = Math.min(100, Math.round((item.reach / maxReach) * 100));

          return (
            <div key={item.platform} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{item.platform}</span>
                  {item.isLive ? (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.2 rounded border border-emerald-300 flex items-center gap-1">
                      <span className="size-1 rounded-full bg-emerald-500 animate-pulse" /> Live API
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Connected</span>
                  )}
                </div>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {item.impressions.toLocaleString()} imp • {item.reach.toLocaleString()} reach
                </span>
              </div>

              {/* Dual Bar (Impressions top, Reach bottom) */}
              <div className="space-y-1">
                <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(impPct, 5)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 opacity-60"
                    style={{
                      width: `${Math.max(reachPct, 4)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Lead Source Donut Chart
// ─────────────────────────────────────────────────────────────────────────────
export function LeadSourceDonutChart({
  sources,
  totalLeads,
}: {
  sources: LeadSourceItem[];
  totalLeads: number;
}) {
  const [hoveredSource, setHoveredSource] = useState<LeadSourceItem | null>(null);

  const radius = 64;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  // Compute stroke dash offsets
  const activeSources = sources.filter((s) => s.count > 0);
  const totalCount = activeSources.reduce((acc, s) => acc + s.count, 0) || 1;

  let accumulatedPercent = 0;
  const slices = activeSources.map((s) => {
    const percent = s.count / totalCount;
    const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
    const strokeDashoffset = -circumference * accumulatedPercent;
    accumulatedPercent += percent;
    return { ...s, strokeDasharray, strokeDashoffset };
  });

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChartIcon className="size-4 text-primary" /> Lead Acquisition Source Breakdown
        </CardTitle>
        <CardDescription className="text-xs">
          Distribution of inbound leads captured across website, DM bots & voice
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* SVG Donut Chart */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative py-2">
            <div className="relative size-44 flex items-center justify-center">
              <svg viewBox="0 0 160 160" className="size-full -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="currentColor"
                  className="text-muted/25"
                  strokeWidth={strokeWidth}
                />
                {/* Dynamic Slices */}
                {slices.map((slice, idx) => (
                  <circle
                    key={idx}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={hoveredSource?.source === slice.source ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    className="cursor-pointer transition-all duration-300"
                    onMouseEnter={() => setHoveredSource(slice)}
                    onMouseLeave={() => setHoveredSource(null)}
                  />
                ))}
              </svg>

              {/* Center Counter */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-2xl font-black font-mono leading-none">
                  {hoveredSource ? hoveredSource.count : totalLeads}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">
                  {hoveredSource ? hoveredSource.label : "Total Leads"}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Legend */}
          <div className="md:col-span-7 space-y-2">
            {sources.map((item) => (
              <div
                key={item.source}
                onMouseEnter={() => setHoveredSource(item)}
                onMouseLeave={() => setHoveredSource(null)}
                className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                  hoveredSource?.source === item.source ? "bg-accent border-primary/50" : "bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="font-bold">{item.count}</span>
                  <span className="text-[11px] text-muted-foreground w-9 text-right">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Paid Meta Ads ROAS & Spend Trend Chart
// ─────────────────────────────────────────────────────────────────────────────
export function AdPerformanceChart({
  spend,
  roas,
  cpc,
  ctr,
  activeCampaigns,
  isLive,
}: {
  spend: number;
  roas: string;
  cpc: string;
  ctr: string;
  activeCampaigns: number;
  isLive: boolean;
}) {
  return (
    <Card className="border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-card to-indigo-500/5 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="size-4 text-blue-500" /> Meta Ads ROAS & Spend Efficiency
          </CardTitle>
          {isLive ? (
            <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
              <CheckCircle2 className="size-3" /> Live Ads Insights API
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
              Sandbox Calibrated
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Direct telemetry from Meta Marketing API v21.0 & CRM pipeline revenue attribution
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-card border">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Attributed ROAS</p>
            <p className="text-2xl font-black text-emerald-600 font-mono mt-0.5">{roas}</p>
            <p className="text-[10px] text-muted-foreground">Pipeline / Ad Spend</p>
          </div>

          <div className="p-3 rounded-xl bg-card border">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Average CPC</p>
            <p className="text-2xl font-black text-foreground font-mono mt-0.5">{cpc}</p>
            <p className="text-[10px] text-muted-foreground">Cost per link click</p>
          </div>

          <div className="p-3 rounded-xl bg-card border">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Click-Through Rate</p>
            <p className="text-2xl font-black text-foreground font-mono mt-0.5">{ctr}</p>
            <p className="text-[10px] text-muted-foreground">Clicks / Impressions</p>
          </div>

          <div className="p-3 rounded-xl bg-card border">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Monthly Ad Spend</p>
            <p className="text-2xl font-black text-foreground font-mono mt-0.5">₹{spend.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{activeCampaigns} active campaigns</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Pipeline Stage Velocity Bar Chart
// ─────────────────────────────────────────────────────────────────────────────
export interface StageItem {
  stage: string;
  count: number;
}

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "#3b82f6" },
  contacted: { label: "Contacted", color: "#6366f1" },
  qualified: { label: "Qualified", color: "#f59e0b" },
  booked: { label: "Booked", color: "#10b981" },
  proposal: { label: "Proposal", color: "#8b5cf6" },
  closed_won: { label: "Won", color: "#16a34a" },
  closed_lost: { label: "Lost", color: "#64748b" },
};

export function PipelineStageBarChart({
  stages,
  title = "Pipeline Stage Velocity",
  description = "Lead progression across conversion milestones",
}: {
  stages: StageItem[];
  title?: string;
  description?: string;
}) {
  const [viewMode, setViewMode] = useState<"columns" | "bars">("columns");
  const [hoveredStage, setHoveredStage] = useState<StageItem | null>(null);

  const totalLeads = useMemo(() => {
    if (!stages || stages.length === 0) return 1;
    return stages.reduce((acc, s) => acc + (s.count || 0), 0) || 1;
  }, [stages]);

  const maxCount = useMemo(() => {
    if (!stages || stages.length === 0) return 5;
    return Math.max(...stages.map((s) => s.count || 0), 5);
  }, [stages]);

  const width = 500;
  const height = 180;
  const padding = { top: 25, right: 15, bottom: 30, left: 35 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> {title}
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs">
            <button
              type="button"
              onClick={() => setViewMode("columns")}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                viewMode === "columns" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Columns
            </button>
            <button
              type="button"
              onClick={() => setViewMode("bars")}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                viewMode === "bars" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bars
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {viewMode === "columns" ? (
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto overflow-visible select-none"
              onMouseLeave={() => setHoveredStage(null)}
            >
              {/* Horizontal grid lines */}
              {[0, 0.5, 1].map((ratio, i) => {
                const y = padding.top + chartH * ratio;
                const val = Math.round(maxCount * (1 - ratio));
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="currentColor"
                      className="text-muted/30"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padding.left - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[9px] fill-muted-foreground font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Column Bars */}
              {stages.map((item, idx) => {
                const slotW = chartW / Math.max(stages.length, 1);
                const barW = Math.max(12, Math.min(slotW * 0.65, 34));
                const cx = padding.left + (idx + 0.5) * slotW;
                const x = cx - barW / 2;
                const count = item.count || 0;
                const barH = Math.max(3, (count / maxCount) * chartH);
                const y = padding.top + chartH - barH;
                const conf = STAGE_CONFIG[item.stage] || { label: item.stage, color: "#3b82f6" };
                const isHovered = hoveredStage?.stage === item.stage;
                const isDimmed = hoveredStage !== null && !isHovered;

                return (
                  <g
                    key={item.stage}
                    className="cursor-pointer transition-opacity duration-200"
                    opacity={isDimmed ? 0.45 : 1}
                    onMouseEnter={() => setHoveredStage(item)}
                  >
                    {/* Bar background highlight */}
                    {isHovered && (
                      <rect
                        x={cx - slotW / 2}
                        y={padding.top}
                        width={slotW}
                        height={chartH}
                        fill="currentColor"
                        className="text-muted/15"
                        rx="4"
                      />
                    )}

                    {/* Vertical Column Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx="3"
                      fill={conf.color}
                      className="transition-all duration-300"
                    />

                    {/* Value label above bar */}
                    {count > 0 && (
                      <text
                        x={cx}
                        y={y - 5}
                        textAnchor="middle"
                        className="text-[10px] font-bold fill-foreground font-mono"
                      >
                        {count}
                      </text>
                    )}

                    {/* X-axis Stage label */}
                    <text
                      x={cx}
                      y={height - 12}
                      textAnchor="middle"
                      className="text-[9px] fill-muted-foreground font-medium"
                    >
                      {conf.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredStage && (
              <div
                className="absolute z-20 pointer-events-none p-2 rounded-md border bg-popover text-popover-foreground shadow-md text-xs font-sans space-y-0.5 transition-all"
                style={{
                  top: "4px",
                  right: "12px",
                }}
              >
                <p className="font-bold text-[11px] capitalize">
                  {STAGE_CONFIG[hoveredStage.stage]?.label || hoveredStage.stage}
                </p>
                <div className="flex items-center justify-between gap-3 text-muted-foreground text-[11px]">
                  <span>Lead Count:</span>
                  <span className="font-bold font-mono text-foreground">{hoveredStage.count}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-muted-foreground text-[11px]">
                  <span>Pipeline Share:</span>
                  <span className="font-bold font-mono text-foreground">
                    {Math.round(((hoveredStage.count || 0) / totalLeads) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5 py-1">
            {stages.map((item) => {
              const conf = STAGE_CONFIG[item.stage] || { label: item.stage, color: "#3b82f6" };
              const pct = Math.max(4, Math.round(((item.count || 0) / maxCount) * 100));
              const share = Math.round(((item.count || 0) / totalLeads) * 100);

              return (
                <div key={item.stage} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="capitalize flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: conf.color }} />
                      {conf.label}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      <span className="font-bold text-foreground">{item.count}</span> ({share}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: conf.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


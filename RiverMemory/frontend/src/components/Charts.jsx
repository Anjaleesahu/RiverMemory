import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { COLORS, SERIES_COLORS, fmt } from "./ui";

const axis = { stroke: "var(--muted)", fontSize: 12 };
const colorFor = (g, i) => COLORS[g] || SERIES_COLORS[i % SERIES_COLORS.length];

export function SeriesChart({ points, groups, unit, height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
        <XAxis dataKey="period" {...axis} minTickGap={40} />
        <YAxis {...axis} width={56} label={{ value: unit, angle: -90, position: "insideLeft", fill: "var(--muted)", fontSize: 12 }} />
        <Tooltip formatter={(v) => `${fmt(v)} ${unit}`} />
        <Legend />
        {groups.map((g, i) => (
          <Line key={g} type="monotone" dataKey={g} stroke={colorFor(g, i)} strokeWidth={2} dot={points.length < 60} connectNulls={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RainBars({ points, height = 300, dataKey = "rainfall_mm" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
        <XAxis dataKey="period" {...axis} minTickGap={30} />
        <YAxis {...axis} width={56} />
        <Tooltip formatter={(v) => `${fmt(v)} mm`} />
        <Bar dataKey={dataKey} fill={COLORS.rain} name="Rainfall (mm)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RainLine({ points, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
        <XAxis dataKey="period" {...axis} minTickGap={50} />
        <YAxis {...axis} width={56} />
        <Tooltip formatter={(v) => `${fmt(v)} mm`} />
        <Line dataKey="rainfall_mm" stroke={COLORS.rain} dot={false} strokeWidth={1.5} name="Rainfall (mm)" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ScatterPlot({ points, xLabel, yLabel, height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
        <XAxis type="number" dataKey="rainfall_mm" name="Rainfall" {...axis} label={{ value: xLabel, position: "insideBottom", offset: -10, fill: "var(--muted)", fontSize: 12 }} />
        <YAxis type="number" dataKey="value" name="Value" {...axis} width={56} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "var(--muted)", fontSize: 12 }} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => payload?.length ? (
          <div className="tip"><strong>{payload[0].payload.month}</strong><br />Rainfall: {fmt(payload[0].payload.rainfall_mm)} mm<br />Value: {fmt(payload[0].payload.value)}</div>) : null} />
        <Scatter data={points} fill={COLORS.Ganga} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function TimelineChart({ months, incidents, label, unit, height = 340 }) {
  const data = months.map((m) => ({ ...m, period: m.month }));
  const periods = new Set(data.map((d) => d.period));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
        <XAxis dataKey="period" {...axis} minTickGap={40} />
        <YAxis yAxisId="l" {...axis} width={56} label={{ value: unit, angle: -90, position: "insideLeft", fill: "var(--muted)", fontSize: 12 }} />
        <YAxis yAxisId="r" orientation="right" {...axis} width={56} label={{ value: "mm", angle: 90, position: "insideRight", fill: "var(--muted)", fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar yAxisId="r" dataKey="rainfall_mm" name="Monthly rainfall (mm)" fill={COLORS.rain} opacity={0.6} />
        <Line yAxisId="l" dataKey="value" name={label} stroke={COLORS.Yamuna} strokeWidth={2} connectNulls={false} />
        {incidents.map((i) => {
          const p = String(i.date).slice(0, 7);
          return periods.has(p) ? <ReferenceLine key={i.id} yAxisId="l" x={p} stroke="#d97706" strokeDasharray="4 3" /> : null;
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

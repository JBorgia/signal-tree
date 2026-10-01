/** Percentile with linear interpolation over a numeric array (copy is sorted). */
export function percentile(values, p) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank),
    hi = Math.ceil(rank);
  return s[lo] + (s[hi] - s[lo]) * (rank - lo);
}
export const median = (values) => percentile(values, 50);
export const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
export function spread(values) {
  const v = values.filter(Number.isFinite);
  return v.length
    ? {
        median: median(v),
        min: Math.min(...v),
        max: Math.max(...v),
        n: v.length,
      }
    : null;
}
export const latency = (ms) => ({
  p50: percentile(ms, 50),
  p95: percentile(ms, 95),
  p99: percentile(ms, 99),
});

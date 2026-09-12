import { useEffect, useState } from "react"

/*
 * The colour theme lives on <html data-theme="...">, not in Redux, because CSS
 * needs it first. ApexCharts, however, bakes its colours into an SVG at render
 * time — it cannot read CSS variables. So charts need the theme as a *value*,
 * and they need to re-render when it flips.
 *
 * `useThemeMode` observes the attribute and returns "light" | "dark";
 * `useChartTheme` turns that into the handful of chart colours we tune.
 */

function readMode() {
  if (typeof document === "undefined") return "dark"
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark"
}

export function useThemeMode() {
  const [mode, setMode] = useState(readMode)

  useEffect(() => {
    const observer = new MutationObserver(() => setMode(readMode()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })
    return () => observer.disconnect()
  }, [])

  return mode
}

const CHART_COLORS = {
  dark: {
    axis: "#94a3b8",
    grid: "rgba(148, 163, 184, 0.22)",
    tooltip: "dark",
    annotation: "#cbd5e1",
  },
  light: {
    axis: "#475569",
    grid: "rgba(71, 85, 105, 0.20)",
    tooltip: "light",
    annotation: "#334155",
  },
}

export function chartTheme(mode) {
  return CHART_COLORS[mode] ?? CHART_COLORS.dark
}

export function useChartTheme() {
  return chartTheme(useThemeMode())
}

import type { LabelColor } from "@/features/labelwise/types"

export const buildLabelColor = (hue: number): LabelColor => ({
  hue,
  solid: `hsl(${hue} 70% 45%)`,
  soft: `hsl(${hue} 95% 96%)`,
  overlay: `hsl(${hue} 85% 45% / 0.14)`,
  overlayStrong: `hsl(${hue} 85% 45% / 0.24)`,
})

/** Picks the hue furthest from all existing ones on the 360° circle. */
export const getDistinctHue = (existingHues: number[]): number => {
  if (existingHues.length === 0) return Math.floor(Math.random() * 360)

  const sorted = [...existingHues].map((h) => ((h % 360) + 360) % 360).sort((a, b) => a - b)

  let bestHue = 0
  let bestGap = 0

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1]
    const gap = next - current

    if (gap > bestGap) {
      bestGap = gap
      bestHue = Math.round((current + gap / 2) % 360)
    }
  }

  return bestHue
}

export const hueToHex = (hue: number): string => {
  const h = hue / 360
  const s = 0.7
  const l = 0.45
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue2rgb = (t: number) => {
    const n = ((t % 1) + 1) % 1
    if (n < 1 / 6) return p + (q - p) * 6 * n
    if (n < 1 / 2) return q
    if (n < 2 / 3) return p + (q - p) * (2 / 3 - n) * 6
    return p
  }
  const r = Math.round(hue2rgb(h + 1 / 3) * 255)
  const g = Math.round(hue2rgb(h) * 255)
  const b = Math.round(hue2rgb(h - 1 / 3) * 255)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

export const hexToHue = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return Math.round(h * 360)
}

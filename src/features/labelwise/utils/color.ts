import type { LabelColor } from "@/features/labelwise/types"

export const buildRandomLabelColor = (): LabelColor => {
  const hue = Math.floor(Math.random() * 360)
  return {
    solid: `hsl(${hue} 70% 40%)`,
    soft: `hsl(${hue} 95% 96%)`,
    overlay: `hsl(${hue} 85% 45% / 0.14)`,
    overlayStrong: `hsl(${hue} 85% 45% / 0.24)`,
  }
}

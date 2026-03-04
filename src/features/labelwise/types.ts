export type AnnotationBox = {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

export type CsvRow = {
  imageId: string
  annotationId: string
  label: string
  x: number
  y: number
  width: number
  height: number
  imageName: string
  imageWidth: number | null
  imageHeight: number | null
}

export type ImageItem = {
  id: string
  file: File
  url: string
  annotations: AnnotationBox[]
  width?: number
  height?: number
}

export type Point = {
  x: number
  y: number
}

export type ResizeHandle = "nw" | "ne" | "sw" | "se"

export type AnnotationTransform = {
  id: string
  type: "move" | "resize"
  handle?: ResizeHandle
  startPointer: Point
  startBox: AnnotationBox
}

export type LabelColor = {
  solid: string
  soft: string
  overlay: string
  overlayStrong: string
}

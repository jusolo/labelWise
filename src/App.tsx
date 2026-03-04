import { X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from "react"
import { sileo } from "sileo"

import { LwSelect } from "@/features/labelwise/components/lw-select"
import { DEFAULT_LABELS, GRID_SIZE, MIN_BOX_SIZE } from "@/features/labelwise/constants"
import type {
  AnnotationBox,
  AnnotationTransform,
  CsvRow,
  ImageItem,
  LabelColor,
  Point,
  ResizeHandle,
} from "@/features/labelwise/types"
import { buildRandomLabelColor } from "@/features/labelwise/utils/color"
import { parseCsv } from "@/features/labelwise/utils/csv"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function App() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [labels, setLabels] = useState<string[]>(DEFAULT_LABELS)
  const [labelColors, setLabelColors] = useState<Record<string, LabelColor>>(() =>
    Object.fromEntries(DEFAULT_LABELS.map((label) => [label, buildRandomLabelColor()])),
  )
  const [activeLabel, setActiveLabel] = useState<string>("")
  const [newLabel, setNewLabel] = useState("")
  const [bulkLabels, setBulkLabels] = useState("")
  const [zoom, setZoom] = useState<number>(1)
  const [drawStart, setDrawStart] = useState<Point | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<Point | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([])
  const [interactionMode, setInteractionMode] = useState<"draw" | "pan">("draw")
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [annotationTransform, setAnnotationTransform] = useState<AnnotationTransform | null>(null)
  const [copiedAnnotations, setCopiedAnnotations] = useState<AnnotationBox[] | null>(null)
  const [pasteCount, setPasteCount] = useState(0)
  const [panelView, setPanelView] = useState<"canvas" | "csv">("canvas")
  const [showGridGuide, setShowGridGuide] = useState(true)

  const imagesRef = useRef<ImageItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const panStartRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 })

  const currentImage = useMemo(() => images.find((image) => image.id === currentId) ?? null, [currentId, images])
  const currentAnnotations = currentImage?.annotations ?? []
  const selectedAnnotations = currentAnnotations.filter((annotation) => selectedAnnotationIds.includes(annotation.id))
  const csvRows = useMemo<CsvRow[]>(
    () =>
      images.flatMap((image) =>
        image.annotations.map((annotation) => ({
          imageId: image.id,
          annotationId: annotation.id,
          label: annotation.label,
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
          imageName: image.file.name,
          imageWidth: image.width ?? null,
          imageHeight: image.height ?? null,
        })),
      ),
    [images],
  )

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    if (labels.length === 0) {
      setActiveLabel("")
      return
    }

    if (!labels.includes(activeLabel)) {
      setActiveLabel(labels[0])
    }
  }, [activeLabel, labels])

  useEffect(() => {
    setLabelColors((previous) => {
      const next = { ...previous }
      let changed = false
      for (const label of labels) {
        if (!next[label]) {
          next[label] = buildRandomLabelColor()
          changed = true
        }
      }
      return changed ? next : previous
    })
  }, [labels])

  useEffect(() => {
    setZoom(1)
    setDrawStart(null)
    setDrawCurrent(null)
    setSelectedAnnotationId(null)
    setSelectedAnnotationIds([])
    setPan({ x: 0, y: 0 })
    setAnnotationTransform(null)
    setPasteCount(0)
  }, [currentId])

  useEffect(() => {
    if (panelView !== "canvas") return

    const node = viewportRef.current
    if (!node) return

    const measure = () => {
      const rect = node.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      setViewportSize({ width, height })
    }

    measure()
    const rafId = requestAnimationFrame(measure)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width = Math.max(1, Math.floor(entry.contentRect.width))
      const height = Math.max(1, Math.floor(entry.contentRect.height))
      setViewportSize({ width, height })
    })

    observer.observe(node)
    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [currentId, panelView])

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) {
        URL.revokeObjectURL(image.url)
      }
    }
  }, [])

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    const onlyImages = files.filter((file) => file.type.startsWith("image/"))
    if (onlyImages.length === 0) {
      sileo.warning({
        title: "Sin imágenes válidas",
        description: "Selecciona archivos de tipo imagen para continuar.",
      })
      return
    }

    const next = onlyImages.map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      url: URL.createObjectURL(file),
      annotations: [],
    }))

    setImages((previous) => {
      const updated = [...previous, ...next]
      if (!currentId && updated.length > 0) setCurrentId(updated[0].id)
      return updated
    })

    sileo.success({
      title: "Imágenes cargadas",
      description: `Se agregaron ${next.length} imagen(es) al dataset.`,
    })

    event.target.value = ""
  }

  const handleCsvImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      const rows = parseCsv(content)
      if (rows.length < 2) {
        sileo.warning({
          title: "CSV vacío",
          description: "El archivo no contiene filas de anotaciones.",
        })
        event.target.value = ""
        return
      }

      const headers = rows[0].map((header) => header.trim().toLowerCase())
      const indexMap = {
        label: headers.indexOf("label_name"),
        x: headers.indexOf("bbox_x"),
        y: headers.indexOf("bbox_y"),
        width: headers.indexOf("bbox_width"),
        height: headers.indexOf("bbox_height"),
        imageName: headers.indexOf("image_name"),
      }

      if (Object.values(indexMap).some((index) => index < 0)) {
        sileo.error({
          title: "Formato inválido",
          description: "Usa columnas: label_name,bbox_x,bbox_y,bbox_width,bbox_height,image_name,image_width,image_height.",
        })
        event.target.value = ""
        return
      }

      const parsedByImage = new Map<string, AnnotationBox[]>()
      const parsedLabels = new Set<string>()
      let validRows = 0

      for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i]
        const imageName = row[indexMap.imageName]?.trim()
        const label = row[indexMap.label]?.trim().toLowerCase()
        const x = Number(row[indexMap.x])
        const y = Number(row[indexMap.y])
        const width = Number(row[indexMap.width])
        const height = Number(row[indexMap.height])

        if (!imageName || !label) continue
        if (![x, y, width, height].every(Number.isFinite)) continue
        if (width <= 0 || height <= 0) continue

        const list = parsedByImage.get(imageName) ?? []
        list.push({
          id: crypto.randomUUID(),
          label,
          x,
          y,
          width,
          height,
        })
        parsedByImage.set(imageName, list)
        parsedLabels.add(label)
        validRows += 1
      }

      let matchedImages = 0
      let importedBoxes = 0

      setImages((previous) =>
        previous.map((image) => {
          const imported = parsedByImage.get(image.file.name)
          if (!imported) return image
          matchedImages += 1
          importedBoxes += imported.length
          return { ...image, annotations: imported }
        }),
      )

      setLabels((previous) => {
        const merged = new Set(previous)
        for (const label of parsedLabels) merged.add(label)
        return [...merged]
      })

      sileo.success({
        title: "CSV importado",
        description: `Importadas ${importedBoxes} anotaciones en ${matchedImages} imagen(es). Filas válidas: ${validRows}.`,
      })
    } catch {
      sileo.error({
        title: "Error al importar",
        description: "No se pudo leer el CSV seleccionado.",
      })
    } finally {
      event.target.value = ""
    }
  }

  const addLabel = () => {
    const clean = newLabel.trim().toLowerCase()
    if (!clean) return
    if (labels.includes(clean)) {
      sileo.info({
        title: "Etiqueta existente",
        description: `"${clean}" ya está registrada.`,
      })
      return
    }

    setLabels((previous) => [...previous, clean])
    if (!activeLabel) setActiveLabel(clean)
    setNewLabel("")
    sileo.success({
      title: "Etiqueta agregada",
      description: `Se añadió "${clean}".`,
    })
  }

  const addBulkLabels = () => {
    const incoming = bulkLabels
      .split(/[\n,]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)

    if (incoming.length === 0) return

    setLabels((previous) => {
      const unique = new Set(previous)
      for (const label of incoming) unique.add(label)
      return [...unique]
    })

    if (!activeLabel) setActiveLabel(incoming[0])
    setBulkLabels("")
    sileo.success({
      title: "Lote agregado",
      description: `Etiquetas procesadas: ${incoming.length}.`,
    })
  }

  const removeImage = (id: string) => {
    setImages((previous) => {
      const target = previous.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.url)

      const filtered = previous.filter((item) => item.id !== id)
      if (currentId === id) setCurrentId(filtered[0]?.id ?? null)
      return filtered
    })
    setSelectedAnnotationId(null)
    setSelectedAnnotationIds([])
    sileo.info({
      title: "Imagen eliminada",
      description: "Se removió la imagen y sus anotaciones.",
    })
  }

  const deleteAnnotation = (annotationId: string) => {
    if (!currentImage) return

    setImages((previous) =>
      previous.map((image) => {
        if (image.id !== currentImage.id) return image
        return {
          ...image,
          annotations: image.annotations.filter((annotation) => annotation.id !== annotationId),
        }
      }),
    )

    if (selectedAnnotationId === annotationId) setSelectedAnnotationId(null)
    setSelectedAnnotationIds((previous) => previous.filter((id) => id !== annotationId))
    sileo.info({
      title: "Cuadro eliminado",
      description: "La anotación fue removida.",
    })
  }

  const updateAnnotation = (annotationId: string, updater: (current: AnnotationBox) => AnnotationBox) => {
    if (!currentImage) return

    setImages((previous) =>
      previous.map((image) => {
        if (image.id !== currentImage.id) return image
        return {
          ...image,
          annotations: image.annotations.map((annotation) => {
            if (annotation.id !== annotationId) return annotation
            return updater(annotation)
          }),
        }
      }),
    )
  }

  const updateAnnotationByImage = (
    imageId: string,
    annotationId: string,
    updater: (current: AnnotationBox, image: ImageItem) => AnnotationBox,
  ) => {
    setImages((previous) =>
      previous.map((image) => {
        if (image.id !== imageId) return image
        return {
          ...image,
          annotations: image.annotations.map((annotation) => {
            if (annotation.id !== annotationId) return annotation
            return updater(annotation, image)
          }),
        }
      }),
    )
  }

  const updateAnnotationFromCsv = (
    row: CsvRow,
    field: "label" | "x" | "y" | "width" | "height",
    value: string,
  ) => {
    updateAnnotationByImage(row.imageId, row.annotationId, (annotation, image) => {
      if (field === "label") {
        const next = value.trim().toLowerCase()
        return { ...annotation, label: next || annotation.label }
      }

      const parsed = Number(value)
      if (!Number.isFinite(parsed)) return annotation

      const maxWidth = image.width ?? Number.POSITIVE_INFINITY
      const maxHeight = image.height ?? Number.POSITIVE_INFINITY

      let nextX = annotation.x
      let nextY = annotation.y
      let nextWidth = annotation.width
      let nextHeight = annotation.height

      if (field === "x") nextX = Math.max(0, parsed)
      if (field === "y") nextY = Math.max(0, parsed)
      if (field === "width") nextWidth = Math.max(MIN_BOX_SIZE, parsed)
      if (field === "height") nextHeight = Math.max(MIN_BOX_SIZE, parsed)

      if (Number.isFinite(maxWidth)) {
        nextX = Math.min(nextX, Math.max(0, maxWidth - nextWidth))
        nextWidth = Math.min(nextWidth, Math.max(MIN_BOX_SIZE, maxWidth - nextX))
      }
      if (Number.isFinite(maxHeight)) {
        nextY = Math.min(nextY, Math.max(0, maxHeight - nextHeight))
        nextHeight = Math.min(nextHeight, Math.max(MIN_BOX_SIZE, maxHeight - nextY))
      }

      return {
        ...annotation,
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      }
    })
  }

  const updateAnnotationLabel = (annotationId: string, nextLabel: string) => {
    updateAnnotation(annotationId, (annotation) => ({ ...annotation, label: nextLabel }))
  }

  const selectSingleAnnotation = (annotationId: string) => {
    setSelectedAnnotationId(annotationId)
    setSelectedAnnotationIds([annotationId])
  }

  const toggleAnnotationSelection = (annotationId: string) => {
    setSelectedAnnotationIds((previous) => {
      const exists = previous.includes(annotationId)
      const next = exists ? previous.filter((id) => id !== annotationId) : [...previous, annotationId]

      if (!exists) {
        setSelectedAnnotationId(annotationId)
      } else if (selectedAnnotationId === annotationId) {
        setSelectedAnnotationId(next[next.length - 1] ?? null)
      } else if (next.length === 0) {
        setSelectedAnnotationId(null)
      }

      return next
    })
  }

  const exportCsv = () => {
    if (images.length === 0) {
      sileo.warning({
        title: "Sin datos para exportar",
        description: "Carga imágenes y crea al menos una anotación.",
      })
      return
    }

    const rows = ["label_name,bbox_x,bbox_y,bbox_width,bbox_height,image_name,image_width,image_height"]
    for (const image of images) {
      if (image.annotations.length === 0) continue

      const safeName = image.file.name.replaceAll('"', '""')
      const imageWidth = image.width ?? ""
      const imageHeight = image.height ?? ""

      for (const annotation of image.annotations) {
        rows.push(
          `"${annotation.label}",${annotation.x.toFixed(0)},${annotation.y.toFixed(0)},${annotation.width.toFixed(0)},${annotation.height.toFixed(0)},"${safeName}",${imageWidth},${imageHeight}`,
        )
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `annotations-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    sileo.success({
      title: "CSV exportado",
      description: `Archivo generado con ${rows.length - 1} fila(s).`,
    })
  }

  const getStagePointFromClient = (clientX: number, clientY: number): Point | null => {
    if (!stageRef.current || !currentImage) return null

    const rect = stageRef.current.getBoundingClientRect()
    const naturalWidth = currentImage.width ?? 1
    const naturalHeight = currentImage.height ?? 1

    const x = Math.max(0, Math.min(naturalWidth, ((clientX - rect.left) / rect.width) * naturalWidth))
    const y = Math.max(0, Math.min(naturalHeight, ((clientY - rect.top) / rect.height) * naturalHeight))

    return { x, y }
  }

  const getStagePoint = (event: MouseEvent<HTMLDivElement>): Point | null => getStagePointFromClient(event.clientX, event.clientY)

  const startDraw = (event: MouseEvent<HTMLDivElement>) => {
    if (!currentImage || !activeLabel || annotationTransform) return

    const point = getStagePoint(event)
    if (!point) return

    setSelectedAnnotationId(null)
    setSelectedAnnotationIds([])
    setDrawStart(point)
    setDrawCurrent(point)
  }

  const moveDraw = (event: MouseEvent<HTMLDivElement>) => {
    if (!drawStart) return

    const point = getStagePoint(event)
    if (!point) return

    setDrawCurrent(point)
  }

  const finishDraw = () => {
    if (annotationTransform) return

    if (!currentImage || !drawStart || !drawCurrent || !activeLabel) {
      setDrawStart(null)
      setDrawCurrent(null)
      return
    }

    const x = Math.min(drawStart.x, drawCurrent.x)
    const y = Math.min(drawStart.y, drawCurrent.y)
    const width = Math.abs(drawCurrent.x - drawStart.x)
    const height = Math.abs(drawCurrent.y - drawStart.y)

    setDrawStart(null)
    setDrawCurrent(null)

    if (width < MIN_BOX_SIZE || height < MIN_BOX_SIZE) return

    const annotation: AnnotationBox = {
      id: crypto.randomUUID(),
      label: activeLabel,
      x,
      y,
      width,
      height,
    }

    setImages((previous) =>
      previous.map((image) => {
        if (image.id !== currentImage.id) return image
        return {
          ...image,
          annotations: [...image.annotations, annotation],
        }
      }),
    )
  }

  const startMoveAnnotation = (event: MouseEvent<HTMLElement>, annotation: AnnotationBox) => {
    if (!currentImage) return
    const point = getStagePointFromClient(event.clientX, event.clientY)
    if (!point) return

    event.preventDefault()
    event.stopPropagation()
    const additive = event.metaKey || event.ctrlKey
    if (additive) {
      toggleAnnotationSelection(annotation.id)
      return
    }

    selectSingleAnnotation(annotation.id)
    setAnnotationTransform({
      id: annotation.id,
      type: "move",
      startPointer: point,
      startBox: annotation,
    })
  }

  const startResizeAnnotation = (event: MouseEvent<HTMLElement>, annotation: AnnotationBox, handle: ResizeHandle) => {
    if (!currentImage) return
    const point = getStagePointFromClient(event.clientX, event.clientY)
    if (!point) return

    event.preventDefault()
    event.stopPropagation()
    selectSingleAnnotation(annotation.id)
    setAnnotationTransform({
      id: annotation.id,
      type: "resize",
      handle,
      startPointer: point,
      startBox: annotation,
    })
  }

  const draftBox =
    drawStart && drawCurrent
      ? {
          x: Math.min(drawStart.x, drawCurrent.x),
          y: Math.min(drawStart.y, drawCurrent.y),
          width: Math.abs(drawCurrent.x - drawStart.x),
          height: Math.abs(drawCurrent.y - drawStart.y),
        }
      : null

  const naturalWidth = currentImage?.width ?? 1000
  const naturalHeight = currentImage?.height ?? 700
  const fitScale = Math.min(viewportSize.width / naturalWidth, viewportSize.height / naturalHeight)
  const safeFitScale = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1
  const stageWidth = naturalWidth * safeFitScale * zoom
  const stageHeight = naturalHeight * safeFitScale * zoom
  const panLimitX = Math.max(0, (stageWidth - viewportSize.width) / 2)
  const panLimitY = Math.max(0, (stageHeight - viewportSize.height) / 2)
  const stageLeft = (viewportSize.width - stageWidth) / 2 + pan.x
  const stageTop = (viewportSize.height - stageHeight) / 2 + pan.y

  const clampPan = (nextPan: Point): Point => ({
    x: Math.min(panLimitX, Math.max(-panLimitX, nextPan.x)),
    y: Math.min(panLimitY, Math.max(-panLimitY, nextPan.y)),
  })

  const startPan = (event: MouseEvent<HTMLDivElement>) => {
    panStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    setIsPanning(true)
  }

  const movePan = (event: MouseEvent<HTMLDivElement>) => {
    const start = panStartRef.current
    if (!start) return

    const next = clampPan({
      x: start.panX + (event.clientX - start.pointerX),
      y: start.panY + (event.clientY - start.pointerY),
    })
    setPan(next)
  }

  const finishPan = () => {
    panStartRef.current = null
    setIsPanning(false)
  }

  const handleStageMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (annotationTransform) return

    if (interactionMode === "pan") {
      startPan(event)
      return
    }
    startDraw(event)
  }

  const handleStageMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (annotationTransform) return

    if (panStartRef.current) {
      movePan(event)
      return
    }
    moveDraw(event)
  }

  const handleStageMouseUp = () => {
    if (annotationTransform) return

    if (panStartRef.current) {
      finishPan()
      return
    }
    finishDraw()
  }

  const handleStageMouseLeave = () => {
    if (annotationTransform) return

    if (panStartRef.current) {
      finishPan()
      return
    }
    finishDraw()
  }

  useEffect(() => {
    setPan((previous) => clampPan(previous))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageWidth, stageHeight, viewportSize.width, viewportSize.height])

  useEffect(() => {
    if (!annotationTransform) return

    const naturalWidthLocal = currentImage?.width ?? 1
    const naturalHeightLocal = currentImage?.height ?? 1

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const point = getStagePointFromClient(event.clientX, event.clientY)
      if (!point) return

      const dx = point.x - annotationTransform.startPointer.x
      const dy = point.y - annotationTransform.startPointer.y

      if (annotationTransform.type === "move") {
        const width = annotationTransform.startBox.width
        const height = annotationTransform.startBox.height

        const nextX = Math.max(0, Math.min(naturalWidthLocal - width, annotationTransform.startBox.x + dx))
        const nextY = Math.max(0, Math.min(naturalHeightLocal - height, annotationTransform.startBox.y + dy))

        updateAnnotation(annotationTransform.id, (annotation) => ({
          ...annotation,
          x: nextX,
          y: nextY,
        }))
        return
      }

      const handle = annotationTransform.handle ?? "se"
      let x1 = annotationTransform.startBox.x
      let y1 = annotationTransform.startBox.y
      let x2 = annotationTransform.startBox.x + annotationTransform.startBox.width
      let y2 = annotationTransform.startBox.y + annotationTransform.startBox.height

      if (handle === "nw" || handle === "sw") {
        x1 = Math.max(0, Math.min(x2 - MIN_BOX_SIZE, x1 + dx))
      } else {
        x2 = Math.min(naturalWidthLocal, Math.max(x1 + MIN_BOX_SIZE, x2 + dx))
      }

      if (handle === "nw" || handle === "ne") {
        y1 = Math.max(0, Math.min(y2 - MIN_BOX_SIZE, y1 + dy))
      } else {
        y2 = Math.min(naturalHeightLocal, Math.max(y1 + MIN_BOX_SIZE, y2 + dy))
      }

      updateAnnotation(annotationTransform.id, (annotation) => ({
        ...annotation,
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
      }))
    }

    const handleMouseUp = () => {
      setAnnotationTransform(null)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [annotationTransform, currentImage])

  const copySelectedAnnotation = () => {
    if (selectedAnnotations.length === 0) return
    setCopiedAnnotations(selectedAnnotations.map((annotation) => ({ ...annotation })))
    setPasteCount(0)
    sileo.info({
      title: "Cuadros copiados",
      description: `Se copiaron ${selectedAnnotations.length} cuadro(s). Usa Ctrl/Cmd + V para pegar.`,
    })
  }

  const pasteAnnotation = () => {
    if (!currentImage || !copiedAnnotations || copiedAnnotations.length === 0) return

    const naturalWidthLocal = currentImage.width ?? 1
    const naturalHeightLocal = currentImage.height ?? 1
    const offset = 18 * (pasteCount + 1)

    const pasted = copiedAnnotations.map((annotation) => {
      const nextX = Math.max(0, Math.min(naturalWidthLocal - annotation.width, annotation.x + offset))
      const nextY = Math.max(0, Math.min(naturalHeightLocal - annotation.height, annotation.y + offset))
      return {
        ...annotation,
        id: crypto.randomUUID(),
        x: nextX,
        y: nextY,
      }
    })

    setImages((previous) =>
      previous.map((image) => {
        if (image.id !== currentImage.id) return image
        return {
          ...image,
          annotations: [...image.annotations, ...pasted],
        }
      }),
    )

    setSelectedAnnotationId(pasted[pasted.length - 1]?.id ?? null)
    setSelectedAnnotationIds(pasted.map((annotation) => annotation.id))
    setPasteCount((value) => value + 1)
    sileo.success({
      title: "Cuadros pegados",
      description: `Se pegaron ${pasted.length} cuadro(s).`,
    })
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingContext =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"

      if (isTypingContext) return
      if (!currentImage) return

      const isModifierPressed = event.metaKey || event.ctrlKey
      if (!isModifierPressed) return

      const key = event.key.toLowerCase()

      if (key === "c" && selectedAnnotations.length > 0) {
        event.preventDefault()
        setCopiedAnnotations(selectedAnnotations.map((annotation) => ({ ...annotation })))
        setPasteCount(0)
        return
      }

      if (key === "v" && copiedAnnotations && copiedAnnotations.length > 0) {
        event.preventDefault()
        pasteAnnotation()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [copiedAnnotations, currentImage, selectedAnnotations, pasteAnnotation])

  return (
    <main className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="flex h-full w-full flex-col bg-gradient-to-br from-background via-card to-background">
        <header className="flex flex-col gap-2 border-b border-border/80 bg-card/80 px-5 py-4 backdrop-blur-sm md:flex-row md:items-end md:justify-between">
          <div className="flex items-end gap-3">
            <img
              src="/labelWise-all.png"
              alt="labelWise"
              className="h-14 w-auto rounded-lg border border-border/60 bg-card px-2 py-1 md:h-16"
            />
            <div>
              <p className="text-xs tracking-[0.15em] text-muted-foreground">labelWise</p>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Importa, etiqueta y exporta CSV</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFiles} className="hidden" />
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvImport} className="hidden" />
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              Cargar imágenes
            </Button>
            <Button type="button" variant="outline" onClick={() => csvInputRef.current?.click()}>
              Importar CSV
            </Button>
            <Button className="md:w-auto" type="button" variant="outline" onClick={exportCsv} disabled={images.length === 0}>
              Exportar CSV
            </Button>
          </div>
        </header>
        <section className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[300px_minmax(0,1fr)_360px] xl:divide-x xl:divide-border/80">
          <div className="flex min-h-0 min-w-0 flex-col border-b border-border/80 px-4 py-4 xl:border-b-0">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Lista</h2>
                <Badge variant="outline">{images.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Selecciona una imagen para etiquetar.</p>
            </div>
            <div className="flex-1 space-y-2 overflow-auto">
              {images.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay imágenes cargadas.</p>}
              {images.map((image) => {
                const isActive = image.id === currentId

                return (
                  <button
                    key={image.id}
                    className={`group flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-all duration-200 ${
                      isActive ? "border-primary bg-secondary" : "border-border hover:border-ring"
                    }`}
                    onClick={() => setCurrentId(image.id)}
                  >
                    <img src={image.url} alt={image.file.name} className="h-12 w-12 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{image.file.name}</p>
                      <p className="text-xs text-muted-foreground">{image.annotations.length} cuadros</p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        removeImage(image.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          removeImage(image.id)
                        }
                      }}
                      className="rounded border border-input p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100"
                      aria-label={`Eliminar ${image.file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col border-b border-border/80 px-4 py-4 xl:border-b-0">
            <div className="mb-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Panel de anotación</h2>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={panelView === "canvas" ? "default" : "outline"}
                    onClick={() => setPanelView("canvas")}
                  >
                    Canvas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={panelView === "csv" ? "default" : "outline"}
                    onClick={() => setPanelView("csv")}
                  >
                    CSV
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {panelView === "canvas"
                  ? "Haz zoom y dibuja cuadros con la etiqueta activa."
                  : "Visualiza y ajusta el CSV actual directamente desde la tabla."}
              </p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className={panelView === "canvas" ? "flex min-h-0 flex-1 flex-col gap-4" : "hidden"}>
                {!currentImage && <p className="text-sm text-muted-foreground">Selecciona una imagen para empezar.</p>}
                {currentImage && (
                  <>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={interactionMode === "draw" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInteractionMode("draw")}
                      >
                        Dibujar
                      </Button>
                      <Button
                        type="button"
                        variant={interactionMode === "pan" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInteractionMode("pan")}
                      >
                        Mover
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(2))))}
                      >
                        -
                      </Button>
                      <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setZoom((value) => Math.min(3, Number((value + 0.1).toFixed(2))))}
                      >
                        +
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setZoom(1)}>
                        Reset
                      </Button>
                      <Button
                        type="button"
                        variant={showGridGuide ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setShowGridGuide((value) => !value)}
                      >
                        Guía
                      </Button>
                    </div>

                    <div
                      ref={viewportRef}
                      className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/80 bg-muted/70 p-2"
                    >
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-2">
                        <div
                          ref={stageRef}
                          className={`absolute select-none ${interactionMode === "pan" ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair"}`}
                          style={{
                            width: stageWidth,
                            height: stageHeight,
                            left: stageLeft,
                            top: stageTop,
                          }}
                          onMouseDown={handleStageMouseDown}
                          onMouseMove={handleStageMouseMove}
                          onMouseUp={handleStageMouseUp}
                          onMouseLeave={handleStageMouseLeave}
                        >
                          <img
                            src={currentImage.url}
                            alt={currentImage.file.name}
                            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
                            draggable={false}
                            onLoad={(event) => {
                              const imageWidth = event.currentTarget.naturalWidth
                              const imageHeight = event.currentTarget.naturalHeight

                              setImages((previous) =>
                                previous.map((image) => {
                                  if (image.id !== currentImage.id) return image
                                  if (image.width === imageWidth && image.height === imageHeight) return image
                                  return {
                                    ...image,
                                    width: imageWidth,
                                    height: imageHeight,
                                  }
                                }),
                              )
                            }}
                          />

                          {showGridGuide && (
                            <div
                              className="pointer-events-none absolute inset-0"
                              style={{
                                backgroundImage:
                                  "linear-gradient(to right, rgba(87,148,242,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(87,148,242,0.18) 1px, transparent 1px)",
                                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                              }}
                            />
                          )}

                          <div className="absolute inset-0">
                            {currentAnnotations.map((annotation) => (
                              <button
                                key={annotation.id}
                                type="button"
                                className="group absolute border-2"
                                style={{
                                  left: `${(annotation.x / naturalWidth) * 100}%`,
                                  top: `${(annotation.y / naturalHeight) * 100}%`,
                                  width: `${(annotation.width / naturalWidth) * 100}%`,
                                  height: `${(annotation.height / naturalHeight) * 100}%`,
                                  borderColor: labelColors[annotation.label]?.solid ?? "#111827",
                                  backgroundColor:
                                    selectedAnnotationIds.includes(annotation.id)
                                      ? labelColors[annotation.label]?.overlayStrong ?? "transparent"
                                      : labelColors[annotation.label]?.overlay ?? "transparent",
                                }}
                                onClick={(event) => {
                                  event.stopPropagation()
                                }}
                                onMouseDown={(event) => startMoveAnnotation(event, annotation)}
                                title={annotation.label}
                              >
                                <div
                                  className="pointer-events-none absolute -top-7 left-0 z-10 rounded px-2 py-1 text-[11px] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                                  style={{ backgroundColor: labelColors[annotation.label]?.solid ?? "#111827" }}
                                >
                                  {annotation.label}
                                </div>
                                {selectedAnnotationId === annotation.id && (
                                  <>
                                    <span
                                      className="absolute -left-1.5 -top-1.5 h-3 w-3 cursor-nwse-resize rounded-full border border-white"
                                      style={{ backgroundColor: labelColors[annotation.label]?.solid ?? "#111827" }}
                                      onMouseDown={(event) => startResizeAnnotation(event, annotation, "nw")}
                                    />
                                    <span
                                      className="absolute -right-1.5 -top-1.5 h-3 w-3 cursor-nesw-resize rounded-full border border-white"
                                      style={{ backgroundColor: labelColors[annotation.label]?.solid ?? "#111827" }}
                                      onMouseDown={(event) => startResizeAnnotation(event, annotation, "ne")}
                                    />
                                    <span
                                      className="absolute -bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize rounded-full border border-white"
                                      style={{ backgroundColor: labelColors[annotation.label]?.solid ?? "#111827" }}
                                      onMouseDown={(event) => startResizeAnnotation(event, annotation, "sw")}
                                    />
                                    <span
                                      className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border border-white"
                                      style={{ backgroundColor: labelColors[annotation.label]?.solid ?? "#111827" }}
                                      onMouseDown={(event) => startResizeAnnotation(event, annotation, "se")}
                                    />
                                  </>
                                )}
                              </button>
                            ))}

                            {draftBox && (
                              <div
                                className="absolute border-2"
                                style={{
                                  left: `${(draftBox.x / naturalWidth) * 100}%`,
                                  top: `${(draftBox.y / naturalHeight) * 100}%`,
                                  width: `${(draftBox.width / naturalWidth) * 100}%`,
                                  height: `${(draftBox.height / naturalHeight) * 100}%`,
                                  borderColor: labelColors[activeLabel]?.solid ?? "#111827",
                                  backgroundColor: labelColors[activeLabel]?.overlay ?? "transparent",
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">{currentImage.file.name}</p>
                  </>
                )}
              </div>
              {panelView === "csv" && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/80 bg-card/70">
                  {csvRows.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">No hay filas para mostrar en el CSV actual.</div>
                  ) : (
                    <div className="h-full w-full overflow-auto">
                      <table className="w-max min-w-full border-collapse text-xs">
                        <thead className="sticky top-0 bg-secondary text-foreground/80">
                          <tr>
                            <th className="border-b border-border px-2 py-2 text-left">label_name</th>
                            <th className="border-b border-border px-2 py-2 text-left">bbox_x</th>
                            <th className="border-b border-border px-2 py-2 text-left">bbox_y</th>
                            <th className="border-b border-border px-2 py-2 text-left">bbox_width</th>
                            <th className="border-b border-border px-2 py-2 text-left">bbox_height</th>
                            <th className="border-b border-border px-2 py-2 text-left">image_name</th>
                            <th className="border-b border-border px-2 py-2 text-left">image_width</th>
                            <th className="border-b border-border px-2 py-2 text-left">image_height</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.map((row) => {
                            const isSelected = row.imageId === currentId && selectedAnnotationIds.includes(row.annotationId)
                            return (
                              <tr
                                key={row.annotationId}
                                className={isSelected ? "bg-secondary" : "hover:bg-muted"}
                                onClick={(event) => {
                                  setCurrentId(row.imageId)
                                  if (event.metaKey || event.ctrlKey) {
                                    toggleAnnotationSelection(row.annotationId)
                                  } else {
                                    selectSingleAnnotation(row.annotationId)
                                  }
                                }}
                              >
                                <td className="border-b border-border/60 px-2 py-1.5">
                                  <LwSelect
                                    compact
                                    value={row.label}
                                    onChange={(event) => updateAnnotationFromCsv(row, "label", event.target.value)}
                                    containerClassName="min-w-[140px]"
                                  >
                                    {labels.map((label) => (
                                      <option key={label} value={label}>
                                        {label}
                                      </option>
                                    ))}
                                  </LwSelect>
                                </td>
                                <td className="border-b border-border/60 px-2 py-1.5">
                                  <input
                                    type="number"
                                    value={Math.round(row.x)}
                                    onChange={(event) => updateAnnotationFromCsv(row, "x", event.target.value)}
                                    className="h-8 w-20 rounded border border-input bg-background px-2"
                                  />
                                </td>
                                <td className="border-b border-border/60 px-2 py-1.5">
                                  <input
                                    type="number"
                                    value={Math.round(row.y)}
                                    onChange={(event) => updateAnnotationFromCsv(row, "y", event.target.value)}
                                    className="h-8 w-20 rounded border border-input bg-background px-2"
                                  />
                                </td>
                                <td className="border-b border-border/60 px-2 py-1.5">
                                  <input
                                    type="number"
                                    min={MIN_BOX_SIZE}
                                    value={Math.round(row.width)}
                                    onChange={(event) => updateAnnotationFromCsv(row, "width", event.target.value)}
                                    className="h-8 w-24 rounded border border-input bg-background px-2"
                                  />
                                </td>
                                <td className="border-b border-border/60 px-2 py-1.5">
                                  <input
                                    type="number"
                                    min={MIN_BOX_SIZE}
                                    value={Math.round(row.height)}
                                    onChange={(event) => updateAnnotationFromCsv(row, "height", event.target.value)}
                                    className="h-8 w-24 rounded border border-input bg-background px-2"
                                  />
                                </td>
                                <td className="border-b border-border/60 px-2 py-1.5">{row.imageName}</td>
                                <td className="border-b border-border/60 px-2 py-1.5">{row.imageWidth ?? ""}</td>
                                <td className="border-b border-border/60 px-2 py-1.5">{row.imageHeight ?? ""}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col px-4 py-4">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Etiquetas</h2>
                <Badge variant="outline">{labels.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Crea etiquetas y selecciona la activa para dibujar.</p>
            </div>
            <div className="flex-1 space-y-4 overflow-auto">
              <div className="flex gap-2">
                <Input
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  placeholder="Nueva etiqueta"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      addLabel()
                    }
                  }}
                />
                <Button variant="outline" onClick={addLabel}>
                  Agregar
                </Button>
              </div>

              <Textarea
                value={bulkLabels}
                onChange={(event) => setBulkLabels(event.target.value)}
                placeholder="Lote: perro, gato, carro"
              />
              <Button variant="secondary" className="w-full" onClick={addBulkLabels}>
                Agregar lote
              </Button>

              <div className="space-y-2">
                <p className="text-sm font-medium">Etiqueta activa</p>
                {!currentImage && <p className="text-sm text-muted-foreground">Selecciona una imagen para etiquetar.</p>}
                {currentImage && labels.length === 0 && <p className="text-sm text-muted-foreground">No hay etiquetas disponibles.</p>}
                {currentImage && labels.length > 0 && (
                  <div className="space-y-2">
                    <LwSelect value={activeLabel} onChange={(event) => setActiveLabel(event.target.value)}>
                      {labels.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </LwSelect>
                    <div
                      className="h-2 w-full rounded"
                      style={{ backgroundColor: labelColors[activeLabel]?.solid ?? "#111827" }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Cuadros de la imagen</p>
                {!currentImage && <p className="text-sm text-muted-foreground">Selecciona una imagen para ver sus cuadros.</p>}
                {currentImage && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={selectedAnnotations.length === 0} onClick={copySelectedAnnotation}>
                      Copiar seleccionados
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!copiedAnnotations || copiedAnnotations.length === 0}
                      onClick={pasteAnnotation}
                    >
                      Pegar cuadros
                    </Button>
                  </div>
                )}
                {currentImage && currentAnnotations.length === 0 && <p className="text-sm text-muted-foreground">No hay cuadros aún.</p>}
                {currentImage && currentAnnotations.length > 0 && (
                  <div className="space-y-2.5">
                    {currentAnnotations.map((annotation, index) => (
                      <article
                        key={annotation.id}
                        className={`rounded-xl border p-3 text-sm transition-all ${
                          selectedAnnotationIds.includes(annotation.id)
                            ? "border-primary bg-accent/40 shadow-[0_0_0_1px_var(--color-primary)]"
                            : "border-border bg-card/70 hover:border-ring/60"
                        }`}
                        onClick={(event) => {
                          if (event.metaKey || event.ctrlKey) {
                            toggleAnnotationSelection(annotation.id)
                          } else {
                            selectSingleAnnotation(annotation.id)
                          }
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: labelColors[annotation.label]?.solid ?? "#5794f2" }}
                            />
                            <span className="text-xs font-medium text-muted-foreground">Cuadro #{index + 1}</span>
                          </div>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {annotation.width.toFixed(0)} x {annotation.height.toFixed(0)}
                          </span>
                        </div>

                        <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-md bg-muted/70 px-2 py-1">X: {annotation.x.toFixed(0)}</span>
                          <span className="rounded-md bg-muted/70 px-2 py-1">Y: {annotation.y.toFixed(0)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <LwSelect
                            value={annotation.label}
                            onChange={(event) => updateAnnotationLabel(annotation.id, event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            containerClassName="min-w-0 flex-1"
                          >
                            {labels.map((label) => (
                              <option key={label} value={label}>
                                {label}
                              </option>
                            ))}
                          </LwSelect>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation()
                              deleteAnnotation(annotation.id)
                            }}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App

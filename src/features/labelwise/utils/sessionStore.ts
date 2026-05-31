import type { AnnotationBox, LabelColor } from "@/features/labelwise/types"

const DB_NAME = "labelwise"
const DB_VERSION = 1

type ImageFileRecord = {
  id: string
  name: string
  type: string
  lastModified: number
  buffer: ArrayBuffer
}

type ImageStateRecord = {
  id: string
  annotations: AnnotationBox[]
  width?: number
  height?: number
}

export type SessionMeta = {
  labels: string[]
  labelColors: Record<string, LabelColor>
  activeLabel: string
  currentId: string | null
  imageOrder: string[]
}

export type LoadedSession = {
  files: ImageFileRecord[]
  states: Map<string, ImageStateRecord>
  meta: SessionMeta | null
}

// ── DB helpers ────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("imageFiles")) db.createObjectStore("imageFiles", { keyPath: "id" })
      if (!db.objectStoreNames.contains("imageStates")) db.createObjectStore("imageStates", { keyPath: "id" })
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const getDb = () => {
  if (!dbPromise) dbPromise = openDb()
  return dbPromise
}

const idbPut = (db: IDBDatabase, store: string, value: unknown): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

const idbDelete = (db: IDBDatabase, store: string, key: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

const idbGetAll = <T>(db: IDBDatabase, store: string): Promise<T[]> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })

const idbGet = <T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })

// ── Public API ────────────────────────────────────────────────────────────────

export const saveImageFile = async (id: string, file: File): Promise<void> => {
  const buffer = await file.arrayBuffer()
  const db = await getDb()
  await idbPut(db, "imageFiles", { id, name: file.name, type: file.type, lastModified: file.lastModified, buffer })
}

export const saveImageState = async (
  id: string,
  state: { annotations: AnnotationBox[]; width?: number; height?: number },
): Promise<void> => {
  const db = await getDb()
  await idbPut(db, "imageStates", { id, ...state })
}

export const deleteStoredImage = async (id: string): Promise<void> => {
  const db = await getDb()
  await Promise.all([idbDelete(db, "imageFiles", id), idbDelete(db, "imageStates", id)])
}

export const saveMeta = async (meta: SessionMeta): Promise<void> => {
  const db = await getDb()
  await idbPut(db, "meta", { key: "session", ...meta })
}

export const loadSession = async (): Promise<LoadedSession> => {
  const db = await getDb()
  const [files, states, raw] = await Promise.all([
    idbGetAll<ImageFileRecord>(db, "imageFiles"),
    idbGetAll<ImageStateRecord>(db, "imageStates"),
    idbGet<SessionMeta & { key: string }>(db, "meta", "session"),
  ])
  const statesMap = new Map(states.map((s) => [s.id, s]))
  const meta: SessionMeta | null = raw
    ? { labels: raw.labels, labelColors: raw.labelColors, activeLabel: raw.activeLabel, currentId: raw.currentId, imageOrder: raw.imageOrder ?? [] }
    : null
  return { files, states: statesMap, meta }
}

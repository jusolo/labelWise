import { X } from "lucide-react"
import { useEffect, type ReactNode } from "react"

import { Button } from "@/components/ui/button"

// ── Minimal Markdown renderer ─────────────────────────────────────────────────

const parseInline = (text: string): ReactNode[] => {
  const parts: ReactNode[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const token = match[0]
    if (token.startsWith("`")) {
      parts.push(
        <code key={match.index} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80">
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>)
    }
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

const renderMarkdown = (md: string): ReactNode[] => {
  const lines = md.split("\n")
  const nodes: ReactNode[] = []
  let listItems: ReactNode[] | null = null
  let key = 0

  const flushList = () => {
    if (listItems) {
      nodes.push(
        <ul key={key++} className="mb-3 space-y-1 pl-4">
          {listItems}
        </ul>,
      )
      listItems = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.startsWith("# ")) {
      flushList()
      nodes.push(
        <h1 key={key++} className="mb-4 text-xl font-bold tracking-tight text-foreground">
          {parseInline(line.slice(2))}
        </h1>,
      )
      continue
    }

    if (line.startsWith("## ")) {
      flushList()
      nodes.push(
        <h2 key={key++} className="mb-2 mt-6 text-base font-semibold text-primary">
          {parseInline(line.slice(3))}
        </h2>,
      )
      continue
    }

    if (line.startsWith("### ")) {
      flushList()
      nodes.push(
        <h3 key={key++} className="mb-1.5 mt-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {parseInline(line.slice(4))}
        </h3>,
      )
      continue
    }

    if (line.startsWith("- ")) {
      if (!listItems) listItems = []
      listItems.push(
        <li key={key++} className="flex gap-2 text-sm text-foreground/90">
          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60" />
          <span>{parseInline(line.slice(2))}</span>
        </li>,
      )
      continue
    }

    if (line === "---") {
      flushList()
      nodes.push(<hr key={key++} className="my-4 border-border/60" />)
      continue
    }

    if (line.trim() === "") {
      flushList()
      continue
    }

    flushList()
    nodes.push(
      <p key={key++} className="mb-2 text-sm text-muted-foreground">
        {parseInline(line)}
      </p>,
    )
  }

  flushList()
  return nodes
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  content: string
  onClose: () => void
}

export const ChangelogModal = ({ content, onClose }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Changelog</h2>
            <p className="text-xs text-muted-foreground">Historial de cambios de labelWise</p>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto px-6 py-4">{renderMarkdown(content)}</div>
      </div>
    </div>
  )
}

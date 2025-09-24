import { AnimatePresence, motion } from 'framer-motion'
import { Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { JSX } from 'react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  deleteSelectedNodes,
  fetchConversationMessages,
  fetchMessageTree,
  updateMessage,
} from '../../features/chats/chatActions'
import { chatSliceActions } from '../../features/chats/chatSlice'
import { buildBranchPathForMessage } from '../../features/chats/pathUtils'
import type { RootState } from '../../store/store'
import stripMarkdownToText from '../../utils/markdownStripper'
import { TextArea } from '../TextArea/TextArea'
import { TextField } from '../TextField/TextField'

// Type definitions
interface ChatNode {
  id: string
  message: string
  sender: 'user' | 'assistant'
  children: ChatNode[]
}

interface Position {
  x: number
  y: number
  node: ChatNode
}

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface TreeStats {
  totalNodes: number
  maxDepth: number
  branches: number
}

interface HeimdallProps {
  chatData?: ChatNode | null
  compactMode?: boolean
  loading?: boolean
  error?: string | null
  onNodeSelect?: (nodeId: string, path: string[]) => void
  conversationId?: number | null
}

export const Heimdall: React.FC<HeimdallProps> = ({
  chatData = null,
  compactMode = true,
  loading = false,
  error = null,
  onNodeSelect,
  conversationId,
}) => {
  const dispatch = useDispatch()
  const selectedNodes = useSelector((state: RootState) => state.chat.selectedNodes)
  const currentPathIds = useSelector((state: RootState) => state.chat.conversation.currentPath)
  // Track total messages to detect a truly empty conversation
  const messagesCount = useSelector((state: RootState) => state.chat.conversation.messages.length)

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<number>(compactMode ? 1 : 1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [selectedNode, setSelectedNode] = useState<ChatNode | null>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isSelecting, setIsSelecting] = useState<boolean>(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  // Custom context menu after selection
  const [showContextMenu, setShowContextMenu] = useState<boolean>(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  // Note dialog state
  const [showNoteDialog, setShowNoteDialog] = useState<boolean>(false)
  const [noteDialogPos, setNoteDialogPos] = useState<{ x: number; y: number } | null>(null)
  const [noteMessageId, setNoteMessageId] = useState<number | null>(null)
  const [noteText, setNoteText] = useState<string>('')

  // Keep a stable inner offset so the whole tree does not shift when nodes are added/removed
  const offsetRef = useRef<{ x: number; y: number } | null>(null)
  // Track which nodes have already been seen to avoid re-playing enter animations
  const seenNodeIdsRef = useRef<Set<string>>(new Set())
  const firstPaintRef = useRef<boolean>(true)
  // Keep last non-null tree to avoid unmount flicker during refreshes
  const lastDataRef = useRef<ChatNode | null>(null)
  // Ensure we only auto-center once per conversation load
  const hasCenteredRef = useRef<boolean>(false)
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
  // Refs to avoid stale state in global listeners
  const isDraggingRef = useRef<boolean>(false)
  const isSelectingRef = useRef<boolean>(false)
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  // Ref to record last mouse-up position for context menu anchoring
  const lastMouseUpPosRef = useRef<{ x: number; y: number } | null>(null)
  // Refs for latest zoom and pan to avoid stale closures inside wheel listener
  const zoomRef = useRef<number>(zoom)
  const panRef = useRef<{ x: number; y: number }>(pan)
  // Focused message id from global state and flat messages for search
  const focusedChatMessageId = useSelector((state: RootState) => state.chat.conversation.focusedChatMessageId)
  const flatMessages = useSelector((state: RootState) => state.chat.conversation.messages)
  // Get the current message from Redux state
  const getCurrentMessage = useCallback(
    (messageId: number) => {
      return flatMessages.find(m => m.id === messageId)
    },
    [flatMessages]
  )

  // Maintain a plain-text processed copy of messages for client-side search
  const [plainMessages, setPlainMessages] = useState<any[]>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = (await stripMarkdownToText(flatMessages as any)) as any
        if (!cancelled) {
          setPlainMessages(Array.isArray(res) ? (res as any[]) : (flatMessages as any[]))
        }
      } catch {
        if (!cancelled) setPlainMessages(flatMessages as any[])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [flatMessages])
  // Search UI state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchOpen, setSearchOpen] = useState<boolean>(false)
  const [searchHoverIndex, setSearchHoverIndex] = useState<number>(-1)
  const filteredResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) return [] as { id: number; content: string }[]
    // Filter by content; show up to 12 results
    const res = (plainMessages as any[])
      .filter(m => {
        const plain = (m?.content_plain_text || m?.plain_text_content || m?.content || '').toLowerCase()
        return typeof plain === 'string' && plain.includes(q)
      })
      .slice(0, 12)
      .map(m => ({ id: m.id, content: m.content }))
    return res
  }, [searchQuery, plainMessages])
  const lastCenteredIdRef = useRef<string | null>(null)
  // Only center when focus comes from the search bar, not other sources
  const searchFocusPendingRef = useRef<boolean>(false)
  // Global text selection suppression while panning (originated in Heimdall)
  const addGlobalNoSelect = () => {
    try {
      document.body.classList.add('ygg-no-select')
    } catch {}
  }

  // Debounced update function for notes
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedUpdateNote = useCallback(
    (messageId: number, content: string, note: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      debounceTimeoutRef.current = setTimeout(() => {
        dispatch(updateMessage({ id: messageId, content, note }) as any)
      }, 500) // 500ms debounce
    },
    [dispatch]
  )

  // Handle note dialog
  const handleOpenNoteDialog = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      const messageId = parseInt(nodeId, 10)
      if (isNaN(messageId)) return

      const message = getCurrentMessage(messageId)
      if (!message) return

      setNoteMessageId(messageId)
      setNoteText(message.note || '')
      setNoteDialogPos(position)
      setShowNoteDialog(true)
      setShowContextMenu(false)
    },
    [getCurrentMessage]
  )

  const handleCloseNoteDialog = useCallback(() => {
    setShowNoteDialog(false)
    setNoteDialogPos(null)
    setNoteMessageId(null)
    setNoteText('')
  }, [])

  const handleNoteTextChange = useCallback(
    (newNoteText: string) => {
      setNoteText(newNoteText)

      if (noteMessageId !== null) {
        const message = getCurrentMessage(noteMessageId)
        if (message) {
          debouncedUpdateNote(noteMessageId, message.content, newNoteText)
        }
      }
    },
    [noteMessageId, getCurrentMessage, debouncedUpdateNote]
  )

  // Pointer Events with pointer capture for robust drag outside element
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    // Don't start dragging if clicking on a node
    const target = e.target as unknown as SVGElement
    if (target && (target.tagName === 'rect' || target.tagName === 'circle')) {
      return
    }
    try {
      e.preventDefault()
    } catch {}
    // Hide any open custom context menu upon new interaction
    setShowContextMenu(false)
    // Capture pointer so we continue to receive move/up events outside
    try {
      ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
    } catch {}

    if (e.button === 2) {
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (svgRect) {
        const svgX = e.clientX - svgRect.left
        const svgY = e.clientY - svgRect.top
        dispatch(chatSliceActions.nodesSelected([]))
        setIsSelecting(true)
        isSelectingRef.current = true
        setSelectionStart({ x: svgX, y: svgY })
        setSelectionEnd({ x: svgX, y: svgY })
        addGlobalNoSelect()
        // Fallback: also track globally in case pointer capture fails in some browsers
        addGlobalMoveListeners()
        const onEnd = () => {
          removeGlobalNoSelect()
          removeGlobalMoveListeners()
          window.removeEventListener('mouseup', onEnd)
          window.removeEventListener('touchend', onEnd)
          window.removeEventListener('blur', onEnd)
          isSelectingRef.current = false
          isDraggingRef.current = false
        }
        window.addEventListener('mouseup', onEnd)
        window.addEventListener('touchend', onEnd)
        window.addEventListener('blur', onEnd)
      }
    } else if (e.button === 0) {
      setIsDragging(true)
      isDraggingRef.current = true
      const ds = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      dragStartRef.current = ds
      addGlobalNoSelect()
      // Fallback: also track globally in case pointer capture fails in some browsers
      addGlobalMoveListeners()
      const onEnd = () => {
        removeGlobalNoSelect()
        removeGlobalMoveListeners()
        window.removeEventListener('mouseup', onEnd)
        window.removeEventListener('touchend', onEnd)
        window.removeEventListener('blur', onEnd)
        isDraggingRef.current = false
        isSelectingRef.current = false
      }
      window.addEventListener('mouseup', onEnd)
      window.addEventListener('touchend', onEnd)
      window.addEventListener('blur', onEnd)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (isDraggingRef.current) {
      setPan({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y })
    } else if (isSelectingRef.current) {
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (svgRect) {
        const svgX = e.clientX - svgRect.left
        const svgY = e.clientY - svgRect.top
        setSelectionEnd({ x: svgX, y: svgY })
      }
    }
  }

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>): void => {
    try {
      ;(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId)
    } catch {}
    // If we were selecting, record mouse-up position to anchor the context menu
    if (isSelectingRef.current) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        lastMouseUpPosRef.current = pos
        setContextMenuPos(pos)
      }
    }
    handleMouseUp()
  }

  const handlePointerCancel = (e: React.PointerEvent<SVGSVGElement>): void => {
    try {
      ;(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId)
    } catch {}
    handleMouseUp()
  }
  const removeGlobalNoSelect = () => {
    try {
      document.body.classList.remove('ygg-no-select')
    } catch {}
  }
  // Safety: ensure global side effects are removed if component unmounts mid-drag
  useEffect(() => {
    return () => {
      removeGlobalNoSelect()
      // Also remove any global move listeners just in case a drag was active
      try {
        // removeGlobalMoveListeners is declared below; function hoisting makes this safe
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        removeGlobalMoveListeners()
      } catch {}
      // Clean up debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Keep refs in sync with latest state for out-of-react listeners
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])
  useEffect(() => {
    panRef.current = pan
  }, [pan])

  // When switching conversations, drop any cached tree so a blank/new conversation
  // does not render the previous conversation's tree.
  // useEffect(() => {
  //   console.log('chatData', chatData)
  //   lastDataRef.current = null
  //   seenNodeIdsRef.current.clear()
  //   chatData = null
  //   offsetRef.current = null
  //   hasCenteredRef.current = false
  //   setSelectedNode(null)
  //   setFocusedNodeId(null)
  //   console.log('chatData 2', chatData)
  // }, [conversationId])

  const nodeWidth = 250
  const nodeHeight = 80
  const circleRadius = 20
  const verticalSpacing = compactMode ? 80 : 120
  const horizontalSpacing = compactMode ? 100 : 350

  // Store last non-null data so we can keep rendering while loading
  useEffect(() => {
    if (chatData) lastDataRef.current = chatData
    // console.log('chatData 3', chatData)
  }, [chatData])

  // When the conversation is truly empty (no messages) and we're not loading,
  // clear the cached lastDataRef so the tree renders as empty instead of
  // persisting the last non-null tree.
  useEffect(() => {
    if (!loading && messagesCount === 0 && chatData == null) {
      lastDataRef.current = null
      // Also reset layout/selection state so a future conversation starts fresh
      seenNodeIdsRef.current.clear()
      offsetRef.current = null
      hasCenteredRef.current = false
      setSelectedNode(null)
      setFocusedNodeId(null)
    }
  }, [loading, messagesCount, chatData])

  useEffect(() => {
    if (chatData !== lastDataRef.current) {
      setIsTransitioning(true)

      // Clear the blur after React has time to complete all updates
      const timeoutId = setTimeout(() => {
        setIsTransitioning(false)
      }, 150) // Adjust timing as needed - 150ms is usually enough

      return () => clearTimeout(timeoutId)
    }
  }, [chatData])

  // Use provided data or fallback to last known (prevents flash on refresh). Do NOT show a fake empty node.
  const currentChatData = useMemo(() => chatData ?? lastDataRef.current ?? null, [chatData])

  // Calculate path from root to a specific node
  const getPathToNode = (targetNodeId: string, node?: ChatNode | null, path: string[] = []): string[] | null => {
    const startNode = node ?? currentChatData
    if (!startNode) return null
    const currentPath = [...path, startNode.id]

    if (startNode.id === targetNodeId) {
      return currentPath
    }

    if (startNode.children) {
      for (const child of startNode.children) {
        const result = getPathToNode(targetNodeId, child, currentPath)
        if (result) return result
      }
    }

    return null
  }

  // Get the complete branch path for a selected node
  const getPathWithDescendants = (targetNodeId: string): string[] => {
    const pathToNode = getPathToNode(targetNodeId)
    if (!pathToNode) return []

    // Find the target node in the tree
    const findNode = (nodeId: string, node?: ChatNode | null): ChatNode | null => {
      const start = node ?? currentChatData
      if (!start) return null
      if (start.id === nodeId) return start
      if (start.children) {
        for (const child of start.children) {
          const found = findNode(nodeId, child)
          if (found) return found
        }
      }
      return null
    }

    const targetNode = findNode(targetNodeId)
    if (!targetNode) return pathToNode

    // Find the end of the branch by following the path to the deepest leaf
    const findBranchEnd = (node: ChatNode): ChatNode => {
      // If no children, this is the end
      if (!node.children || node.children.length === 0) {
        return node
      }
      // If single child, continue down the branch
      if (node.children.length === 1) {
        return findBranchEnd(node.children[0])
      }
      // If multiple children, choose the child with the lowest id and continue down
      const sortedChildren = node.children.slice().sort((a, b) => {
        const na = Number(a.id)
        const nb = Number(b.id)
        const aNum = !Number.isNaN(na)
        const bNum = !Number.isNaN(nb)
        if (aNum && bNum) return na - nb
        if (aNum && !bNum) return -1
        if (!aNum && bNum) return 1
        return a.id.localeCompare(b.id)
      })
      return findBranchEnd(sortedChildren[0])
    }

    // Get the end of the current branch
    const branchEnd = findBranchEnd(targetNode)

    // Return the complete path from root to the end of this branch
    const fullBranchPath = getPathToNode(branchEnd.id)
    return fullBranchPath || pathToNode
  }

  // Reset view when data changes
  // useEffect(() => {
  //   if (chatData) {
  //     setZoom(compactMode ? 1 : 0.6)
  //     setPan({ x: 0, y: 0 })
  //     setFocusedNodeId(null)
  //     setSelectedNode(null)
  //   }
  // }, [chatData, compactMode])

  // Calculate tree statistics
  const getTreeStats = (node: ChatNode): TreeStats => {
    let totalNodes = 0
    let maxDepth = 0
    let branches = 0

    const traverse = (n: ChatNode, depth: number = 0): void => {
      totalNodes++
      maxDepth = Math.max(maxDepth, depth)
      if (n.children && n.children.length > 1) branches++
      n.children?.forEach(child => traverse(child, depth + 1))
    }

    traverse(node)
    return { totalNodes, maxDepth, branches }
  }

  const stats = useMemo(
    () => (currentChatData ? getTreeStats(currentChatData) : { totalNodes: 0, maxDepth: 0, branches: 0 }),
    [currentChatData]
  )

  // Calculate tree layout
  const calculateTreeLayout = (node: ChatNode): Record<string, Position> => {
    const positions: Record<string, Position> = {}

    const calculateSubtreeWidth = (node: ChatNode): number => {
      if (!node.children || node.children.length === 0) return 1
      return node.children.reduce((sum, child) => sum + calculateSubtreeWidth(child), 0)
    }

    const layoutNode = (node: ChatNode, x: number, y: number): void => {
      positions[node.id] = { x, y, node }

      if (node.children && node.children.length > 0) {
        const totalWidth = node.children.reduce((sum, child) => sum + calculateSubtreeWidth(child), 0)
        let currentX = x - ((totalWidth - 1) * horizontalSpacing) / 2

        node.children.forEach(child => {
          const childWidth = calculateSubtreeWidth(child)
          const childX = currentX + ((childWidth - 1) * horizontalSpacing) / 2
          layoutNode(child, childX, y + verticalSpacing)
          currentX += childWidth * horizontalSpacing
        })
      }
    }

    layoutNode(node, 0, 0)
    return positions
  }

  // Memoize layout so it only recomputes when inputs actually change (e.g., data or spacings)
  const positions = useMemo(
    () => (currentChatData ? calculateTreeLayout(currentChatData) : {}),
    [currentChatData, horizontalSpacing, verticalSpacing]
  )

  // Memoized set for quick membership checks of nodes on the current conversation path
  const currentPathSet = useMemo(() => new Set(currentPathIds ?? []), [currentPathIds])

  // After each render commit, mark current nodes as seen.
  // On first paint, prime the set and disable initial animations.
  useEffect(() => {
    const ids = Object.keys(positions)
    ids.forEach(id => seenNodeIdsRef.current.add(id))
    if (firstPaintRef.current) {
      firstPaintRef.current = false
    }
  }, [positions])

  // Calculate SVG bounds (memoized)
  const bounds = useMemo(() => {
    const values = Object.values(positions)
    if (values.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    }
    return values.reduce<Bounds>(
      (acc, pos) => {
        const isExpanded = !compactMode || pos.node.id === focusedNodeId
        const halfWidth = isExpanded ? nodeWidth / 2 : circleRadius
        const height = isExpanded ? nodeHeight : circleRadius * 2

        return {
          minX: Math.min(acc.minX, pos.x - halfWidth),
          maxX: Math.max(acc.maxX, pos.x + halfWidth),
          minY: Math.min(acc.minY, pos.y),
          maxY: Math.max(acc.maxY, pos.y + height),
        }
      },
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    )
  }, [positions, compactMode, focusedNodeId])

  // Initialize offsets once (when we have real data) so the tree doesn't jump when nodes change
  useEffect(() => {
    if (!offsetRef.current && chatData) {
      offsetRef.current = { x: -bounds.minX + 50, y: -bounds.minY + 50 }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, chatData])

  const hasPositions = Object.keys(positions).length > 0
  const offsetX = hasPositions ? (offsetRef.current ? offsetRef.current.x : -bounds.minX + 50) : 0
  const offsetY = hasPositions ? (offsetRef.current ? offsetRef.current.y : -bounds.minY + 50) : 0

  // Center the viewport on a specific node id (string) without altering zoom
  const centerOnNode = (targetNodeId: string): void => {
    const pos = positions[targetNodeId]
    if (!pos) return
    const s = zoomRef.current
    const ox = offsetRef.current ? offsetRef.current.x : offsetX
    const oy = offsetRef.current ? offsetRef.current.y : offsetY
    // Measure container size to compute true center
    const w = dimensions.width || containerRef.current?.offsetWidth || 0
    const h = dimensions.height || containerRef.current?.offsetHeight || 0
    const px = w / 2 - (pos.x + ox) * s - w / 2 // simplifies to -(pos.x + ox) * s
    const py = h / 2 - (pos.y + oy) * s - 100 // account for top translate(+, 100)
    setPan({ x: px, y: py })
  }

  // React to focusedChatMessageId changes by centering the corresponding node when present
  useEffect(() => {
    if (!focusedChatMessageId) return
    const idStr = String(focusedChatMessageId)
    if (!positions[idStr]) return
    // Only auto-center if this focus was initiated by the search bar
    if (!searchFocusPendingRef.current) return
    if (lastCenteredIdRef.current === idStr) return
    centerOnNode(idStr)
    lastCenteredIdRef.current = idStr
    searchFocusPendingRef.current = false
  }, [focusedChatMessageId, positions, dimensions.width, dimensions.height, offsetX, offsetY])

  // Center the view on the root node once, after layout and container dimensions are ready
  useEffect(() => {
    // Need real data and container dimensions
    if (!chatData) return
    if (!dimensions.width || !dimensions.height) return
    // Ensure positions are available and we haven't centered yet
    const id = currentChatData?.id
    if (!id) return
    const root = positions[id]
    if (!root) return
    if (hasCenteredRef.current) return

    // Compute a zoom that fits the current tree bounds into the available viewport
    const contentW = Math.max(1, bounds.maxX - bounds.minX + 100) // add some horizontal padding
    const contentH = Math.max(1, bounds.maxY - bounds.minY + 140) // add some vertical padding
    const availW = Math.max(1, dimensions.width - 120)
    const availH = Math.max(1, dimensions.height - 180) // account for top controls/help
    const fitZoom = Math.min(availW / contentW, availH / contentH)
    const preferredMaxInitialZoom = 0.8
    const targetZoom = Math.max(0.1, Math.min(3, Math.min(fitZoom, preferredMaxInitialZoom)))

    setZoom(targetZoom)

    // Center the root node with the computed zoom
    const s = targetZoom
    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2
    const px = centerX - (root.x + offsetX) * s - centerX
    const py = centerY - (root.y + offsetY) * s - 300
    setPan({ x: px, y: py })
    hasCenteredRef.current = true
  }, [positions, bounds, dimensions.width, dimensions.height, zoom, offsetX, offsetY, chatData, currentChatData?.id])

  useEffect(() => {
    const updateDimensions = (): void => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current
        setDimensions({ width: offsetWidth, height: offsetHeight })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // When compact mode changes, re-fit the view using the updated bounds/layout.
  useEffect(() => {
    // Ensure we have data and measured dimensions before resetting
    if (!currentChatData) return
    if (!dimensions.width || !dimensions.height) return
    if (Object.keys(positions).length === 0) return

    const raf = requestAnimationFrame(() => {
      resetView()
    })
    return () => cancelAnimationFrame(raf)
  }, [compactMode])

  // Prevent body scroll when mouse is over the component
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: globalThis.WheelEvent) => {
      // If the wheel event originates inside an element that should allow native scrolling
      // (e.g., the search dropdown list), do NOT hijack it for zooming.
      const cont = containerRef.current
      if (cont) {
        let el = e.target as Node | null
        while (el && el !== cont) {
          if (el instanceof HTMLElement && el.dataset?.heimdallWheelExempt === 'true') {
            // Let the inner element handle its own scrolling
            return
          }
          el = (el as HTMLElement).parentElement
        }
      }

      // Prevent default scrolling behavior and handle zoom instead
      try {
        e.preventDefault()
      } catch {}
      try {
        e.stopPropagation()
      } catch {}

      // Handle zoom centered at the cursor position
      const svgEl = svgRef.current
      // Normalize delta to pixels across browsers/devices
      const LINE_HEIGHT = 16
      const PAGE_HEIGHT = 800
      const normalizeDeltaPx = (dy: number, mode: number, pageH: number): number => {
        if (mode === 1) return dy * LINE_HEIGHT // lines -> px
        if (mode === 2) return dy * pageH // pages -> px
        return dy // already in px
      }
      if (!svgEl) {
        const deltaYPx = normalizeDeltaPx(e.deltaY, e.deltaMode, PAGE_HEIGHT)
        const scale = Math.exp(-deltaYPx * 0.001) // smooth, device-independent
        setZoom(prev => Math.max(0.1, Math.min(3, prev * scale)))
        return
      }

      const rect = svgEl.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top

      const currentZoom = zoomRef.current
      // Normalize deltaY using actual pixel-equivalent distance, then map via exponential scale
      const deltaYPx = normalizeDeltaPx(e.deltaY, e.deltaMode, rect.height)
      const scale = Math.exp(-deltaYPx * 0.001) // smaller factor => less sensitive
      const newZoom = Math.max(0.1, Math.min(3, currentZoom * scale))

      // No change
      if (newZoom === currentZoom) return

      const currentPan = panRef.current

      // Outer group transform components (derive width from current SVG rect to avoid stale dimensions)
      const tx = currentPan.x + rect.width / 2
      const ty = currentPan.y + 100

      // Use stable inner offset if available, else fall back to computed values
      const ox = offsetRef.current ? offsetRef.current.x : offsetX
      const oy = offsetRef.current ? offsetRef.current.y : offsetY

      // Convert cursor screen position to world coordinates under current transform
      const worldX = (cursorX - tx) / currentZoom - ox
      const worldY = (cursorY - ty) / currentZoom - oy

      // Compute new pan so that the same world point stays under the cursor after zoom
      const newPanX = cursorX - (worldX + ox) * newZoom - rect.width / 2
      const newPanY = cursorY - (worldY + oy) * newZoom - 100

      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }

    // Add wheel listener with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // Function to determine which nodes are within the selection rectangle
  const getNodesInSelectionRectangle = (): number[] => {
    const selectedNodeIds: number[] = []

    // Calculate selection rectangle bounds
    const minX = Math.min(selectionStart.x, selectionEnd.x)
    const maxX = Math.max(selectionStart.x, selectionEnd.x)
    const minY = Math.min(selectionStart.y, selectionEnd.y)
    const maxY = Math.max(selectionStart.y, selectionEnd.y)

    // Outer group transform (pan + zoom) in screen coordinates
    const tx = pan.x + dimensions.width / 2
    const ty = pan.y + 100
    const s = zoom

    // Account for inner group offset used to keep the tree in view
    Object.values(positions).forEach(({ x, y, node }) => {
      const x0 = x + offsetX
      const y0 = y + offsetY

      const isExpanded = !compactMode || node.id === focusedNodeId

      // Compute node bounds in screen space (after all transforms)
      let left: number, right: number, top: number, bottom: number

      if (isExpanded) {
        // Expanded nodes are rendered as a rectangle with top-left at (x - nodeWidth/2, y)
        left = (x0 - nodeWidth / 2) * s + tx
        right = (x0 + nodeWidth / 2) * s + tx
        top = y0 * s + ty
        bottom = (y0 + nodeHeight) * s + ty
      } else {
        // Compact nodes are rendered as a circle centered at (x, y + circleRadius),
        // but the top of the bounding box is y and height is 2 * circleRadius.
        left = (x0 - circleRadius) * s + tx
        right = (x0 + circleRadius) * s + tx
        top = y0 * s + ty
        bottom = (y0 + circleRadius * 2) * s + ty
      }

      // Intersect test between node bounds and selection rectangle (all in screen space)
      const intersects = right >= minX && left <= maxX && bottom >= minY && top <= maxY
      if (intersects) {
        const nodeIdNumber = parseInt(node.id, 10)
        if (!isNaN(nodeIdNumber)) {
          selectedNodeIds.push(nodeIdNumber)
        }
      }
    })

    return selectedNodeIds
  }

  // Removed dominant-branch filtering to allow selecting nodes across multiple branches

  // (legacy mouse handlers removed in favor of pointer events)

  const handleMouseUp = (): void => {
    if (isSelecting) {
      // Calculate which nodes are within the selection rectangle
      const selectedNodeIds = getNodesInSelectionRectangle()
      // Replace selection with nodes from this drag (no branch filtering)
      dispatch(chatSliceActions.nodesSelected(selectedNodeIds))
      setIsSelecting(false)
      isSelectingRef.current = false
      // If any nodes were selected, open custom context menu at last mouse-up position
      if (selectedNodeIds.length > 0 && lastMouseUpPosRef.current) {
        setShowContextMenu(true)
      } else {
        setShowContextMenu(false)
      }
    }
    setIsDragging(false)
    isDraggingRef.current = false
    // Extra safety in case global listeners missed it
    removeGlobalNoSelect()
  }

  // Global move listeners to continue interactions outside the SVG
  const onWindowMouseMove = (e: globalThis.MouseEvent): void => {
    if (isDraggingRef.current) {
      setPan({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y })
    } else if (isSelectingRef.current) {
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (svgRect) {
        const svgX = e.clientX - svgRect.left
        const svgY = e.clientY - svgRect.top
        setSelectionEnd({ x: svgX, y: svgY })
      }
    }
  }

  const onWindowTouchMove = (e: globalThis.TouchEvent): void => {
    // Prevent page scroll while interacting
    if (isDraggingRef.current || isSelectingRef.current) {
      try {
        e.preventDefault()
      } catch {}
    }
    if (!e.touches || e.touches.length === 0) return
    const t = e.touches[0]
    if (isDraggingRef.current) {
      setPan({ x: t.clientX - dragStartRef.current.x, y: t.clientY - dragStartRef.current.y })
    } else if (isSelectingRef.current) {
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (svgRect) {
        const svgX = t.clientX - svgRect.left
        const svgY = t.clientY - svgRect.top
        setSelectionEnd({ x: svgX, y: svgY })
      }
    }
  }

  const addGlobalMoveListeners = (): void => {
    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('pointermove', onWindowMouseMove)
    window.addEventListener('touchmove', onWindowTouchMove, { passive: false })
  }

  const removeGlobalMoveListeners = (): void => {
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('pointermove', onWindowMouseMove)
    window.removeEventListener('touchmove', onWindowTouchMove)
  }

  // Handle right-click context menu events
  const handleContextMenu = (e: React.MouseEvent<SVGElement>, nodeId: string): void => {
    e.preventDefault() // Prevent default browser context menu
    e.stopPropagation()

    // Convert nodeId to number for selectedNodes array
    const nodeIdNumber = parseInt(nodeId, 10)

    // Check if the node is already selected
    const isAlreadySelected = selectedNodes.includes(nodeIdNumber)

    let newSelectedNodes: number[]

    if (e.ctrlKey || e.metaKey) {
      // Multi-select: toggle the node in the selection
      if (isAlreadySelected) {
        newSelectedNodes = selectedNodes.filter(id => id !== nodeIdNumber)
      } else {
        newSelectedNodes = [...selectedNodes, nodeIdNumber]
      }
    } else {
      // Without modifiers: toggle off if already selected; otherwise single-select this node
      if (isAlreadySelected) {
        newSelectedNodes = selectedNodes.filter(id => id !== nodeIdNumber)
      } else {
        newSelectedNodes = [nodeIdNumber]
      }
    }

    // Dispatch the nodesSelected action without branch filtering
    dispatch(chatSliceActions.nodesSelected(newSelectedNodes))

    // Show context menu at the right-click position
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect && newSelectedNodes.length > 0) {
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setContextMenuPos(pos)
      setShowContextMenu(true)
    }
  }

  // Delete selected nodes using their message IDs
  const handleDeleteNodes = async (): Promise<void> => {
    try {
      const ids = selectedNodes || []
      if (ids.length === 0 || !conversationId) {
        setShowContextMenu(false)
        return
      }

      // Dispatch the delete action
      await (dispatch as any)(deleteSelectedNodes(ids)).unwrap()

      // Clear selection after successful delete
      dispatch(chatSliceActions.nodesSelected([]))

      // Refresh the message tree to reflect changes
      await (dispatch as any)(fetchMessageTree(conversationId))

      // Also refresh conversation messages to keep them in sync
      await (dispatch as any)(fetchConversationMessages(conversationId))
    } catch (error) {
      console.error('Failed to delete nodes:', error)
    } finally {
      setShowContextMenu(false)
    }
  }

  // Copy messages along the union of root->selected-node paths
  const handleCopySelectedPaths = async (): Promise<void> => {
    try {
      const ids = selectedNodes || []
      if (!currentChatData || ids.length === 0) {
        setShowContextMenu(false)
        return
      }
      // Build id -> message map from the current tree
      const messagesById = new Map<string, string>()
      const visit = (node: ChatNode | null): void => {
        if (!node) return
        messagesById.set(node.id, node.message)
        node.children?.forEach(visit)
      }
      visit(currentChatData)

      // Collect only selected nodes' messages, preserving the selectedNodes order
      const messages: string[] = []
      const seen = new Set<string>()
      for (const idNum of ids) {
        const idStr = String(idNum)
        if (seen.has(idStr)) continue
        seen.add(idStr)
        const msg = messagesById.get(idStr)
        if (typeof msg === 'string') messages.push(msg)
      }

      const text = messages.join('\n\n')
      if (text.trim().length > 0) {
        try {
          await navigator.clipboard.writeText(text)
        } catch (err) {
          // Fallback if clipboard API fails
          const ta = document.createElement('textarea')
          ta.value = text
          ta.style.position = 'fixed'
          ta.style.left = '-9999px'
          document.body.appendChild(ta)
          ta.focus()
          ta.select()
          try {
            document.execCommand('copy')
          } finally {
            document.body.removeChild(ta)
          }
        }
      }
    } finally {
      setShowContextMenu(false)
      // Clear selection after copy
      dispatch(chatSliceActions.nodesSelected([]))
    }
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!showContextMenu) return
    const onDown = () => {
      setShowContextMenu(false)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setShowContextMenu(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [showContextMenu])

  // Close note dialog only on escape key (not on outside click)
  useEffect(() => {
    if (!showNoteDialog) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') handleCloseNoteDialog()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [showNoteDialog, handleCloseNoteDialog])

  const resetView = (): void => {
    // Compute bounds for fitting that ignore focusedNodeId so fit is consistent
    // across calls regardless of previous focus state.
    console.log('resetView called -------------')
    const fitBounds = (() => {
      const values = Object.values(positions)
      if (values.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
      }
      return values.reduce<Bounds>(
        (acc, pos) => {
          // For fitting, treat nodes as expanded only when not in compactMode
          const isExpandedForFit = !compactMode
          const halfWidth = isExpandedForFit ? nodeWidth / 2 : circleRadius
          const height = isExpandedForFit ? nodeHeight : circleRadius * 2

          return {
            minX: Math.min(acc.minX, pos.x - halfWidth),
            maxX: Math.max(acc.maxX, pos.x + halfWidth),
            minY: Math.min(acc.minY, pos.y),
            maxY: Math.max(acc.maxY, pos.y + height),
          }
        },
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      )
    })()

    // Fit-to-screen zoom based on local fitBounds and container dimensions
    const contentW = Math.max(1, fitBounds.maxX - fitBounds.minX + 100)
    const contentH = Math.max(1, fitBounds.maxY - fitBounds.minY + 140)
    const availW = Math.max(1, dimensions.width - 120)
    const availH = Math.max(1, dimensions.height - 180)
    const fitZoom = Math.min(availW / contentW, availH / contentH)
    const preferredMaxInitialZoom = 0.8
    const newZoom = Math.max(0.1, Math.min(3, Math.min(fitZoom, preferredMaxInitialZoom)))
    setZoom(newZoom)
    setFocusedNodeId(null)

    // Recompute base offset based on local fitBounds
    offsetRef.current = { x: -fitBounds.minX + 50, y: -fitBounds.minY + 50 }

    // Center the root node in the viewport using the new zoom
    const id = currentChatData?.id
    if (!id) return
    const root = positions[id]
    if (!root) return
    const s = newZoom
    const ox = offsetRef.current.x
    const oy = offsetRef.current.y
    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2
    const px = centerX - ((root.x ?? 0) + ox) * s - centerX
    const py = centerY - ((root.y ?? 0) + oy) * s - 440
    setPan({ x: px, y: py })

    // We've just centered explicitly
    hasCenteredRef.current = true
  }

  const zoomIn = (): void => setZoom(prev => Math.min(3, prev * 1.2))
  const zoomOut = (): void => setZoom(prev => Math.max(0.1, prev / 1.2))

  const renderConnections = (): JSX.Element[] => {
    const connections: JSX.Element[] = []

    Object.values(positions).forEach(({ x, y, node }) => {
      if (node.children && node.children.length > 0) {
        const verticalDropHeight = verticalSpacing * 0.4
        const isParentExpanded = !compactMode || node.id === focusedNodeId
        const parentBottomY = y + (isParentExpanded ? nodeHeight : circleRadius * 2)
        const branchY = parentBottomY + verticalDropHeight

        if (node.children.length === 1) {
          // Single child - straight vertical line
          const childPos = positions[node.children[0].id]
          if (childPos) {
            connections.push(
              <line
                key={`${node.id}-${node.children[0].id}`}
                x1={x}
                y1={parentBottomY}
                x2={childPos.x}
                y2={childPos.y}
                stroke='#4b5563'
                strokeWidth='2'
              />
            )
          }
        } else {
          // Multiple children - create tree structure
          const childPositions = node.children.map(child => positions[child.id]).filter(Boolean)
          if (childPositions.length > 0) {
            // Main vertical drop from parent
            connections.push(
              <line
                key={`${node.id}-drop`}
                x1={x}
                y1={parentBottomY}
                x2={x}
                y2={branchY}
                stroke='#4b5563'
                strokeWidth='2'
              />
            )

            // Add junction point
            connections.push(
              <circle
                key={`${node.id}-junction`}
                cx={x}
                cy={branchY}
                r='4'
                fill='#374151'
                stroke='#4b5563'
                strokeWidth='2'
              />
            )

            // Create branches for each child
            node.children.forEach((child, index) => {
              index
              const childPos = positions[child.id]
              if (childPos) {
                const path = `
                  M ${x} ${branchY}
                  L ${childPos.x} ${branchY}
                  L ${childPos.x} ${childPos.y}
                `

                connections.push(
                  <path key={`${node.id}-${child.id}-path`} d={path} fill='none' stroke='#4b5563' strokeWidth='2' />
                )

                // Add small dots at branch points
                if (childPos.x !== x) {
                  connections.push(
                    <circle key={`${node.id}-${child.id}-dot`} cx={childPos.x} cy={branchY} r='3' fill='#4b5563' />
                  )
                }
              }
            })
          }
        }
      }
    })

    return connections
  }

  const renderNodes = (): JSX.Element[] => {
    return Object.values(positions).map(({ x, y, node }) => {
      const isExpanded = !compactMode || node.id === focusedNodeId
      const nodeIdNumber = parseInt(node.id, 10)
      const isNodeSelected = !isNaN(nodeIdNumber) && selectedNodes.includes(nodeIdNumber)
      const isOnCurrentPath = !isNaN(nodeIdNumber) && currentPathSet.has(nodeIdNumber)
      const isNew = !firstPaintRef.current && !seenNodeIdsRef.current.has(node.id)

      if (isExpanded) {
        // Render full node
        return (
          <motion.g
            key={node.id}
            transform={`translate(${x - nodeWidth / 2}, ${y})`}
            initial={isNew ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/* Current path highlight (rendered first so selection can appear above) */}
            {isOnCurrentPath && (
              <rect
                width={nodeWidth + 12}
                height={nodeHeight + 12}
                x={-6}
                y={-6}
                rx='14'
                fill='none'
                stroke='currentColor'
                strokeWidth='3'
                className='animate-pulse-slow stroke-rose-300 dark:stroke-yPurple-50 transition-colors duration-300 '
              />
            )}
            {/* Selection highlight */}
            {isNodeSelected && (
              <rect
                width={nodeWidth + 16}
                height={nodeHeight + 16}
                x={-10}
                y={-10}
                rx='12'
                fill='none'
                stroke='currentColor'
                strokeWidth='3'
                strokeDasharray='5,5'
                className='animate-pulse stroke-neutral-500 dark:stroke-neutral-200'
              />
            )}
            <rect
              width={nodeWidth}
              height={nodeHeight}
              rx='8'
              fill={node.sender === 'user' ? 'oklch(98.7% 0.026 102.212)' : 'oklch(96.2% 0.018 272.314)'}
              stroke='oklch(92.3% 0.003 48.717)' // Border color
              strokeWidth='1' // Border thickness
              className={`cursor-pointer hover:opacity-90 transition-opacity duration-200 ${
                compactMode && focusedNodeId === node.id ? 'animate-pulse' : ''
              } ${node.sender === 'user' ? 'dark:fill-yPurple-500' : 'dark:fill-yBrown-500'} dark:stroke-slate-700`}
              style={{
                filter:
                  compactMode && focusedNodeId === node.id ? 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' : 'none',
              }}
              onMouseEnter={e => {
                setSelectedNode(node)
                const containerRect = containerRef.current?.getBoundingClientRect()
                if (containerRect) {
                  setMousePosition({
                    x: e.clientX - containerRect.left,
                    y: e.clientY - containerRect.top,
                  })
                }
              }}
              onMouseLeave={() => setSelectedNode(null)}
              onClick={() => {
                if (onNodeSelect) {
                  const path = getPathWithDescendants(node.id)
                  onNodeSelect(node.id, path)
                }
              }}
              onContextMenu={e => handleContextMenu(e, node.id)}
            />
            <foreignObject width={nodeWidth} height={nodeHeight} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div className='p-3 text-stone-800 dark:text-stone-200 text-sm h-full flex items-center'>
                <p className='line-clamp-3 '>{node.message}</p>
              </div>
            </foreignObject>
            {/* Note indicator for expanded view */}
            {(() => {
              const nodeIdNumber = parseInt(node.id, 10)
              if (isNaN(nodeIdNumber)) return null
              const message = getCurrentMessage(nodeIdNumber)
              const hasNote = message?.note && message.note.trim().length > 0
              return hasNote ? (
                <circle
                  cx={nodeWidth - 8}
                  cy={nodeHeight - 8}
                  r='4'
                  fill='#fbbf24'
                  stroke='#f59e0b'
                  strokeWidth='1'
                  style={{ pointerEvents: 'none' }}
                />
              ) : null
            })()}
          </motion.g>
        )
      } else {
        // Render compact circle
        return (
          <motion.g
            key={node.id}
            initial={isNew ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {/* Current path highlight for compact mode */}
            {isOnCurrentPath && (
              <circle
                cx={x}
                cy={y + circleRadius}
                r={circleRadius + 8}
                fill='none'
                // stroke='rgba(16, 185, 129, 0.9)'
                strokeWidth='3'
                className='animate-pulse-slow stroke-rose-300 dark:stroke-slate-100'
              />
            )}
            {/* Selection highlight for compact mode */}
            {isNodeSelected && (
              <circle
                cx={x}
                cy={y + circleRadius}
                r={circleRadius + 10}
                fill='none'
                stroke='currentColor'
                strokeWidth='3'
                strokeDasharray='5,5'
                className='animate-pulse stroke-blue-500 dark:stroke-blue-300'
              />
            )}
            <circle
              cx={x}
              cy={y + circleRadius}
              r={circleRadius}
              fill={node.sender === 'user' ? '#64748b' : '#1e293b'}
              className={`cursor-pointer transition-transform duration-150 ${
                node.sender === 'user'
                  ? 'fill-yellow-100 dark:fill-yPurple-500'
                  : 'fill-indigo-300 dark:fill-yBrown-500'
              }`}
              style={{
                transform: selectedNode?.id === node.id ? 'scale(1.1)' : 'scale(1)',
                transformOrigin: `${x}px ${y + circleRadius}px`,
              }}
              stroke={node.sender === 'user' ? 'oklch(70.5% 0.015 286.067)' : ''}
              onMouseEnter={e => {
                setSelectedNode(node)
                const containerRect = containerRef.current?.getBoundingClientRect()
                if (containerRect) {
                  setMousePosition({
                    x: e.clientX - containerRect.left,
                    y: e.clientY - containerRect.top,
                  })
                }
              }}
              onMouseLeave={() => setSelectedNode(null)}
              onClick={() => {
                // Trigger node selection callback
                if (onNodeSelect) {
                  const path = getPathWithDescendants(node.id)
                  onNodeSelect(node.id, path)
                }
              }}
              onContextMenu={e => handleContextMenu(e, node.id)}
            />
            {/* Note indicator for compact view */}
            {(() => {
              const nodeIdNumber = parseInt(node.id, 10)
              if (isNaN(nodeIdNumber)) return null
              const message = getCurrentMessage(nodeIdNumber)
              const hasNote = message?.note && message.note.trim().length > 0
              return hasNote ? (
                <circle
                  cx={x + circleRadius - 6}
                  cy={y + circleRadius + 6}
                  r='3'
                  fill='#fbbf24'
                  stroke='#f59e0b'
                  strokeWidth='1'
                  style={{ pointerEvents: 'none' }}
                />
              ) : null
            })()}
            {/* Add a small indicator for branch nodes */}
            {/* {node.children && node.children.length > 1 && (
              <circle
                cx={x}
                cy={y + circleRadius}
                r='6'
                fill='white'
                opacity='0.4'
                className='animate-pulse'
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              />
            )} */}
          </motion.g>
        )
      }
    })
  }

  // Note: loading overlay is handled within main render to avoid unmounting the tree

  // Note: error overlay is handled within main render to avoid unmounting the tree

  // Note: empty-state overlay is handled within main render to avoid unmounting the tree

  return (
    <div
      ref={containerRef}
      className='w-full h-screen border-l border-stone-200 bg-neutral-50 relative overflow-hidden dark:bg-neutral-900'
      onContextMenu={e => e.preventDefault()}
      style={{
        filter: isTransitioning ? 'none' : 'none',
        transition: 'filter 100ms ease-in-out',
      }}
    >
      {/* Overlays: loading, error, empty-state (non-destructive, do not unmount SVG) */}
      {/* <AnimatePresence>
        {loading && (
          <motion.div
            className='absolute inset-0 z-20 flex items-center justify-center bg-slate-50 text-stone-800 dark:text-stone-200 dark:text-stone-200 dark:bg-neutral-900'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <motion.div
              className='text-white text-center'
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
            >
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4'></div>
              <p className='text-lg'>Loading conversation tree...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence> */}
      <AnimatePresence>
        {error && (
          <motion.div
            className='absolute inset-0 z-20 flex items-center justify-center bg-slate-50 text-stone-800 dark:text-stone-200'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <motion.div
              className='text-white text-center max-w-md'
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
            >
              <div className='text-red-400 text-6xl mb-4'>⚠️</div>
              <p className='text-lg mb-2'>Failed to load conversation</p>
              <p className='text-sm text-gray-400'>{error}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className='absolute inset-0 z-20 flex items-center justify-center bg-slate-50 text-stone-800 dark:text-stone-200'>
          <div className='text-white text-center max-w-md'>
            <div className='text-red-400 text-6xl mb-4'>⚠️</div>
            <p className='text-lg mb-2'>Failed to load conversation</p>
            <p className='text-sm text-gray-400'>{error}</p>
          </div>
        </div>
      )}
      {!error && !loading && !lastDataRef.current && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-slate-50 text-stone-800 dark:text-stone-200 dark:bg-neutral-900'>
          <div className='text-white text-center max-w-md'>
            {/* <div className='text-gray-500 text-6xl mb-4'>💬</div> */}
            <p className='text-lg mb-2'>Loading / Tree will appear here</p>
            {/* <p className='text-sm text-gray-400'>Select a conversation to view its message tree</p> */}
          </div>
        </div>
      )}
      <div className='absolute top-4 left-4 z-10 flex gap-2'>
        <button
          onClick={zoomIn}
          className='p-2 bg-amber-50 text-stone-800 dark:text-stone-200 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-500 dark:bg-neutral-700 transition-colors active:scale-90'
          title='Zoom In'
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={zoomOut}
          className='p-2 bg-amber-50 text-stone-800 dark:text-stone-200 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-500 dark:bg-neutral-700 transition-colors active:scale-90'
          title='Zoom Out'
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={resetView}
          className='p-2 bg-amber-50 text-stone-800 dark:text-stone-200 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-500 dark:bg-neutral-700 transition-colors active:scale-90'
          title='Reset View'
        >
          <RotateCcw size={20} />
        </button>
        <button
          onClick={() => {
            dispatch(chatSliceActions.heimdallCompactModeToggled())
          }}
          className='p-2 bg-amber-50 text-stone-800 dark:text-stone-200 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-500 dark:bg-neutral-700 transition-colors active:scale-90'
          title='Toggle Compact Mode'
        >
          {compactMode ? 'Compact' : 'Full'}
        </button>
      </div>
      <div className='absolute top-4 right-8 z-10 flex flex-col gap-2 items-end'>
        {/* Search bar for messages in the current chat */}
        <div className='w-[400px] relative mb-2'>
          <TextField
            placeholder='Search'
            value={searchQuery}
            onChange={val => {
              setSearchQuery(val)
              setSearchOpen(!!val.trim())
              setSearchHoverIndex(-1)
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSearchHoverIndex(prev => Math.min(prev + 1, Math.max(0, filteredResults.length - 1)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSearchHoverIndex(prev => Math.max(-1, prev - 1))
              } else if (e.key === 'Enter') {
                // Enter selects the highlighted result or the first one
                const item = filteredResults[searchHoverIndex >= 0 ? searchHoverIndex : 0]
                if (item) {
                  searchFocusPendingRef.current = true
                  const path = buildBranchPathForMessage(flatMessages as any, item.id)
                  if (path.length > 0) {
                    dispatch(chatSliceActions.conversationPathSet(path))
                    dispatch(chatSliceActions.selectedNodePathSet(path.map(id => String(id))))
                  }
                  dispatch(chatSliceActions.focusedChatMessageSet(item.id))
                  setSearchOpen(false)
                  setSearchQuery('')
                }
              } else if (e.key === 'Escape') {
                setSearchOpen(false)
              }
            }}
            size='small'
            showSearchIcon
            onSearchClick={() => {
              if (filteredResults.length > 0) {
                const item = filteredResults[0]
                searchFocusPendingRef.current = true
                const path = buildBranchPathForMessage(flatMessages as any, item.id)
                if (path.length > 0) {
                  dispatch(chatSliceActions.conversationPathSet(path))
                  dispatch(chatSliceActions.selectedNodePathSet(path.map(id => String(id))))
                }
                dispatch(chatSliceActions.focusedChatMessageSet(item.id))
                setSearchOpen(false)
                setSearchQuery('')
              }
            }}
            className='bg-amber-50 dark:bg-neutral-700'
          />
          {searchOpen && searchQuery.trim() && (
            <div
              className='absolute right-0 mt-1 w-full max-h-72 overflow-auto rounded-md shadow-lg border border-stone-200 bg-white dark:bg-neutral-900 dark:border-secondary-500 z-20 thin-scrollbar'
              data-heimdall-wheel-exempt='true'
            >
              {filteredResults.length === 0 ? (
                <div className='px-3 py-2 text-sm text-neutral-500 dark:text-neutral-300'>No matches</div>
              ) : (
                <ul className='py-1 text-sm text-stone-800 dark:text-stone-100'>
                  {filteredResults.map((item, idx) => {
                    const content = (item.content || '').replace(/\s+/g, ' ').trim()
                    const snippet = content.length > 160 ? content.slice(0, 160) + '…' : content
                    return (
                      <li key={item.id}>
                        <button
                          type='button'
                          onClick={() => {
                            searchFocusPendingRef.current = true
                            const path = buildBranchPathForMessage(flatMessages as any, item.id)
                            if (path.length > 0) {
                              dispatch(chatSliceActions.conversationPathSet(path))
                              dispatch(chatSliceActions.selectedNodePathSet(path.map(id => String(id))))
                            }
                            dispatch(chatSliceActions.focusedChatMessageSet(item.id))
                            setSearchOpen(false)
                            setSearchQuery('')
                          }}
                          onMouseEnter={() => setSearchHoverIndex(idx)}
                          className={`w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-secondary-800 ${
                            idx === searchHoverIndex ? 'bg-stone-100 dark:bg-neutral-700' : ''
                          }`}
                        >
                          <div className='flex items-start gap-2'>
                            <span className='shrink-0 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5'>
                              #{item.id}
                            </span>
                            <span className='line-clamp-2'>{snippet || '(empty message)'}</span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className='bg-amber-50 dark:bg-neutral-700 text-stone-800 dark:text-stone-200 px-3 py-1 rounded-lg text-sm'>
          Zoom: {Math.round(zoom * 100)}%
        </div>
        {compactMode && (
          <div className='bg-amber-50 dark:bg-neutral-700 text:stone-800 dark:text-stone-200 px-3 py-1 rounded-lg text-xs'>
            Compact Mode
          </div>
        )}
        <div className='bg-amber-50 dark:bg-neutral-700 text-stone-800 dark:text-stone-200 px-3 py-2 rounded-lg text-xs space-y-1'>
          <div className='flex items-center gap-2'>
            <div className='w-3 h-3 bg-amber-50 dark:bg-yPurple-500 rounded border-1 border-stone-400'></div>
            <span>User messages</span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-3 h-3 bg-indigo-50 dark:bg-yBrown-500 rounded border-1 border-stone-400'></div>
            <span>Assistant messages</span>
          </div>
        </div>
      </div>
      <svg
        ref={svgRef}
        className='w-full h-full cursor-move'
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={e => e.preventDefault()}
        onClick={e => {
          const target = e.target as SVGElement
          if (target === e.currentTarget || target.tagName === 'svg') {
            setFocusedNodeId(null)
            // Clear selection when clicking on empty space
            if (onNodeSelect) {
              onNodeSelect('', [])
            }
          }
        }}
        style={{ cursor: isDragging ? 'grabbing' : isSelecting ? 'crosshair' : 'grab', touchAction: 'none' }}
      >
        <g transform={`translate(${pan.x + dimensions.width / 2}, ${pan.y + 100}) scale(${zoom})`}>
          <g transform={`translate(${offsetX}, ${offsetY})`}>
            <g strokeLinecap='round' strokeLinejoin='round'>
              {renderConnections()}
            </g>
            <AnimatePresence initial={false} mode='popLayout'>
              {renderNodes()}
            </AnimatePresence>
          </g>
        </g>
        {/* Selection rectangle */}
        {isSelecting && (
          <rect
            x={Math.min(selectionStart.x, selectionEnd.x)}
            y={Math.min(selectionStart.y, selectionEnd.y)}
            width={Math.abs(selectionEnd.x - selectionStart.x)}
            height={Math.abs(selectionEnd.y - selectionStart.y)}
            fill='rgba(59, 130, 246, 0.2)'
            stroke='rgba(59, 130, 246, 0.8)'
            strokeWidth='2'
            strokeDasharray='5,5'
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
      {/* Custom context menu after selection */}
      {showContextMenu && contextMenuPos && (
        <div
          className='absolute z-30 min-w-[140px] rounded-md shadow-lg border border-stone-200 bg-white dark:bg-neutral-800 dark:border-neutral-700'
          style={{
            left: Math.max(8, Math.min(contextMenuPos.x, Math.max(0, dimensions.width - 180))),
            top: Math.max(8, Math.min(contextMenuPos.y, Math.max(0, dimensions.height - 140))),
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <ul className='py-1 text-sm text-stone-800 dark:text-stone-100'>
            <li>
              <button
                className='w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-neutral-700'
                onClick={handleCopySelectedPaths}
              >
                Copy
              </button>
            </li>
            {selectedNodes.length === 1 && (
              <li>
                <button
                  className='w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-neutral-700'
                  onClick={() => {
                    const nodeId = String(selectedNodes[0])

                    if (contextMenuPos) {
                      handleOpenNoteDialog(nodeId, contextMenuPos)
                    }
                  }}
                >
                  {(() => {
                    const message = getCurrentMessage(selectedNodes[0])
                    const hasNote = message?.note && message.note.trim().length > 0
                    return hasNote ? 'View Note' : 'Add Note'
                  })()}
                </button>
              </li>
            )}
            <li>
              <button
                className='w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-neutral-700 text-red-600 dark:text-red-400'
                onClick={handleDeleteNodes}
              >
                Delete
              </button>
            </li>
          </ul>
        </div>
      )}
      <div className='absolute bottom-4 left-4 flex flex-col gap-2'>
        <div className='bg-amber-50 dark:bg-neutral-800 text-stone-800 dark:text-stone-200 px-3 py-2 rounded-lg text-xs space-y-1 w-fit'>
          <div>Messages: {stats.totalNodes}</div>
          <div>Max depth: {stats.maxDepth}</div>
          <div>Branches: {stats.branches}</div>
          {/* <div className='pt-1 border-t border-gray-700'>Mode: {compactMode ? 'Compact' : 'Full'}</div> */}
        </div>
        <div className='text-stone-800 dark:text-stone-200 text-sm flex items-center gap-2'>
          <Move size={16} />
          <span>Drag to pan • Scroll to zoom • Right-click drag to select</span>
        </div>
      </div>
      {selectedNode && (
        <div
          className={`absolute max-w-md bg-amber-50 dark:bg-neutral-800 text-stone-800 dark:text-stone-200 p-4 rounded-lg shadow-xl z-20 ${compactMode ? 'border-2 border-gray-600' : ''}`}
          style={{
            left: Math.min(mousePosition.x + 10, dimensions.width - 400),
            top: Math.max(mousePosition.y + 10, 10),
            maxWidth: '300px',
          }}
        >
          <div className='text-xs text-stone-800 bg-amber-50 dark:bg-neutral-800 dark:text-stone-200 mb-1'>
            {selectedNode.sender === 'user' ? 'User' : 'Assistant'}
          </div>
          <div className='text-sm whitespace-normal break-words overflow-hidden ygg-line-clamp-6'>
            {selectedNode.message}
          </div>
        </div>
      )}

      {/* Note dialog */}
      {showNoteDialog && noteDialogPos && noteMessageId !== null && (
        <div
          className='note-dialog-container absolute z-40 w-96 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg shadow-lg'
          style={{
            left: Math.max(8, Math.min(noteDialogPos.x, Math.max(0, dimensions.width - 400))),
            top: Math.max(8, Math.min(noteDialogPos.y, Math.max(0, dimensions.height - 300))),
          }}
          onMouseDown={e => e.stopPropagation()}
          data-heimdall-wheel-exempt='true'
        >
          <div className='px-4 py-2'>
            <div className='flex justify-between items-center mb-3'>
              <h3 className='text-sm font-medium text-stone-800 dark:text-stone-200'>
                {(() => {
                  const message = getCurrentMessage(noteMessageId)
                  const hasNote = message?.note && message.note.trim().length > 0
                  return hasNote ? 'Edit Note' : 'Add Note'
                })()}
              </h3>
              <button
                onClick={handleCloseNoteDialog}
                className='text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'
                title='Close'
              >
                ✕
              </button>
            </div>
            <div className='mb-1'>
              <TextArea
                placeholder='Enter your note...'
                value={noteText}
                onChange={handleNoteTextChange}
                minRows={3}
                maxRows={8}
                autoFocus
                className='w-full'
                width='w-full'
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(Heimdall)

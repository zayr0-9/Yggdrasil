import { AnimatePresence, motion } from 'framer-motion'
import { Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { JSX } from 'react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { chatSliceActions } from '../../features/chats/chatSlice'
import type { RootState } from '../../store/store'

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
}) => {
  const dispatch = useDispatch()
  const selectedNodes = useSelector((state: RootState) => state.chat.selectedNodes)
  const allMessages = useSelector((state: RootState) => state.chat.conversation.messages)
  const currentPathIds = useSelector((state: RootState) => state.chat.conversation.currentPath)

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
  // Refs for latest zoom and pan to avoid stale closures inside wheel listener
  const zoomRef = useRef<number>(zoom)
  const panRef = useRef<{ x: number; y: number }>(pan)
  // Global text selection suppression while panning (originated in Heimdall)
  const addGlobalNoSelect = () => {
    try {
      document.body.classList.add('ygg-no-select')
    } catch {}
  }

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
      // Prevent default scrolling behavior
      e.preventDefault()
      e.stopPropagation()

      // Handle zoom centered at the cursor position
      const svgEl = svgRef.current
      if (!svgEl) {
        const deltaFallback = e.deltaY > 0 ? 0.9 : 1.1
        setZoom(prev => Math.max(0.1, Math.min(3, prev * deltaFallback)))
        return
      }

      const rect = svgEl.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top

      const currentZoom = zoomRef.current
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.1, Math.min(3, currentZoom * delta))

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

  // Keep only one branch: choose the branch that contains the most selected nodes
  const filterToDominantBranch = (ids: number[]): number[] => {
    if (!ids || ids.length <= 1) return ids

    // Prefer message-graph approach if we have flat messages available
    const msgs = allMessages as any[] | undefined
    if (Array.isArray(msgs) && msgs.length > 0) {
      // Build parent and children maps
      const parentMap = new Map<number, number | null>()
      const childrenMap = new Map<number, number[]>()

      const parseChildren = (val: unknown): number[] => {
        if (Array.isArray(val)) {
          return (val as unknown[]).map(x => Number(x)).filter(n => !isNaN(n))
        }
        if (typeof val === 'string') {
          try {
            const arr = JSON.parse(val)
            if (Array.isArray(arr)) {
              return arr.map((x: any) => Number(x)).filter((n: number) => !isNaN(n))
            }
          } catch {}
        }
        return []
      }

      for (const m of msgs) {
        const id = Number((m as any).id)
        const pRaw = (m as any).parent_id
        const parent = pRaw === null || pRaw === undefined ? null : Number(pRaw)
        parentMap.set(id, isNaN(parent as number) ? null : (parent as number))
        const children = parseChildren((m as any).children_ids)
        childrenMap.set(id, children)
      }

      const ascendToRoot = (id: number): number[] => {
        const path: number[] = []
        const seen = new Set<number>()
        let cur: number | null = id
        while (cur != null && !seen.has(cur)) {
          seen.add(cur)
          path.push(cur)
          cur = parentMap.get(cur) ?? null
        }
        return path.reverse() // root -> id
      }

      const descendSingleChain = (from: number): number[] => {
        const out: number[] = []
        const seen = new Set<number>()
        let cur = from
        seen.add(cur)
        while (true) {
          const children = childrenMap.get(cur) || []
          if (children.length !== 1) break
          const next = Number(children[0])
          if (seen.has(next)) break // guard against cycles
          out.push(next)
          seen.add(next)
          cur = next
        }
        return out // nodes strictly after `from`
      }

      const groups = new Map<string, { ids: number[]; count: number; pathLen: number }>()
      for (const idNum of [...ids].sort((a, b) => a - b)) {
        // stable processing order
        const rootPath = ascendToRoot(idNum)
        const down = descendSingleChain(idNum)
        const fullPath = rootPath.concat(down) // root -> ... -> idNum -> ... -> branch leaf
        const key = fullPath.join('>')
        const existing = groups.get(key)
        if (existing) {
          existing.ids.push(idNum)
          existing.count += 1
          existing.pathLen = Math.max(existing.pathLen, fullPath.length)
        } else {
          groups.set(key, { ids: [idNum], count: 1, pathLen: fullPath.length })
        }
      }

      let bestKey = ''
      let best: { ids: number[]; count: number; pathLen: number } | null = null
      for (const [k, v] of groups) {
        if (
          !best ||
          v.count > best.count ||
          (v.count === best.count && v.pathLen > best.pathLen) ||
          (v.count === best.count && v.pathLen === best.pathLen && k < bestKey)
        ) {
          bestKey = k
          best = v
        }
      }
      if (best) {
        const pathSet = new Set(
          bestKey
            .split('>')
            .map(n => Number(n))
            .filter(n => !isNaN(n))
        )
        const extraAncestors = ids.filter(n => pathSet.has(n))
        const merged = Array.from(new Set<number>([...best.ids, ...extraAncestors]))
        return merged
      }
      return ids
    }

    // Fallback to tree-based grouping when flat messages are not available
    const groups = new Map<string, { ids: number[]; count: number; pathLen: number }>()
    for (const idNum of ids) {
      const idStr = String(idNum)
      let path = getPathWithDescendants(idStr)
      if (!path || path.length === 0) {
        const fallback = getPathToNode(idStr)
        path = fallback || [idStr]
      }
      const key = path.join('>')
      const existing = groups.get(key)
      if (existing) {
        existing.ids.push(idNum)
        existing.count += 1
      } else {
        groups.set(key, { ids: [idNum], count: 1, pathLen: path.length })
      }
    }
    let bestKey = ''
    let best: { ids: number[]; count: number; pathLen: number } | null = null
    for (const [k, v] of groups) {
      if (
        !best ||
        v.count > best.count ||
        (v.count === best.count && v.pathLen > best.pathLen) ||
        (v.count === best.count && v.pathLen === best.pathLen && k < bestKey)
      ) {
        bestKey = k
        best = v
      }
    }
    if (best) {
      const pathSet = new Set(
        bestKey
          .split('>')
          .map(n => Number(n))
          .filter(n => !isNaN(n))
      )
      const extraAncestors = ids.filter(n => pathSet.has(n))
      const merged = Array.from(new Set<number>([...best.ids, ...extraAncestors]))
      return merged
    }
    return ids
  }

  // (legacy mouse handlers removed in favor of pointer events)

  const handleMouseUp = (): void => {
    if (isSelecting) {
      // Calculate which nodes are within the selection rectangle
      const selectedNodeIds = getNodesInSelectionRectangle()
      // Replace selection with filtered nodes from this drag
      const filteredSelection = filterToDominantBranch(selectedNodeIds)
      dispatch(chatSliceActions.nodesSelected(filteredSelection))
      setIsSelecting(false)
      isSelectingRef.current = false
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

    // Dispatch the nodesSelected action (filtered to the dominant branch)
    const filteredNodes = filterToDominantBranch(newSelectedNodes)
    dispatch(chatSliceActions.nodesSelected(filteredNodes))
  }

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
                className='animate-pulse-slow stroke-rose-300 dark:stroke-slate-100'
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
              } ${node.sender === 'user' ? 'dark:fill-sky-900' : 'dark:fill-lime-900'} dark:stroke-slate-700`}
              style={{
                filter:
                  compactMode && focusedNodeId === node.id ? 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' : 'none',
              }}
              onMouseEnter={(e) => {
                setSelectedNode(node)
                const containerRect = containerRef.current?.getBoundingClientRect()
                if (containerRect) {
                  setMousePosition({
                    x: e.clientX - containerRect.left,
                    y: e.clientY - containerRect.top
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
                <p className='line-clamp-3'>{node.message}</p>
              </div>
            </foreignObject>
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
                stroke='rgba(16, 185, 129, 0.9)'
                strokeWidth='3'
                className='animate-pulse-slow'
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
                node.sender === 'user' ? 'fill-red-300 dark:fill-lime-900' : 'fill-indigo-300 dark:fill-sky-900'
              }`}
              style={{
                transform: selectedNode?.id === node.id ? 'scale(1.1)' : 'scale(1)',
                transformOrigin: `${x}px ${y + circleRadius}px`,
              }}
              onMouseEnter={(e) => {
                setSelectedNode(node)
                const containerRect = containerRef.current?.getBoundingClientRect()
                if (containerRect) {
                  setMousePosition({
                    x: e.clientX - containerRect.left,
                    y: e.clientY - containerRect.top
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
            {/* Add a small indicator for branch nodes */}
            {node.children && node.children.length > 1 && (
              <circle
                cx={x}
                cy={y + circleRadius}
                r='6'
                fill='white'
                opacity='0.4'
                className='animate-pulse'
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              />
            )}
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
          className='p-2 bg-amber-50 text-stone-800 dark:text-stone-200 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-500 dark:bg-neutral-700 transition-colors'
          title='Zoom In'
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={zoomOut}
          className='p-2 bg-amber-50 text-stone-800 dark:text-stone-200 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-500 dark:bg-neutral-700 transition-colors'
          title='Zoom Out'
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={resetView}
          className='p-2 bg-amber-50 text-stone-800 dark:text-stone-200 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-500 dark:bg-neutral-700 transition-colors'
          title='Reset View'
        >
          <RotateCcw size={20} />
        </button>
        <button
          onClick={() => {
            dispatch(chatSliceActions.heimdallCompactModeToggled())
          }}
          className='p-2 bg-amber-50 text-stone-800 dark:text-stone-200 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-500 dark:bg-neutral-700 transition-colors'
          title='Toggle Compact Mode'
        >
          {compactMode ? 'Compact' : 'Full'}
        </button>
      </div>
      <div className='absolute top-4 right-4 z-10 flex flex-col gap-2 items-end'>
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
            <div className='w-3 h-3 bg-yellow-50 dark:bg-lime-900 rounded border-1 border-stone-400'></div>
            <span>User messages</span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-3 h-3 bg-sky-50 dark:bg-sky-900 rounded border-1 border-stone-400'></div>
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
      <div className='absolute bottom-4 left-4 flex flex-col gap-2'>
        <div className='dark:bg-gray-800 bg-amber-50 text-stone-800 dark:text-stone-200 px-3 py-2 rounded-lg text-xs space-y-1 dark:bg-neutral-800 w-fit'>
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
            maxWidth: '300px'
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
    </div>
  )
}

export default React.memo(Heimdall)

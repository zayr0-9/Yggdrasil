import { Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { JSX } from 'react'
import React, { MouseEvent, useEffect, useRef, useState } from 'react'
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
}

// Default empty state when no data is provided
const defaultEmptyNode: ChatNode = {
  id: 'empty',
  message: 'No conversation data available',
  sender: 'assistant',
  children: [],
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

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<number>(compactMode ? 1 : 1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [selectedNode, setSelectedNode] = useState<ChatNode | null>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState<boolean>(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const nodeWidth = 250
  const nodeHeight = 80
  const circleRadius = 20
  const verticalSpacing = compactMode ? 80 : 120
  const horizontalSpacing = compactMode ? 100 : 350

  // Use provided data or fallback to default
  const currentChatData = chatData || defaultEmptyNode

  // Calculate path from root to a specific node
  const getPathToNode = (
    targetNodeId: string,
    node: ChatNode = currentChatData,
    path: string[] = []
  ): string[] | null => {
    const currentPath = [...path, node.id]

    if (node.id === targetNodeId) {
      return currentPath
    }

    if (node.children) {
      for (const child of node.children) {
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
    const findNode = (nodeId: string, node: ChatNode = currentChatData): ChatNode | null => {
      if (node.id === nodeId) return node
      if (node.children) {
        for (const child of node.children) {
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
      // If multiple children, this node is the branch point - return it
      return node
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

  const stats = getTreeStats(currentChatData)

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

  const positions = calculateTreeLayout(currentChatData)

  // Calculate SVG bounds
  const bounds = Object.values(positions).reduce<Bounds>(
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

  const offsetX = -bounds.minX + 50
  const offsetY = -bounds.minY + 50

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

  // Prevent body scroll when mouse is over the component
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: globalThis.WheelEvent) => {
      // Prevent default scrolling behavior
      e.preventDefault()
      e.stopPropagation()

      // Handle zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)))
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

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>): void => {
    // Don't start dragging if clicking on a node
    const target = e.target as SVGElement
    if (target.tagName === 'rect' || target.tagName === 'circle') {
      return
    }

    if (e.button === 2) {
      // Right mouse button
      // Start selection rectangle
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (svgRect) {
        const svgX = e.clientX - svgRect.left
        const svgY = e.clientY - svgRect.top
        // Reset selection when starting a new drag-selection
        dispatch(chatSliceActions.nodesSelected([]))
        setIsSelecting(true)
        setSelectionStart({ x: svgX, y: svgY })
        setSelectionEnd({ x: svgX, y: svgY })
      }
    } else if (e.button === 0) {
      // Left mouse button
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>): void => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    } else if (isSelecting) {
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (svgRect) {
        const svgX = e.clientX - svgRect.left
        const svgY = e.clientY - svgRect.top
        setSelectionEnd({ x: svgX, y: svgY })
      }
    }
  }

  const handleMouseUp = (): void => {
    if (isSelecting) {
      // Calculate which nodes are within the selection rectangle
      const selectedNodeIds = getNodesInSelectionRectangle()
      // Replace selection with filtered nodes from this drag
      const filteredSelection = filterToDominantBranch(selectedNodeIds)
      dispatch(chatSliceActions.nodesSelected(filteredSelection))
      setIsSelecting(false)
    }
    setIsDragging(false)
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

    // Also trigger the existing onNodeSelect callback if provided
    if (onNodeSelect) {
      const path = getPathToNode(nodeId)
      onNodeSelect(nodeId, path || [])
    }
  }

  const resetView = (): void => {
    setZoom(compactMode ? 1 : 0.6)
    setPan({ x: 0, y: 0 })
    setFocusedNodeId(null)
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

      if (isExpanded) {
        // Render full node
        return (
          <g key={node.id} transform={`translate(${x - nodeWidth / 2}, ${y})`}>
            {/* Selection highlight */}
            {isNodeSelected && (
              <rect
                width={nodeWidth + 8}
                height={nodeHeight + 8}
                x={-4}
                y={-4}
                rx='12'
                fill='none'
                stroke='rgba(59, 130, 246, 0.8)'
                strokeWidth='3'
                strokeDasharray='5,5'
                className='animate-pulse'
              />
            )}
            <rect
              width={nodeWidth}
              height={nodeHeight}
              rx='8'
              fill={node.sender === 'user' ? '#64748b' : '#1e293b'}
              className={`cursor-pointer hover:opacity-90 transition-all duration-300 ${compactMode && focusedNodeId === node.id ? 'animate-pulse' : ''}`}
              style={{
                filter:
                  compactMode && focusedNodeId === node.id ? 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' : 'none',
              }}
              onMouseEnter={() => setSelectedNode(node)}
              onMouseLeave={() => setSelectedNode(null)}
              onClick={() => {
                if (compactMode) {
                  setFocusedNodeId(node.id === focusedNodeId ? null : node.id)
                }
                // Trigger node selection callback
                if (onNodeSelect) {
                  const path = getPathWithDescendants(node.id)
                  onNodeSelect(node.id, path)
                }
              }}
              onContextMenu={e => handleContextMenu(e, node.id)}
            />
            <foreignObject width={nodeWidth} height={nodeHeight} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div className='p-3 text-white text-sm h-full flex items-center'>
                <p className='line-clamp-3'>{node.message}</p>
              </div>
            </foreignObject>
          </g>
        )
      } else {
        // Render compact circle
        return (
          <g key={node.id}>
            {/* Selection highlight for compact mode */}
            {isNodeSelected && (
              <circle
                cx={x}
                cy={y + circleRadius}
                r={circleRadius + 6}
                fill='none'
                stroke='rgba(59, 130, 246, 0.8)'
                strokeWidth='3'
                strokeDasharray='5,5'
                className='animate-pulse'
              />
            )}
            <circle
              cx={x}
              cy={y + circleRadius}
              r={circleRadius}
              fill={node.sender === 'user' ? '#64748b' : '#1e293b'}
              className='cursor-pointer transition-all'
              style={{
                transform: selectedNode?.id === node.id ? 'scale(1.1)' : 'scale(1)',
                transformOrigin: `${x}px ${y + circleRadius}px`,
              }}
              onMouseEnter={() => setSelectedNode(node)}
              onMouseLeave={() => setSelectedNode(null)}
              onClick={() => {
                setFocusedNodeId(node.id === focusedNodeId ? null : node.id)
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
          </g>
        )
      }
    })
  }

  // Show loading state
  if (loading) {
    return (
      <div
        ref={containerRef}
        className='w-full h-screen bg-gray-900 relative overflow-hidden flex items-center justify-center'
      >
        <div className='text-white text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4'></div>
          <p className='text-lg'>Loading conversation tree...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div
        ref={containerRef}
        className='w-full h-screen bg-gray-900 relative overflow-hidden flex items-center justify-center'
      >
        <div className='text-white text-center max-w-md'>
          <div className='text-red-400 text-6xl mb-4'>⚠️</div>
          <p className='text-lg mb-2'>Failed to load conversation</p>
          <p className='text-sm text-gray-400'>{error}</p>
        </div>
      </div>
    )
  }

  // Show empty state when no data
  if (!chatData) {
    return (
      <div
        ref={containerRef}
        className='w-full h-screen bg-gray-900 relative overflow-hidden flex items-center justify-center'
      >
        <div className='text-white text-center max-w-md'>
          <div className='text-gray-500 text-6xl mb-4'>💬</div>
          <p className='text-lg mb-2'>No conversation selected</p>
          <p className='text-sm text-gray-400'>Select a conversation to view its message tree</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className='w-full h-screen bg-gray-900 relative overflow-hidden dark:bg-neutral-900'
      onContextMenu={e => e.preventDefault()}
    >
      <div className='absolute top-4 left-4 z-10 flex gap-2'>
        <button
          onClick={zoomIn}
          className='p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors'
          title='Zoom In'
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={zoomOut}
          className='p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors'
          title='Zoom Out'
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={resetView}
          className='p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors'
          title='Reset View'
        >
          <RotateCcw size={20} />
        </button>
      </div>

      <div className='absolute top-4 right-4 z-10 flex flex-col gap-2 items-end'>
        <div className='bg-gray-800 text-white px-3 py-1 rounded-lg text-sm'>Zoom: {Math.round(zoom * 100)}%</div>
        {compactMode && (
          <div className='bg-gray-800 text-white px-3 py-1 rounded-lg text-xs'>Compact Mode: Click to expand</div>
        )}
        <div className='bg-gray-800 text-white px-3 py-2 rounded-lg text-xs space-y-1'>
          <div className='flex items-center gap-2'>
            <div className='w-3 h-3 bg-slate-400 rounded '></div>
            <span>User messages</span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-3 h-3 bg-slate-600 rounded'></div>
            <span>Assistant messages</span>
          </div>
          {compactMode && (
            <div className='flex items-center gap-2 pt-1 border-t border-gray-700'>
              <div className='w-3 h-3 bg-white opacity-30 rounded-full'></div>
              <span>Multiple branches</span>
            </div>
          )}
        </div>
      </div>

      <svg
        ref={svgRef}
        className='w-full h-full cursor-move'
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={e => e.preventDefault()}
        onClick={(e: MouseEvent<SVGSVGElement>) => {
          const target = e.target as SVGElement
          if (target === e.currentTarget || target.tagName === 'svg') {
            setFocusedNodeId(null)
            // Clear selection when clicking on empty space
            if (onNodeSelect) {
              onNodeSelect('', [])
            }
          }
        }}
        style={{ cursor: isDragging ? 'grabbing' : isSelecting ? 'crosshair' : 'grab' }}
      >
        <g transform={`translate(${pan.x + dimensions.width / 2}, ${pan.y + 100}) scale(${zoom})`}>
          <g transform={`translate(${offsetX}, ${offsetY})`}>
            <g strokeLinecap='round' strokeLinejoin='round' className='transition-all duration-300'>
              {renderConnections()}
            </g>
            {renderNodes()}
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
        <div className='bg-gray-800 text-gray-300 px-3 py-2 rounded-lg text-xs space-y-1 dark:bg-neutral-800'>
          <div>Messages: {stats.totalNodes}</div>
          <div>Max depth: {stats.maxDepth}</div>
          <div>Branches: {stats.branches}</div>
          <div className='pt-1 border-t border-gray-700'>Mode: {compactMode ? 'Compact' : 'Full'}</div>
        </div>
        <div className='text-gray-400 text-sm flex items-center gap-2'>
          <Move size={16} />
          <span>Drag to pan • Scroll to zoom • Right-click drag to select{compactMode && ' • Click to focus'}</span>
        </div>
      </div>

      {selectedNode && (
        <div
          className={`absolute ${compactMode ? 'top-4' : 'top-20'} left-4 right-4 max-w-2xl bg-gray-800 text-white p-4 rounded-lg shadow-xl z-20 ${compactMode ? 'border-2 border-gray-600' : ''}`}
        >
          <div className='text-xs text-gray-400 mb-1'>
            {selectedNode.sender === 'user' ? 'User' : 'Assistant'}
            {compactMode && focusedNodeId !== selectedNode.id && ' (Click to expand)'}
          </div>
          <div className='text-sm'>{selectedNode.message}</div>
        </div>
      )}
    </div>
  )
}

export default Heimdall

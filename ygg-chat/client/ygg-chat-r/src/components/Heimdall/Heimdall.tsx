import { Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { JSX } from 'react'
import React, { MouseEvent, useEffect, useRef, useState, WheelEvent } from 'react'

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
  chatData?: ChatNode
  compactMode?: boolean
}

// Sample chat data structure representing a real conversation
const sampleChatData: ChatNode = {
  id: '1',
  message: 'How do I build a modern authentication system for a React app?',
  sender: 'user',
  children: [
    {
      id: '2',
      message:
        "To build a modern authentication system for React, you'll want to consider using JWT tokens with a secure backend. Here's a comprehensive approach using React Context for state management...",
      sender: 'assistant',
      children: [
        {
          id: '3',
          message: 'Can you show me the actual code implementation?',
          sender: 'user',
          children: [
            {
              id: '4',
              message:
                "Here's a complete implementation with login, logout, and protected routes using React Router v6 and Context API...",
              sender: 'assistant',
              children: [
                {
                  id: '5',
                  message: 'How do I handle token refresh?',
                  sender: 'user',
                  children: [
                    {
                      id: '6',
                      message:
                        "Token refresh is crucial for security. Here's how to implement it with axios interceptors...",
                      sender: 'assistant',
                      children: [
                        {
                          id: '7',
                          message: 'What about storing tokens securely?',
                          sender: 'user',
                          children: [
                            {
                              id: '8',
                              message:
                                'For token storage, you have several options: httpOnly cookies (most secure), memory storage, or localStorage with encryption...',
                              sender: 'assistant',
                              children: [],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  id: '9',
                  message: 'Wait, can you explain the Context API part more clearly?',
                  sender: 'user',
                  children: [
                    {
                      id: '10',
                      message:
                        'Of course! Context API helps manage authentication state globally. Let me break it down step by step...',
                      sender: 'assistant',
                      children: [
                        {
                          id: '11',
                          message: "That's perfect! How do I test this?",
                          sender: 'user',
                          children: [
                            {
                              id: '12',
                              message:
                                'For testing authentication, use React Testing Library with MSW (Mock Service Worker) for API mocking...',
                              sender: 'assistant',
                              children: [],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: '13',
          message: 'Actually, what about using NextAuth.js instead?',
          sender: 'user',
          children: [
            {
              id: '14',
              message:
                "NextAuth.js is an excellent choice! It handles many authentication complexities for you. Here's how to set it up with various providers...",
              sender: 'assistant',
              children: [
                {
                  id: '15',
                  message: 'Can I use it with a custom backend?',
                  sender: 'user',
                  children: [
                    {
                      id: '16',
                      message:
                        'Yes! NextAuth.js supports custom credentials providers. You can integrate it with any backend API...',
                      sender: 'assistant',
                      children: [
                        {
                          id: '17',
                          message: 'Show me how to add Google OAuth',
                          sender: 'user',
                          children: [
                            {
                              id: '18',
                              message:
                                "Here's how to configure Google OAuth with NextAuth.js, including environment setup and callback handling...",
                              sender: 'assistant',
                              children: [],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: '19',
              message:
                'Alternatively, Auth0 provides a complete authentication solution with excellent React SDK support...',
              sender: 'assistant',
              children: [
                {
                  id: '20',
                  message: "What's the pricing like for Auth0?",
                  sender: 'user',
                  children: [
                    {
                      id: '21',
                      message:
                        'Auth0 offers a free tier up to 7,000 active users. The paid plans start at $240/month for additional features...',
                      sender: 'assistant',
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: '22',
      message:
        'For a modern React authentication system, I recommend using a combination of JWT tokens, secure HTTP-only cookies, and a robust state management solution like Zustand or Redux Toolkit...',
      sender: 'assistant',
      children: [
        {
          id: '23',
          message: 'Why Zustand over Context API?',
          sender: 'user',
          children: [
            {
              id: '24',
              message:
                'Zustand offers better performance with less boilerplate. It prevents unnecessary re-renders and has a simpler API...',
              sender: 'assistant',
              children: [
                {
                  id: '25',
                  message: 'Can you show me a Zustand auth store example?',
                  sender: 'user',
                  children: [
                    {
                      id: '26',
                      message:
                        "Here's a complete Zustand authentication store with TypeScript, persistence, and middleware support...",
                      sender: 'assistant',
                      children: [
                        {
                          id: '27',
                          message: 'How do I add role-based access control?',
                          sender: 'user',
                          children: [
                            {
                              id: '28',
                              message:
                                "RBAC can be implemented by extending the user object with roles and permissions. Here's a complete solution...",
                              sender: 'assistant',
                              children: [
                                {
                                  id: '29',
                                  message: 'Perfect! Can you also show me how to implement 2FA?',
                                  sender: 'user',
                                  children: [
                                    {
                                      id: '30',
                                      message:
                                        "Two-factor authentication adds an extra security layer. Here's how to implement TOTP-based 2FA with QR codes...",
                                      sender: 'assistant',
                                      children: [],
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: '31',
          message: 'Tell me more about the JWT implementation',
          sender: 'user',
          children: [
            {
              id: '32',
              message:
                "JWT (JSON Web Tokens) consist of three parts: header, payload, and signature. For React apps, you'll typically store them in memory or httpOnly cookies...",
              sender: 'assistant',
              children: [
                {
                  id: '33',
                  message: 'What are the security best practices?',
                  sender: 'user',
                  children: [
                    {
                      id: '34',
                      message:
                        'Key security practices include: short token expiry times, secure storage, HTTPS only, CSRF protection, and proper CORS configuration...',
                      sender: 'assistant',
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: '35',
      message:
        'Let me approach this from a different angle. Modern authentication involves several layers: identity verification, session management, and authorization...',
      sender: 'assistant',
      children: [
        {
          id: '36',
          message: 'Can you recommend a complete tech stack?',
          sender: 'user',
          children: [
            {
              id: '37',
              message:
                'For a production-ready auth stack, I recommend: React + TypeScript, Next.js, Prisma ORM, PostgreSQL, and either NextAuth.js or Supertokens...',
              sender: 'assistant',
              children: [],
            },
          ],
        },
      ],
    },
  ],
}

export const Heimdall: React.FC<HeimdallProps> = ({ chatData = sampleChatData, compactMode = true }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState<number>(compactMode ? 1 : 0.6)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [selectedNode, setSelectedNode] = useState<ChatNode | null>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

  const nodeWidth = 250
  const nodeHeight = 80
  const circleRadius = 20
  const verticalSpacing = compactMode ? 80 : 120
  const horizontalSpacing = compactMode ? 100 : 350

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

  const stats = getTreeStats(chatData)

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

  const positions = calculateTreeLayout(chatData)

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

  //   const svgWidth = bounds.maxX - bounds.minX + 100
  //   const svgHeight = bounds.maxY - bounds.minY + 100
  const offsetX = -bounds.minX + 50
  const offsetY = -bounds.minY + 50

  useEffect(() => {
    const updateDimensions = (): void => {
      if (svgRef.current) {
        const { width, height } = svgRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>): void => {
    // Don't start dragging if clicking on a node
    const target = e.target as SVGElement
    if (target.tagName === 'rect' || target.tagName === 'circle') {
      return
    }
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>): void => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = (): void => {
    setIsDragging(false)
  }

  const handleWheel = (e: WheelEvent<SVGSVGElement>): void => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)))
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
    // const cornerRadius = 10

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

      if (isExpanded) {
        // Render full node
        return (
          <g key={node.id} transform={`translate(${x - nodeWidth / 2}, ${y})`}>
            <rect
              width={nodeWidth}
              height={nodeHeight}
              rx='8'
              fill={node.sender === 'user' ? '#3b82f6' : '#374151'}
              className={`cursor-pointer hover:opacity-90 transition-all duration-300 ${compactMode && focusedNodeId === node.id ? 'animate-pulse' : ''}`}
              style={{
                filter:
                  compactMode && focusedNodeId === node.id ? 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' : 'none',
              }}
              onMouseEnter={() => setSelectedNode(node)}
              onMouseLeave={() => setSelectedNode(null)}
              onClick={() => compactMode && setFocusedNodeId(node.id === focusedNodeId ? null : node.id)}
            />
            <foreignObject width={nodeWidth} height={nodeHeight} style={{ pointerEvents: 'none' }}>
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
            <circle
              cx={x}
              cy={y + circleRadius}
              r={circleRadius}
              fill={node.sender === 'user' ? '#3b82f6' : '#374151'}
              className='cursor-pointer transition-all'
              style={{
                transform: selectedNode?.id === node.id ? 'scale(1.1)' : 'scale(1)',
                transformOrigin: `${x}px ${y + circleRadius}px`,
              }}
              onMouseEnter={() => setSelectedNode(node)}
              onMouseLeave={() => setSelectedNode(null)}
              onClick={() => setFocusedNodeId(node.id === focusedNodeId ? null : node.id)}
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
                style={{ pointerEvents: 'none' }}
              />
            )}
          </g>
        )
      }
    })
  }

  return (
    <div className='w-full h-screen bg-gray-900 relative overflow-hidden'>
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
            <div className='w-3 h-3 bg-blue-500 rounded'></div>
            <span>User messages</span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-3 h-3 bg-gray-600 rounded'></div>
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
        onWheel={handleWheel}
        onClick={(e: MouseEvent<SVGSVGElement>) => {
          const target = e.target as SVGElement
          if (target === e.currentTarget || target.tagName === 'svg') {
            setFocusedNodeId(null)
          }
        }}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <g transform={`translate(${pan.x + dimensions.width / 2}, ${pan.y + 100}) scale(${zoom})`}>
          <g transform={`translate(${offsetX}, ${offsetY})`}>
            <g strokeLinecap='round' strokeLinejoin='round' className='transition-all duration-300'>
              {renderConnections()}
            </g>
            {renderNodes()}
          </g>
        </g>
      </svg>

      <div className='absolute bottom-4 left-4 flex flex-col gap-2'>
        <div className='bg-gray-800 text-gray-300 px-3 py-2 rounded-lg text-xs space-y-1'>
          <div>Messages: {stats.totalNodes}</div>
          <div>Max depth: {stats.maxDepth}</div>
          <div>Branches: {stats.branches}</div>
          <div className='pt-1 border-t border-gray-700'>Mode: {compactMode ? 'Compact' : 'Full'}</div>
        </div>
        <div className='text-gray-400 text-sm flex items-center gap-2'>
          <Move size={16} />
          <span>Drag to pan • Scroll to zoom{compactMode && ' • Click to focus'}</span>
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

import { useCallback, useEffect, useRef } from 'react'
import {
  addOpenFile,
  addSelectedFileForChat,
  FileInfo,
  IdeContext,
  removeOpenFile,
  selectIdeContext,
  SelectionInfo,
  setActiveFile,
  setAllFiles,
  setConnectionStatus,
  setCurrentSelection,
  setExtensionStatus,
  setOpenFiles,
  updateWorkspace,
} from '../features/ideContext'
import { useAppDispatch, useAppSelector } from '../store/hooks'

// Global WebSocket connection shared across all hook instances
let globalWebSocket: WebSocket | null = null
let connectionAttempts = 0
let isConnecting = false
let globalDispatch: any = null
// Global context request timeout tracking so all hook instances share the same state
const contextRequestTimeoutsGlobal = new Map<number, ReturnType<typeof setTimeout>>()
let lastContextRequestTs = 0
let requestSeq = 0
// Global pending file requests and processed responses so all hook instances share the same state
const pendingFileRequestsGlobal = new Map<number, (content: string | null) => void>()
const processedFileResponsesGlobal = new Set<number>()
let fileRequestSeq = 0

interface UseIdeContextReturn {
  ideContext: IdeContext
  requestContext: () => void
  requestFileContent: (filePath: string) => Promise<string | null>
  availableFiles: string[]
  getFileByPath: (path: string) => FileInfo | null
}

export function useIdeContext(): UseIdeContextReturn {
  const dispatch = useAppDispatch()
  const ideContext = useAppSelector(selectIdeContext)

  // Update global dispatch reference
  globalDispatch = dispatch
  const maxReconnectAttempts = 5
  // Reconnect timeout remains per-hook; request tracking is global
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)

  const requestContext = useCallback(() => {
    if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
      // Debounce context requests to prevent spam
      const now = Date.now()
      if (now - lastContextRequestTs < 1000) {
        console.log('🚫 Context request debounced')
        return
      }

      lastContextRequestTs = now
      // Generate unique requestId even if multiple calls in the same ms
      requestSeq = (requestSeq + 1) % 1000
      const requestId = now * 1000 + requestSeq
      console.log('➡️ Sending request_context (requestContext)', {
        requestId,
        wsReadyState: globalWebSocket.readyState,
      })
      globalWebSocket.send(
        JSON.stringify({
          type: 'request_context',
          requestId,
          timestamp: new Date().toISOString(),
        })
      )

      // Set timeout to mark extension as disconnected if no response
      const timeoutId = setTimeout(() => {
        console.log('⚠️ No context response received for requestId', requestId, '- extension may be disconnected')
        dispatch(setExtensionStatus(false))
        contextRequestTimeoutsGlobal.delete(requestId)
      }, 10000)
      contextRequestTimeoutsGlobal.set(requestId, timeoutId)
    }
  }, [dispatch])

  const requestFileContent = (filePath: string): Promise<string | null> => {
    return new Promise(resolve => {
      const now = Date.now()
      fileRequestSeq = (fileRequestSeq + 1) % 1000
      const requestId = now * 1000 + fileRequestSeq

      if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
        // Set timeout to resolve with null if no response
        const timeoutId = setTimeout(() => {
          if (pendingFileRequestsGlobal.has(requestId)) {
            console.warn(`⚠️ Timeout waiting for file content: ${filePath}`)
            resolve(null)
            pendingFileRequestsGlobal.delete(requestId)
            processedFileResponsesGlobal.add(requestId) // Mark as processed to avoid duplicate warnings
          }
        }, 10000) // 10 second timeout

        // Store timeout ID with the resolver so we can clear it later
        const resolveWithCleanup = (content: string | null) => {
          clearTimeout(timeoutId)
          resolve(content)
        }

        // Store the resolver for later
        pendingFileRequestsGlobal.set(requestId, resolveWithCleanup)

        globalWebSocket.send(
          JSON.stringify({
            type: 'request_file_content',
            requestId,
            timestamp: new Date().toISOString(),
            data: {
              path: filePath,
            },
          })
        )
      } else {
        console.warn('⚠️ Cannot request file content: WebSocket not connected')
        resolve(null)
      }
    })
  }

  const addRecentActivity = (_type: IdeContext['recentActivity'][0]['type'], _filePath: string, _details?: any) => {
    // Recent activity is now handled by Redux reducers
    // This function is kept for compatibility but doesn't need to do anything
    // since the Redux actions handle activity tracking
  }

  const updateConnectionStatus = (isConnected: boolean) => {
    if (globalDispatch) {
      globalDispatch(setConnectionStatus(isConnected))
    }
  }

  const connect = () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting || (globalWebSocket && globalWebSocket.readyState === WebSocket.CONNECTING)) {
      console.log('🔌 Connection already in progress, skipping')
      return
    }

    try {
      isConnecting = true
      const websocketUrl = 'ws://localhost:3001/ide-context?type=frontend&id=ygg-chat'
      console.log('🔌 Attempting to connect to IDE Context:', websocketUrl)
      globalWebSocket = new WebSocket(websocketUrl)

      // Add a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (globalWebSocket && globalWebSocket.readyState === WebSocket.CONNECTING) {
          console.warn('⚠️ IDE Context WebSocket connection timeout')
          globalWebSocket.close()
        }
      }, 10000) // 10 second timeout

      globalWebSocket.onopen = () => {
        clearTimeout(connectionTimeout)
        isConnecting = false
        updateConnectionStatus(true)
        connectionAttempts = 0
        console.log('✅ IDE Context WebSocket connected successfully')

        // Auto-request context on new connection to sync state
        console.log('✅ IDE Context WebSocket ready - requesting context to sync state')

        // Delay the context request slightly to ensure connection is stable
        setTimeout(() => {
          // Use debounced request to avoid duplicate sends from multiple mounts
          requestContext()
        }, 100)
      }

      globalWebSocket.onmessage = event => {
        try {
          const message = JSON.parse(event.data)

          console.log('📥 Received message from extension:', message.type, { hasData: !!message.data })

          if (!globalDispatch) {
            console.warn('⚠️ globalDispatch not available, skipping message processing')
            return
          }

          switch (message.type) {
            case 'project_state_update':
            case 'context_response': {
              // Clear the matching pending context timeout if requestId echoed; otherwise clear all
              const responseRequestIdRaw = message.requestId ?? message.data?.requestId
              const responseRequestId: number | undefined =
                typeof responseRequestIdRaw === 'string' ? Number(responseRequestIdRaw) : responseRequestIdRaw

              if (typeof responseRequestId === 'number' && contextRequestTimeoutsGlobal.has(responseRequestId)) {
                const tid = contextRequestTimeoutsGlobal.get(responseRequestId)!
                clearTimeout(tid)
                contextRequestTimeoutsGlobal.delete(responseRequestId)
                console.log('✅ Context response received - cleared timeout for requestId', responseRequestId)
              } else if (contextRequestTimeoutsGlobal.size > 0) {
                console.log(
                  '✅ Context response received - clearing',
                  contextRequestTimeoutsGlobal.size,
                  'pending timeout(s) (no requestId echoed)'
                )
                contextRequestTimeoutsGlobal.forEach(tid => clearTimeout(tid))
                contextRequestTimeoutsGlobal.clear()
              }

              // Check if this is a real extension response or empty server response
              const projectState = message.data
              console.log('projectState ----------------------', projectState)
              const isRealExtensionResponse = Boolean(
                projectState &&
                  (projectState.workspace ||
                    (projectState.allFiles && projectState.allFiles.length > 0) ||
                    (projectState.openFiles && projectState.openFiles.length > 0))
              )

              globalDispatch(setExtensionStatus(isRealExtensionResponse))

              console.log('📊 Processing project state:', {
                isRealExtensionResponse,
                hasWorkspace: !!projectState.workspace,
                openFilesCount: projectState.openFiles?.length || 0,
                allFilesCount: projectState.allFiles?.length || 0,
                hasActiveFile: !!projectState.activeFile,
              })

              if (projectState.workspace) {
                globalDispatch(
                  updateWorkspace({
                    name: projectState.workspace,
                    totalFiles: projectState.allFiles?.length || 0,
                    lastScanned: new Date().toISOString(),
                  })
                )
              }

              if (projectState.openFiles) {
                globalDispatch(setOpenFiles(projectState.openFiles))
              }

              if (projectState.activeFile && projectState.openFiles) {
                const activeFile = projectState.openFiles.find((f: FileInfo) => f.path === projectState.activeFile)
                globalDispatch(setActiveFile(activeFile || null))
              }

              if (projectState.allFiles) {
                globalDispatch(setAllFiles(projectState.allFiles))
              }

              if (projectState.currentSelection) {
                globalDispatch(setCurrentSelection(projectState.currentSelection))
              }
              break
            }

            case 'file_opened':
              const openedFile = message.data as FileInfo
              globalDispatch(addOpenFile(openedFile))
              addRecentActivity('file_opened', openedFile.path, { file: openedFile })
              break

            case 'file_closed':
              const closedFilePath = message.data.path
              globalDispatch(removeOpenFile(closedFilePath))
              addRecentActivity('file_closed', closedFilePath)
              break

            case 'active_file_changed':
              const activeFilePath = message.data.path
              // Use current Redux state to find the active file
              const currentOpenFiles = ideContext.openFiles
              const activeFile = activeFilePath ? currentOpenFiles.find(f => f.path === activeFilePath) || null : null
              globalDispatch(setActiveFile(activeFile))
              break

            case 'selection_changed':
              const selection = message.data as SelectionInfo
              globalDispatch(
                setCurrentSelection({
                  ...selection,
                  timestamp: new Date().toISOString(),
                })
              )
              addRecentActivity('selection_changed', selection.filePath, {
                selection: selection.selectedText.substring(0, 100),
              })
              break

            case 'file_contents_response':
              const fileContent = message.data
              const responseRequestIdRaw = message.requestId ?? fileContent?.requestId
              const responseRequestId: number | undefined =
                typeof responseRequestIdRaw === 'string' ? Number(responseRequestIdRaw) : responseRequestIdRaw

              // Check if we've already processed this response
              if (responseRequestId && processedFileResponsesGlobal.has(responseRequestId)) {
                break
              }

              globalDispatch(
                addSelectedFileForChat({
                  path: fileContent.path,
                  relativePath: fileContent.relativePath,
                  name: fileContent.name ? fileContent.name : fileContent.path,
                  contents: fileContent.contents,
                  contentLength: fileContent.contents?.length || 0,
                  requestId: responseRequestId,
                })
              )

              if (typeof responseRequestId === 'number' && pendingFileRequestsGlobal.has(responseRequestId)) {
                const resolve = pendingFileRequestsGlobal.get(responseRequestId)
                if (resolve) {
                  resolve(fileContent.contents)
                  pendingFileRequestsGlobal.delete(responseRequestId)
                  processedFileResponsesGlobal.add(responseRequestId)

                  // Clean up processed responses after a delay to prevent memory leaks
                  setTimeout(() => {
                    processedFileResponsesGlobal.delete(responseRequestId)
                  }, 30000) // 30 seconds
                }
              } else {
                console.warn('⚠️ No pending request found for requestId:', responseRequestIdRaw)
              }
              break

            case 'file_contents_error':
              const errorData = message.data
              console.error('❌ File content error:', errorData.path, errorData.error)
              // Resolve with null on error - check both message.requestId and data.requestId
              const errorRequestIdRaw = message.requestId ?? errorData.requestId
              const errorRequestId: number | undefined =
                typeof errorRequestIdRaw === 'string' ? Number(errorRequestIdRaw) : errorRequestIdRaw
              if (typeof errorRequestId === 'number' && pendingFileRequestsGlobal.has(errorRequestId)) {
                const resolve = pendingFileRequestsGlobal.get(errorRequestId)
                resolve?.(null)
                pendingFileRequestsGlobal.delete(errorRequestId)
              } else {
                console.warn('⚠️ No pending request found for error requestId:', errorRequestIdRaw)
              }
              break
          }
        } catch (error) {
          console.error('Failed to parse IDE context message:', error)
        }
      }

      globalWebSocket.onclose = event => {
        clearTimeout(connectionTimeout)
        isConnecting = false
        console.log('🔌 IDE Context WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        })
        updateConnectionStatus(false)
        // Clear any outstanding context timeouts on close
        if (contextRequestTimeoutsGlobal.size > 0) {
          contextRequestTimeoutsGlobal.forEach(tid => clearTimeout(tid))
          contextRequestTimeoutsGlobal.clear()
        }

        // Only attempt to reconnect if this wasn't an intentional close
        if (connectionAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000)
          console.log(
            `🔄 Attempting to reconnect in ${delay}ms (attempt ${connectionAttempts + 1}/${maxReconnectAttempts})`
          )
          reconnectTimeout.current = setTimeout(() => {
            connectionAttempts++
            connect()
          }, delay)
        } else {
          console.warn('⚠️ Max reconnection attempts reached, giving up')
        }
      }

      globalWebSocket.onerror = error => {
        clearTimeout(connectionTimeout)
        isConnecting = false
        console.error('❌ IDE Context WebSocket error:', error)
        console.warn('⚠️ IDE Context WebSocket connection failed - IDE features will be limited')
        updateConnectionStatus(false)
      }
    } catch (error) {
      console.error('Failed to connect to IDE Context WebSocket:', error)
      isConnecting = false
      updateConnectionStatus(false)
    }
  }

  const getFileByPath = (path: string): FileInfo | null => {
    return ideContext.openFiles.find(file => file.path === path || file.relativePath === path) || null
  }

  useEffect(() => {
    // Only connect if not already connected or connecting
    if (!globalWebSocket || globalWebSocket.readyState === WebSocket.CLOSED) {
      connect()
    } else if (globalWebSocket.readyState === WebSocket.OPEN) {
      // Connection already exists - request context to sync state after refresh
      console.log('✅ IDE Context WebSocket already connected - requesting context to sync state')

      // Delay the context request slightly to ensure component is mounted
      setTimeout(() => {
        // Use debounced request to avoid duplicate sends from multiple mounts
        requestContext()
      }, 100)
    }

    return () => {
      // Don't close connection on unmount - let it persist across page changes
      // Cleanup will happen when the app actually closes
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
      }
      if (contextRequestTimeoutsGlobal.size > 0) {
        contextRequestTimeoutsGlobal.forEach(tid => clearTimeout(tid))
        contextRequestTimeoutsGlobal.clear()
      }
    }
  }, [])

  // Convert file paths to relative paths for @mention functionality
  const availableFiles = ideContext.allFiles
    .map(filePath => {
      // Extract relative path from absolute path
      const parts = filePath.split(/[/\\]/)
      const workspaceName = ideContext.workspace?.name

      if (workspaceName) {
        const workspaceIndex = parts.findIndex(part => part === workspaceName)
        if (workspaceIndex !== -1 && workspaceIndex < parts.length - 1) {
          return parts.slice(workspaceIndex + 1).join('/')
        }
      }

      // Fallback to filename if workspace detection fails
      return parts[parts.length - 1] || filePath
    })
    .filter(Boolean)

  return {
    ideContext,
    requestContext,
    requestFileContent,
    availableFiles,
    getFileByPath,
  }
}

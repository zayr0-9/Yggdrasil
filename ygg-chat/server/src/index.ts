import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import { createServer } from 'http'
import path from 'path'
import { WebSocket, WebSocketServer } from 'ws'
import { initializeDatabase, initializeStatements } from './database/db'
import chatRoutes from './routes/chat'
import settingsRoutes from './routes/settings'

dotenv.config({ path: '../.env' })

const app = express()
const server = createServer(app)

// WebSocket Server for IDE Context
const wss = new WebSocketServer({ server, path: '/ide-context' })

interface ConnectedClient {
  ws: WebSocket
  type: 'extension' | 'frontend'
  id: string
}

const clients = new Set<ConnectedClient>()

wss.on('connection', (ws, request) => {
  const url = new URL(request.url!, `http://${request.headers.host}`)
  const clientType = url.searchParams.get('type') as 'extension' | 'frontend'
  const clientId = url.searchParams.get('id') || 'anonymous'

  const client: ConnectedClient = {
    ws,
    type: clientType || 'frontend',
    id: clientId,
  }

  clients.add(client)
  console.log(`🔌 ${clientType} connected: ${clientId}`)

  ws.on('message', data => {
    try {
      const message = JSON.parse(data.toString())
      console.log(`📨 Message from ${client.type}:`, message.type)

      // Relay messages from extension to all frontend clients
      if (client.type === 'extension') {
        const outgoing = {
          ...message,
          // Normalize requestId to be present at the top-level if available in data
          requestId: message.requestId ?? message.data?.requestId,
        }
        console.log(
          `🔄 index.ts --- Relaying ${message.type} from extension to frontend clients`,
          {
            requestIdTopLevel: outgoing.requestId,
            requestIdInData: message.data?.requestId,
          }
        )
        clients.forEach(c => {
          if (c.type === 'frontend' && c.ws.readyState === c.ws.OPEN) {
            c.ws.send(JSON.stringify(outgoing))
          }
        })
      }

      // Handle frontend requests to extension
      if (client.type === 'frontend') {
        if (message.type === 'request_context') {
          const extensionClients = Array.from(clients).filter(
            c => c.type === 'extension' && c.ws.readyState === c.ws.OPEN
          )
          console.log(`📤 Forwarding context request to ${extensionClients.length} extensions`, {
            requestId: message.requestId,
          })

          clients.forEach(c => {
            if (c.type === 'extension' && c.ws.readyState === c.ws.OPEN) {
              c.ws.send(
                JSON.stringify({
                  type: 'request_context',
                  requestId: message.requestId,
                })
              )
            }
          })

          if (extensionClients.length === 0) {
            console.warn('⚠️ No extensions available to handle context request')
            // Send back an empty response so frontend stops waiting
            client.ws.send(
              JSON.stringify({
                type: 'context_response',
                requestId: message.requestId,
                data: {
                  workspace: null,
                  openFiles: [],
                  allFiles: [],
                  activeFile: null,
                  currentSelection: null,
                },
              })
            )
          }
        } else if (message.type === 'request_file_content') {
          console.log(`📤 Forwarding file request to extensions`, {
            requestId: message.requestId,
            path: message.data.path,
          })
          const extensionClients = Array.from(clients).filter(
            c => c.type === 'extension' && c.ws.readyState === c.ws.OPEN
          )
          console.log(`🔌 Found ${extensionClients.length} connected extensions`)

          clients.forEach(c => {
            if (c.type === 'extension' && c.ws.readyState === c.ws.OPEN) {
              c.ws.send(
                JSON.stringify({
                  type: 'request_file_content',
                  requestId: message.requestId,
                  data: {
                    path: message.data.path,
                  },
                })
              )
            }
          })
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  })

  ws.on('close', () => {
    clients.delete(client)
    console.log(`🔌 ${client.type} disconnected: ${client.id}`)
  })

  ws.on('error', error => {
    console.error(`WebSocket error for ${client.type}:`, error)
    clients.delete(client)
  })
})

app.use(cors())
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))
app.use('/api', chatRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')))

// Debug endpoint to see connected clients
app.get('/api/debug/ide-clients', (req, res) => {
  const clientList = Array.from(clients).map(c => ({
    type: c.type,
    id: c.id,
    connected: c.ws.readyState === c.ws.OPEN,
  }))
  res.json(clientList)
})

const dbPath = path.join(__dirname, 'data', 'yggdrasil.db')
if (!fs.existsSync(dbPath)) {
  console.log('Database file not found, creating new database...')
}

initializeDatabase()
initializeStatements()
;(async () => {
  server.listen(3001, () => {
    console.log('🚀 Server on :3001')
    console.log('🔌 WebSocket IDE Context on ws://localhost:3001/ide-context')
  })
})()

app.get('/api/debug/routes', (req, res) => {
  const routes: any[] = []
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods),
      })
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods),
          })
        }
      })
    }
  })
  res.json(routes)
})

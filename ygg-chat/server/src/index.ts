import cors from 'cors'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { initializeDatabase } from './database/db'
import { initializeStatements } from './database/db'
import chatRoutes from './routes/chat'
import { modelService } from './utils/modelService'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', chatRoutes)

// Check if database file exists before initializing
const dbPath = path.join(__dirname, 'data', 'yggdrasil.db')
if (!fs.existsSync(dbPath)) {
  console.log('Database file not found, initializing new database...')
  initializeDatabase()
} else {
  console.log('Database file exists, skipping schema initialization')
  // Always initialize prepared statements even if DB exists
  initializeStatements()
}
;(async () => {
  await modelService.getAvailableModels() // Force cache population
  console.log('Models discovered:', await modelService.getAvailableModels())
  app.listen(3001, () => console.log('Server on :3001'))
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

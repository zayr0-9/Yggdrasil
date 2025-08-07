import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { initializeDatabase, initializeStatements } from './database/db'
import chatRoutes from './routes/chat'
import { modelService } from './utils/modelService'

dotenv.config({ path: '../.env' })

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', chatRoutes)

// Ensure database file and schema exist / are up to date
const dbPath = path.join(__dirname, 'data', 'yggdrasil.db')
if (!fs.existsSync(dbPath)) {
  console.log('Database file not found, creating new database...')
}
// Initialize / migrate schema (CREATE TABLE IF NOT EXISTS is idempotent)
initializeDatabase()
// Prepare statements (requires tables to exist)
initializeStatements()
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

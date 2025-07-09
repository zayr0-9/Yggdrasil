// import compression from 'compression'
// import cors from 'cors'
// import express from 'express'
// import helmet from 'helmet'
// import morgan from 'morgan'

// import dotenv from 'dotenv'
// import { initializeDatabase } from './database/db'
// import { errorHandler } from './middleware/errorHandler'

// // Load environment variables
// dotenv.config()

// // Initialize DB on startup
// initializeDatabase()
// console.log('Database initialized')

// // Validate environment configuration
// // validateEnv();

// const app = express()
// const PORT = process.env.PORT || 3001

// // Security middleware
// app.use(helmet())
// app.use(
//   cors({
//     origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
//     credentials: true,
//   })
// )

// // Utility middleware
// app.use(compression())
// app.use(morgan('combined'))
// app.use(express.json({ limit: '10mb' }))
// app.use(express.urlencoded({ extended: true }))

// // API routes

// // Health check endpoint
// app.get('/health', (req, res) => {
//   res.json({
//     status: 'healthy',
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime(),
//   })
// })

// // Error handling middleware (must be last)
// app.use(errorHandler)

// // Start server
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`)
//   console.log(`📊 Health check: http://localhost:${PORT}/health`)
// })

import cors from 'cors'
import express from 'express'
import { initializeDatabase } from './database/db'
import chatRoutes from './routes/chat'
import { modelService } from './utils/modelService'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', chatRoutes)

initializeDatabase()
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

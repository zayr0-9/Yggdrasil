// server/src/database/db.ts
import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(__dirname, '../data', 'yggdrasil.db')

export const db = new Database(DB_PATH)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Initialize schema
export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      model_name TEXT DEFAULT 'gemma3:4b',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `)

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
  `)

  // Initialize prepared statements after tables exist
  initializeStatements()
}

// Prepared statements - initialized after tables exist
export let statements: any = {}

function initializeStatements() {
  statements = {
    // Users
    createUser: db.prepare('INSERT INTO users (username) VALUES (?)'),
    getAllUsers: db.prepare('SELECT * FROM users ORDER BY created_at DESC'),

    getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
    getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    updateUser: db.prepare('UPDATE users SET username = ? WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

    // Conversations
    createConversation: db.prepare('INSERT INTO conversations (user_id, title, model_name) VALUES (?, ?, ?)'),
    getConversationsByUser: db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC'),
    getConversationById: db.prepare('SELECT * FROM conversations WHERE id = ?'),
    updateConversationTitle: db.prepare(
      'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ),
    updateConversationTimestamp: db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    deleteConversation: db.prepare('DELETE FROM conversations WHERE id = ?'),
    deleteConversationsByUser: db.prepare('DELETE FROM conversations WHERE user_id = ?'),

    // Messages
    createMessage: db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'),
    getMessagesByConversation: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'),
    getLastMessage: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1'),
    deleteMessagesByConversation: db.prepare('DELETE FROM messages WHERE conversation_id = ?'),
  }
}

// Graceful shutdown
process.on('exit', () => db.close())
process.on('SIGHUP', () => process.exit(128 + 1))
process.on('SIGINT', () => process.exit(128 + 2))
process.on('SIGTERM', () => process.exit(128 + 15))

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

  // Messages table with hybrid parent_id + children_ids design
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      parent_id INTEGER,
      children_ids TEXT DEFAULT '[]',
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE CASCADE
    )
  `)

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
  `)

  // Full Text Search virtual table
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content, 
      conversation_id UNINDEXED,
      message_id UNINDEXED,
      tokenize = 'porter unicode61'
    )
  `)

  // Triggers to maintain children_ids integrity
  db.exec(`
    CREATE TRIGGER messages_children_insert AFTER INSERT ON messages 
    WHEN NEW.parent_id IS NOT NULL
    BEGIN
      UPDATE messages 
      SET children_ids = (
        SELECT CASE 
          WHEN children_ids = '[]' OR children_ids = '' THEN '[' || NEW.id || ']'
          ELSE SUBSTR(children_ids, 1, LENGTH(children_ids)-1) || ',' || NEW.id || ']'
        END
        FROM messages WHERE id = NEW.parent_id
      )
      WHERE id = NEW.parent_id;
    END;
  `)

  // Triggers to keep FTS table in sync with messages table
  db.exec(`
    -- Insert trigger
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(content, conversation_id, message_id) 
      VALUES (new.content, new.conversation_id, new.id);
    END;

    -- Update trigger  
    CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
      UPDATE messages_fts 
      SET content = new.content 
      WHERE message_id = new.id;
    END;

    -- Delete trigger
    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE message_id = old.id;
    END;
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

    // Messages - Core operations
    createMessage: db.prepare(
      'INSERT INTO messages (conversation_id, parent_id, role, content, children_ids) VALUES (?, ?, ?, ?, ?)'
    ),
    getMessageById: db.prepare('SELECT * FROM messages WHERE id = ?'),
    getMessagesByConversation: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'),
    getLastMessage: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1'),
    deleteMessagesByConversation: db.prepare('DELETE FROM messages WHERE conversation_id = ?'),
    updateMessage: db.prepare('UPDATE messages SET content = ? WHERE id = ?'),
    deleteMessage: db.prepare('DELETE FROM messages WHERE id = ?'),

    // Messages - Optimized branch operations using children_ids

    // Messages - Tree operations (simplified with children_ids)
    getMessageTree: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'),

    // Full Text Search operations
    searchMessages: db.prepare(`
      SELECT m.*, highlight(messages_fts, 0, '<mark>', '</mark>') as highlighted
      FROM messages m
      JOIN messages_fts ON m.id = messages_fts.message_id
      WHERE messages_fts MATCH ? AND m.conversation_id = ?
      ORDER BY rank
    `),

    searchAllUserMessages: db.prepare(`
      SELECT m.*, c.title as conversation_title, 
             highlight(messages_fts, 0, '<mark>', '</mark>') as highlighted
      FROM messages m
      JOIN messages_fts ON m.id = messages_fts.message_id
      JOIN conversations c ON m.conversation_id = c.id
      WHERE messages_fts MATCH ? AND c.user_id = ?
      ORDER BY rank
      LIMIT 50
    `),

    // Advanced FTS with snippets (shows context around matches)
    searchMessagesWithSnippet: db.prepare(`
      SELECT m.*, 
             snippet(messages_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
      FROM messages m
      JOIN messages_fts ON m.id = messages_fts.message_id
      WHERE messages_fts MATCH ? AND m.conversation_id = ?
      ORDER BY rank
    `),

    // Search with pagination
    searchAllUserMessagesPaginated: db.prepare(`
      SELECT m.*, c.title as conversation_title, 
             highlight(messages_fts, 0, '<mark>', '</mark>') as highlighted
      FROM messages m
      JOIN messages_fts ON m.id = messages_fts.message_id
      JOIN conversations c ON m.conversation_id = c.id
      WHERE messages_fts MATCH ? AND c.user_id = ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `),
  }
}

// Utility function to rebuild FTS index (useful after bulk imports)
export function rebuildFTSIndex() {
  db.exec(`
    DELETE FROM messages_fts;
    INSERT INTO messages_fts(content, conversation_id, message_id)
    SELECT content, conversation_id, id FROM messages;
  `)
}

// Graceful shutdown
process.on('exit', () => db.close())
process.on('SIGHUP', () => process.exit(128 + 1))
process.on('SIGINT', () => process.exit(128 + 2))
process.on('SIGTERM', () => process.exit(128 + 15))

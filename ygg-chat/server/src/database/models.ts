import { BaseMessage } from '../../../shared/types'
import { modelService } from '../utils/modelService'
import { statements } from './db'

export interface User {
  id: number
  username: string
  created_at: string
}

export interface Conversation {
  id: number
  user_id: number
  title: string | null
  model_name: string
  created_at: string
  updated_at: string
}

export interface Message extends BaseMessage {}

// Search result interfaces
export interface SearchResult extends Message {
  highlighted: string
  conversation_title?: string
}

export interface SearchResultWithSnippet extends Message {
  snippet: string
}

export class UserService {
  static create(username: string): User {
    const result = statements.createUser.run(username)
    return statements.getUserById.get(result.lastInsertRowid) as User
  }

  static getById(id: number): User | undefined {
    return statements.getUserById.get(id) as User | undefined
  }

  static getByUsername(username: string): User | undefined {
    return statements.getUserByUsername.get(username) as User | undefined
  }

  static getAll(): User[] {
    return statements.getAllUsers.all() as User[]
  }

  static update(id: number, username: string): User | undefined {
    statements.updateUser.run(username, id)
    return statements.getUserById.get(id) as User | undefined
  }

  static delete(id: number): void {
    statements.deleteUser.run(id)
  }
}

export class ConversationService {
  static async create(userId: number, title?: string, modelName?: string): Promise<Conversation> {
    const selectedModel = modelName || (await modelService.getDefaultModel())
    const result = statements.createConversation.run(userId, title, selectedModel)
    return statements.getConversationById.get(result.lastInsertRowid) as Conversation
  }

  static getByUser(userId: number): Conversation[] {
    return statements.getConversationsByUser.all(userId) as Conversation[]
  }

  static getById(id: number): Conversation | undefined {
    return statements.getConversationById.get(id) as Conversation | undefined
  }

  static updateTitle(id: number, title: string): void {
    statements.updateConversationTitle.run(title, id)
  }

  static touch(id: number): void {
    statements.updateConversationTimestamp.run(id)
  }

  static delete(id: number): void {
    statements.deleteConversation.run(id)
  }

  static deleteByUser(userId: number): void {
    statements.deleteConversationsByUser.run(userId)
  }
}

export class MessageService {
  static create(
    conversationId: number,
    role: Message['role'],
    content: string,
    parentId: number | null = null
    // children: []
  ): Message {
    const result = statements.createMessage.run(conversationId, parentId, role, content, '[]')
    statements.updateConversationTimestamp.run(conversationId)
    return statements.getMessageById.get(result.lastInsertRowid) as Message
  }

  static getById(id: number): Message | undefined {
    return statements.getMessageById.get(id) as Message | undefined
  }

  static getByConversation(conversationId: number): Message[] {
    return statements.getMessagesByConversation.all(conversationId) as Message[]
  }

  // Simple tree fetch - let frontend handle tree logic
  static getMessageTree(conversationId: number): Message[] {
    return statements.getMessageTree.all(conversationId) as Message[]
  }

  static getLastMessage(conversationId: number): Message | undefined {
    return statements.getLastMessage.get(conversationId) as Message | undefined
  }

  static getChildrenIds(id: number): number[] {
    const row = statements.getChildrenIds.get(id) as { children_ids: string } | undefined
    const raw = row?.children_ids ?? '[]'
    // Try JSON parse first (expected format like "[1,2,3]")
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .map(v => Number(v))
          .filter(n => Number.isFinite(n))
      }
    } catch {
      // fall through to manual parsing
    }
    // Fallback: accept CSV with/without brackets
    const cleaned = raw.replace(/^\[|\]$/g, '').trim()
    if (!cleaned) return []
    return cleaned
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n))
  }

  static deleteByConversation(conversationId: number): void {
    statements.deleteMessagesByConversation.run(conversationId)
  }

  static update(id: number, content: string): Message | undefined {
    statements.updateMessage.run(content, id)
    return statements.getMessageById.get(id) as Message | undefined
  }

  static delete(id: number): boolean {
    const result = statements.deleteMessage.run(id)
    return result.changes > 0
  }

  // Full Text Search methods
  static searchInConversation(query: string, conversationId: number): SearchResult[] {
    return statements.searchMessages.all(query, conversationId) as SearchResult[]
  }

  static searchAllUserMessages(query: string, userId: number, limit: number = 50): SearchResult[] {
    return statements.searchAllUserMessages.all(query, userId) as SearchResult[]
  }

  static searchWithSnippets(query: string, conversationId: number): SearchResultWithSnippet[] {
    return statements.searchMessagesWithSnippet.all(query, conversationId) as SearchResultWithSnippet[]
  }

  static searchAllUserMessagesPaginated(
    query: string,
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): SearchResult[] {
    return statements.searchAllUserMessagesPaginated.all(query, userId, limit, offset) as SearchResult[]
  }
}

// Heimdall tree format
export interface ChatNode {
  id: string
  message: string
  sender: 'user' | 'assistant'
  children: ChatNode[]
}

// Build tree structure from flat message array with children_ids
export function buildMessageTree(messages: Message[]): ChatNode | null {
  const messageMap = new Map<number, ChatNode>()

  // Create nodes
  messages.forEach(msg => {
    messageMap.set(msg.id, {
      id: msg.id.toString(),
      message: msg.content,
      sender: msg.role as 'user' | 'assistant',
      children: [],
    })
  })

  let root: ChatNode | null = null

  // Build tree using children_ids
  messages.forEach(msg => {
    const node = messageMap.get(msg.id)!

    if (msg.parent_id === null) {
      root = node
    }

    // Add children using children_ids array
    const childIds: number[] = msg.children_ids
    childIds.forEach(childId => {
      const childNode = messageMap.get(childId)
      if (childNode) {
        node.children.push(childNode)
      }
    })
  })

  return root
}

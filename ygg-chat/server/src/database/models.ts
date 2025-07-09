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

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
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
  // NEW METHODS
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
  static create(conversationId: number, role: Message['role'], content: string): Message {
    const result = statements.createMessage.run(conversationId, role, content)
    // Update conversation timestamp
    statements.updateConversationTimestamp.run(conversationId)
    return statements.getMessagesByConversation.all(conversationId).pop() as Message
  }

  static getByConversation(conversationId: number): Message[] {
    return statements.getMessagesByConversation.all(conversationId) as Message[]
  }

  static getLastMessage(conversationId: number): Message | undefined {
    return statements.getLastMessage.get(conversationId) as Message | undefined
  }

  static deleteByConversation(conversationId: number): void {
    statements.deleteMessagesByConversation.run(conversationId)
  }
}

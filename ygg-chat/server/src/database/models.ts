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
  parent_id: number | null
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

// Extended interfaces for tree and search results
export interface MessageTreeNode extends Message {
  depth: number
  path: string
}

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
  // Updated to include parent_id parameter
  static create(
    conversationId: number,
    role: Message['role'],
    content: string,
    parentId: number | null = null
  ): Message {
    const result = statements.createMessage.run(conversationId, parentId, role, content)
    // Update conversation timestamp
    statements.updateConversationTimestamp.run(conversationId)
    // Get the created message by ID instead of using pop()
    return statements.getMessageById.get(result.lastInsertRowid) as Message
  }

  static getById(id: number): Message | undefined {
    return statements.getMessageById.get(id) as Message | undefined
  }

  static getByConversation(conversationId: number): Message[] {
    return statements.getMessagesByConversation.all(conversationId) as Message[]
  }

  // Get the complete message tree for a conversation
  static getMessageTree(conversationId: number): MessageTreeNode[] {
    return statements.getMessageTree.all(conversationId) as MessageTreeNode[]
  }

  static getLastMessage(conversationId: number): Message | undefined {
    return statements.getLastMessage.get(conversationId) as Message | undefined
  }

  static deleteByConversation(conversationId: number): void {
    statements.deleteMessagesByConversation.run(conversationId)
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

// Helper function to build a tree structure from flat message array
export function buildMessageTree(messages: MessageTreeNode[]): MessageTreeNode | null {
  const messageMap = new Map<number, MessageTreeNode & { children: MessageTreeNode[] }>()
  const roots: (MessageTreeNode & { children: MessageTreeNode[] })[] = []

  // First pass: create all nodes with children array
  messages.forEach(msg => {
    messageMap.set(msg.id, { ...msg, children: [] })
  })

  // Second pass: build tree structure
  messages.forEach(msg => {
    const node = messageMap.get(msg.id)!
    if (msg.parent_id === null) {
      roots.push(node)
    } else {
      const parent = messageMap.get(msg.parent_id)
      if (parent) {
        parent.children.push(node)
      }
    }
  })

  // Return the first root (assuming single root per conversation)
  return roots[0] || null
}

// Convert tree structure to the format expected by Heimdall component
export interface ChatNode {
  id: string
  message: string
  sender: 'user' | 'assistant'
  children: ChatNode[]
}

// export function convertToHeimdallFormat(root: MessageTreeNode & { children: MessageTreeNode[] }): ChatNode {
//   const convert = (node: MessageTreeNode & { children: MessageTreeNode[] }): ChatNode => {
//     return {
//       id: node.id.toString(),
//       message: node.content,
//       sender: node.role === 'user' ? 'user' : 'assistant',
//       children: node.children.map(convert),
//     }
//   }

//   return convert(root)
// }

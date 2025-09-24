import { BaseMessage, Project } from '../../../shared/types'
import { stripMarkdownToText } from '../utils/markdownStripper'
import { db, statements } from './db'

// Utility function to sanitize FTS queries
function sanitizeFTSQuery(query: string): string {
  // Split into terms, escape double-quotes, and append * for prefix matching.
  return query
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/"/g, '""')) // escape quotes
    .map(w => `${w}*`) // prefix search
    .join(' OR ') // match any token
}

// Lazy getter for prepared statement to set plain_text_content, since tables are created at runtime
let _setPlainTextStmt: import('better-sqlite3').Statement<[string, number]> | null = null
function setPlainTextForMessage(text: string, id: number) {
  try {
    if (!_setPlainTextStmt) {
      _setPlainTextStmt = db.prepare('UPDATE messages SET plain_text_content = ? WHERE id = ?')
    }
    _setPlainTextStmt.run(text, id)
  } catch {
    // ignore
  }
}

export interface User {
  id: number
  username: string
  created_at: string
}

export class FileContentService {
  /**
   * Create a file content record with file name and paths
   */
  static create(params: {
    fileName: string
    absolutePath: string
    relativePath: string
    fileContent?: string | null
    sizeBytes?: number | null
    messageId?: number | null
  }): FileContent {
    const { fileName, absolutePath, relativePath, fileContent = null, sizeBytes = null, messageId = null } = params

    // Check if file already exists by absolute path
    const existing = statements.getFileContentByPath.get(absolutePath) as FileContent | undefined
    if (existing) {
      // Link to message if provided
      if (messageId) {
        statements.linkFileContentToMessage.run(messageId, existing.id)
        return { ...existing, message_id: messageId }
      }
      return existing
    }

    const result = statements.createFileContent.run(fileName, absolutePath, relativePath, fileContent, sizeBytes)
    const created = statements.getFileContentById.get(result.lastInsertRowid) as FileContent

    // Create link if messageId provided
    if (messageId) {
      statements.linkFileContentToMessage.run(messageId, created.id)
      return { ...created, message_id: messageId }
    }
    return created
  }

  static getByMessage(messageId: number): FileContent[] {
    return statements.getFileContentsByMessage.all(messageId) as FileContent[]
  }

  static linkToMessage(fileContentId: number, messageId: number): FileContent | undefined {
    statements.linkFileContentToMessage.run(messageId, fileContentId)
    const base = statements.getFileContentById.get(fileContentId) as FileContent | undefined
    return base ? { ...base, message_id: messageId } : undefined
  }

  static findByPath(absolutePath: string): FileContent | undefined {
    return statements.getFileContentByPath.get(absolutePath) as FileContent | undefined
  }

  static getById(id: number): FileContent | undefined {
    return statements.getFileContentById.get(id) as FileContent | undefined
  }

  static unlinkFromMessage(messageId: number, fileContentId: number): number {
    const res = statements.unlinkFileContentFromMessage.run(messageId, fileContentId)
    return res.changes ?? 0
  }

  static deleteByMessage(messageId: number): number {
    const res = statements.deleteFileContentLinksByMessage.run(messageId)
    return res.changes ?? 0
  }
}

export class AttachmentService {
  /**
   * Create an attachment record. For local files, prefer providing filePath and optional url (if served).
   * For CDN/object storage, provide url and set storage='url'.
   * If sha256 is provided and exists, the existing record is returned (dedupe) unless messageId is provided to relink.
   */
  static create(params: {
    messageId?: number | null
    kind: 'image'
    mimeType: string
    storage?: 'file' | 'url'
    url?: string | null
    filePath?: string | null
    width?: number | null
    height?: number | null
    sizeBytes?: number | null
    sha256?: string | null
  }): Attachment {
    const {
      messageId = null,
      kind,
      mimeType,
      storage,
      url = null,
      filePath = null,
      width = null,
      height = null,
      sizeBytes = null,
      sha256 = null,
    } = params

    // If sha256 provided, try to reuse existing (dedupe)
    if (sha256) {
      const existing = statements.getAttachmentBySha256.get(sha256) as Attachment | undefined
      if (existing) {
        // Link via join table if a messageId is provided
        if (messageId) {
          statements.linkAttachmentToMessage.run(messageId, existing.id)
          // Return with message context for backward compatibility
          return { ...existing, message_id: messageId }
        }
        return existing
      }
    }

    const resolvedStorage: 'file' | 'url' = storage ?? (url ? 'url' : 'file')
    const result = statements.createAttachment.run(
      messageId,
      kind,
      mimeType,
      resolvedStorage,
      url,
      filePath,
      width,
      height,
      sizeBytes,
      sha256
    )
    const created = statements.getAttachmentById.get(result.lastInsertRowid) as Attachment
    // Create link if messageId provided
    if (messageId) {
      statements.linkAttachmentToMessage.run(messageId, created.id)
      return { ...created, message_id: messageId }
    }
    return created
  }

  static getByMessage(messageId: number): Attachment[] {
    return statements.getAttachmentsByMessage.all(messageId) as Attachment[]
  }

  static linkToMessage(attachmentId: number, messageId: number): Attachment | undefined {
    statements.linkAttachmentToMessage.run(messageId, attachmentId)
    const base = statements.getAttachmentById.get(attachmentId) as Attachment | undefined
    return base ? { ...base, message_id: messageId } : undefined
  }

  static findBySha256(sha256: string): Attachment | undefined {
    return statements.getAttachmentBySha256.get(sha256) as Attachment | undefined
  }

  static getById(id: number): Attachment | undefined {
    return statements.getAttachmentById.get(id) as Attachment | undefined
  }

  static unlinkFromMessage(messageId: number, attachmentId: number): number {
    const res = statements.unlinkAttachmentFromMessage.run(messageId, attachmentId)
    return res.changes ?? 0
  }

  static deleteByMessage(messageId: number): number {
    const res = statements.deleteAttachmentsByMessage.run(messageId)
    return res.changes ?? 0
  }
}

export interface Conversation {
  id: number
  user_id: number
  title: string | null
  model_name: string
  system_prompt?: string | null
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

// Attachments (images) associated to messages
export interface Attachment {
  id: number
  message_id: number | null
  kind: 'image'
  mime_type: string
  storage: 'file' | 'url'
  url?: string | null
  file_path?: string | null
  width?: number | null
  height?: number | null
  size_bytes?: number | null
  sha256?: string | null
  created_at: string
}

// File content associated to messages
export interface FileContent {
  id: number
  message_id?: number | null
  file_name: string
  absolute_path: string
  relative_path: string
  file_content?: string | null
  size_bytes?: number | null
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

export class ProjectService {
  static async create(
    name: string,
    created_at: string,
    updated_at: string,
    conversation_id: number,
    context: string,
    system_prompt: string
  ): Promise<Project> {
    const result = statements.createProject.run(name, created_at, updated_at, context, system_prompt)
    return statements.getProjectById.get(result.lastInsertRowid) as Project
  }

  static getAll(): Project[] {
    return statements.getAllProjects.all() as Project[]
  }

  static getById(id: number): Project | undefined {
    return statements.getProjectById.get(id) as Project | undefined
  }

  static update(
    id: number,
    name: string,
    updated_at: string,
    context: string,
    system_prompt: string
  ): Project | undefined {
    statements.updateProject.run(name, updated_at, context, system_prompt, id)
    return statements.getProjectById.get(id) as Project | undefined
  }

  static getProjectContext(id: number): string | null {
    const row = statements.getProjectContext.get(id) as { context: string | null } | undefined
    console.log(`row ${row}`)
    return row?.context ?? null
  }

  static getProjectIdFromConversation(conversationId: number): number | null {
    const row = statements.getConversationProjectId.get(conversationId) as { project_id: number | null } | undefined
    console.log(`getProjectIdFromConversation - conversationId: ${conversationId}, row:`, row)
    return row?.project_id ?? null
  }

  static delete(id: number): void {
    statements.deleteProject.run(id)
  }
}

export class ConversationService {
  static async create(userId: number, title?: string, modelName?: string, projectId?: number): Promise<Conversation> {
    const selectedModel = modelName || null
    const result = statements.createConversation.run(userId, title, selectedModel, projectId)
    return statements.getConversationById.get(result.lastInsertRowid) as Conversation
  }

  static getByUser(userId: number): Conversation[] {
    return statements.getConversationsByUser.all(userId) as Conversation[]
  }

  static getRecentByUser(userId: number, limit: number): Conversation[] {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10))
    return statements.getRecentConversationsByUser.all(userId, safeLimit) as Conversation[]
  }

  static getByProjectId(id: number): Conversation[] {
    return statements.getConversationByProjectId.all(id) as Conversation[]
  }

  static getById(id: number): Conversation | undefined {
    return statements.getConversationById.get(id) as Conversation | undefined
  }

  static getSystemPrompt(id: number): string | null {
    const row = statements.getConversationSystemPrompt.get(id) as { system_prompt: string | null } | undefined
    return row?.system_prompt ?? null
  }
  static getConversationContext(id: number): string | null {
    const row = statements.getConversationContext.get(id) as { conversation_context: string | null } | undefined
    return row?.conversation_context ?? null
  }
  static updateSystemPrompt(id: number, prompt: string | null): Conversation | undefined {
    statements.updateConversationSystemPrompt.run(prompt, id)
    return statements.getConversationById.get(id) as Conversation | undefined
  }

  static updateContext(id: number, context: string): Conversation | undefined {
    statements.updateConversationContext.run(context, id)
    return statements.getConversationById.get(id) as Conversation | undefined
  }

  static updateTitle(id: number, title: string): Conversation | undefined {
    statements.updateConversationTitle.run(title, id)
    return statements.getConversationById.get(id) as Conversation | undefined
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
    parentId: number | null = null,
    role: Message['role'],
    content: string,
    thinking_block: string,
    modelName?: string,
    tool_calls?: string,
    note?: string
    // children: []
  ): Message {
    const result = statements.createMessage.run(
      conversationId,
      parentId,
      role,
      content,
      thinking_block,
      tool_calls || null,
      '[]',
      modelName,
      note || null
    )
    // Fire-and-forget: compute and persist plain text content, triggers will update FTS
    try {
      const insertedId = Number(result.lastInsertRowid)
      stripMarkdownToText(content)
        .then(text => {
          setPlainTextForMessage(text, insertedId)
        })
        .catch(() => {
          // Fallback to raw content if stripping fails
          setPlainTextForMessage(content, insertedId)
        })
    } catch {
      // ignore background plain text update errors
    }
    statements.updateConversationTimestamp.run(conversationId)
    return statements.getMessageById.get(result.lastInsertRowid) as Message
  }

  static getById(id: number): Message | undefined {
    return statements.getMessageById.get(id) as Message | undefined
  }

  static getByConversation(conversationId: number): Message[] {
    const rows = statements.getMessagesByConversation.all(conversationId) as any[]
    // Normalize SQLite return types to match BaseMessage (boolean/number)
    return rows.map(r => ({
      ...r,
      has_attachments:
        typeof r.has_attachments === 'number'
          ? r.has_attachments > 0
          : typeof r.has_attachments === 'string'
            ? r.has_attachments === '1' || r.has_attachments.toLowerCase() === 'true'
            : !!r.has_attachments,
      attachments_count:
        typeof r.attachments_count === 'number'
          ? r.attachments_count
          : r.attachments_count != null
            ? Number(r.attachments_count)
            : undefined,
      file_content_count:
        typeof r.file_content_count === 'number'
          ? r.file_content_count
          : r.file_content_count != null
            ? Number(r.file_content_count)
            : undefined,
    })) as Message[]
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
        return parsed.map(v => Number(v)).filter(n => Number.isFinite(n))
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

  static update(
    id: number,
    content: string,
    thinking_block: string | null = null,
    tool_calls: string | null = null,
    note: string | null = null
  ): Message | undefined {
    statements.updateMessage.run(content, thinking_block, tool_calls, note, id)
    // Fire-and-forget: update plain text content
    try {
      stripMarkdownToText(content)
        .then(text => {
          setPlainTextForMessage(text, id)
        })
        .catch(() => {
          setPlainTextForMessage(content, id)
        })
    } catch {
      // ignore background plain text update errors
    }
    return statements.getMessageById.get(id) as Message | undefined
  }

  static delete(id: number): boolean {
    const result = statements.deleteMessage.run(id)
    return result.changes > 0
  }

  static deleteMany(ids: number[]): number {
    if (!ids || ids.length === 0) return 0
    const res = statements.deleteMessagesByIds.run(JSON.stringify(ids))
    return res.changes ?? 0
  }

  // Attachments helpers
  static getAttachments(messageId: number): Attachment[] {
    return statements.getAttachmentsByMessage.all(messageId) as Attachment[]
  }

  static linkAttachments(messageId: number, attachmentIds: number[]): Attachment[] {
    if (!attachmentIds || attachmentIds.length === 0)
      return statements.getAttachmentsByMessage.all(messageId) as Attachment[]
    for (const id of attachmentIds) {
      statements.linkAttachmentToMessage.run(messageId, id)
    }
    return statements.getAttachmentsByMessage.all(messageId) as Attachment[]
  }

  static unlinkAttachment(messageId: number, attachmentId: number): Attachment[] {
    statements.unlinkAttachmentFromMessage.run(messageId, attachmentId)
    return statements.getAttachmentsByMessage.all(messageId) as Attachment[]
  }

  // File Content helpers
  static getFileContents(messageId: number): FileContent[] {
    return statements.getFileContentsByMessage.all(messageId) as FileContent[]
  }

  static linkFileContents(messageId: number, fileContentIds: number[]): FileContent[] {
    if (!fileContentIds || fileContentIds.length === 0)
      return statements.getFileContentsByMessage.all(messageId) as FileContent[]
    for (const id of fileContentIds) {
      statements.linkFileContentToMessage.run(messageId, id)
    }
    return statements.getFileContentsByMessage.all(messageId) as FileContent[]
  }

  static unlinkFileContent(messageId: number, fileContentId: number): FileContent[] {
    statements.unlinkFileContentFromMessage.run(messageId, fileContentId)
    return statements.getFileContentsByMessage.all(messageId) as FileContent[]
  }

  // Recently used model names (ordered by most recent usage)
  static getRecentModels(limit: number = 5): string[] {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 5))
    const rows = statements.getRecentModels.all(safeLimit) as { model_name: string; last_used: string }[]
    return rows.map(r => r.model_name)
  }

  // Full Text Search methods
  static searchInConversation(query: string, conversationId: number): SearchResult[] {
    const sanitizedQuery = sanitizeFTSQuery(query)
    return statements.searchMessages.all(sanitizedQuery, conversationId) as SearchResult[]
  }

  static searchAllUserMessages(query: string, userId: number, limit: number = 50): SearchResult[] {
    const sanitizedQuery = sanitizeFTSQuery(query)
    return statements.searchAllUserMessages.all(sanitizedQuery, userId) as SearchResult[]
  }

  static searchMessagesByProject(query: string, projectId: number): SearchResult[] {
    const sanitizedQuery = sanitizeFTSQuery(query)
    return statements.searchMessagesByProject.all(sanitizedQuery, projectId) as SearchResult[]
  }

  static searchWithSnippets(query: string, conversationId: number): SearchResultWithSnippet[] {
    const sanitizedQuery = sanitizeFTSQuery(query)
    return statements.searchMessagesWithSnippet.all(sanitizedQuery, conversationId) as SearchResultWithSnippet[]
  }

  static searchAllUserMessagesPaginated(
    query: string,
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): SearchResult[] {
    const sanitizedQuery = sanitizeFTSQuery(query)
    return statements.searchAllUserMessagesPaginated.all(sanitizedQuery, userId, limit, offset) as SearchResult[]
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

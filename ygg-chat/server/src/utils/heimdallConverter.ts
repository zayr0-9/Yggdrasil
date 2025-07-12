// server/src/utils/heimdallConverter.ts

import { Message } from '../database/models'

// Types matching Heimdall component expectations
interface ChatNode {
  id: string
  message: string
  sender: 'user' | 'assistant'
  children: ChatNode[]
}

/**
 * Converts flat array of messages from database into tree structure for Heimdall component
 * @param messages - Array of messages from MessageService.getByConversation()
 * @returns Root ChatNode or null if no valid tree can be built
 */
export function convertMessagesToHeimdall(messages: Message[]): ChatNode | null {
  if (!messages || messages.length === 0) return null

  // Find root messages (parent_id is null)
  const rootMessages = messages.filter(msg => msg.parent_id === null)

  if (rootMessages.length === 0) return null

  // Sort root messages by creation time and take the first one
  // (assuming single conversation tree, but this handles multiple roots gracefully)
  const root = rootMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]

  // Recursive function to build tree structure
  function buildNode(message: Message): ChatNode {
    // Find all direct children of this message
    const children = messages
      .filter(msg => msg.parent_id === message.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(buildNode) // Recursively build each child

    return {
      id: message.id.toString(),
      message: message.content,
      sender: message.role === 'user' ? 'user' : 'assistant', // Map role to sender
      children,
    }
  }

  return buildNode(root)
}

/**
 * Alternative version that handles multiple conversation trees
 * Returns array of ChatNodes if there are multiple root messages
 */
export function convertMessagesToHeimdallMultiRoot(messages: Message[]): ChatNode[] {
  if (!messages || messages.length === 0) return []

  // Find all root messages (parent_id is null)
  const rootMessages = messages.filter(msg => msg.parent_id === null)

  if (rootMessages.length === 0) return []

  // Sort roots by creation time
  const sortedRoots = rootMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Recursive function to build tree structure
  function buildNode(message: Message): ChatNode {
    const children = messages
      .filter(msg => msg.parent_id === message.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(buildNode)

    return {
      id: message.id.toString(),
      message: message.content,
      sender: message.role === 'user' ? 'user' : 'assistant',
      children,
    }
  }

  return sortedRoots.map(buildNode)
}

/**
 * Utility function to validate and debug tree structure
 * Useful for development and troubleshooting
 */
export function debugMessageTree(messages: Message[]): void {
  console.log('=== Debug Message Tree ===')

  const roots = messages.filter(msg => msg.parent_id === null)
  console.log(
    `Found ${roots.length} root message(s):`,
    roots.map(r => r.id)
  )

  const childCounts = new Map<number, number>()
  messages.forEach(msg => {
    if (msg.parent_id !== null) {
      const count = childCounts.get(msg.parent_id) || 0
      childCounts.set(msg.parent_id, count + 1)
    }
  })

  console.log('Parent → Child counts:')
  Array.from(childCounts.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([parentId, count]) => {
      console.log(`  ${parentId} → ${count} children`)
    })

  // Check for orphaned messages
  const orphans = messages.filter(msg => msg.parent_id !== null && !messages.some(m => m.id === msg.parent_id))

  if (orphans.length > 0) {
    console.warn(
      '⚠️ Found orphaned messages:',
      orphans.map(o => o.id)
    )
  }

  // Display tree structure
  const tree = convertMessagesToHeimdall(messages)
  if (tree) {
    console.log('Tree structure:')
    logTreeStructure(tree, 0)
  }

  console.log('==========================')
}

/**
 * Helper function to log tree structure in a readable format
 */
function logTreeStructure(node: ChatNode, depth: number): void {
  const indent = '  '.repeat(depth)
  const truncatedMessage = node.message.slice(0, 50) + (node.message.length > 50 ? '...' : '')
  console.log(`${indent}├─ ${node.id} (${node.sender}): ${truncatedMessage}`)

  node.children.forEach(child => {
    logTreeStructure(child, depth + 1)
  })
}

/**
 * Utility to get tree statistics
 */
export function getMessageTreeStats(messages: Message[]): {
  totalMessages: number
  rootMessages: number
  maxDepth: number
  branchPoints: number
} {
  const roots = messages.filter(msg => msg.parent_id === null)

  let maxDepth = 0
  let branchPoints = 0

  const calculateDepth = (messageId: number, currentDepth: number = 0): number => {
    maxDepth = Math.max(maxDepth, currentDepth)

    const children = messages.filter(msg => msg.parent_id === messageId)

    if (children.length > 1) {
      branchPoints++
    }

    if (children.length === 0) {
      return currentDepth
    }

    return Math.max(...children.map(child => calculateDepth(child.id, currentDepth + 1)))
  }

  roots.forEach(root => calculateDepth(root.id))

  return {
    totalMessages: messages.length,
    rootMessages: roots.length,
    maxDepth,
    branchPoints,
  }
}

// server/src/utils/generationManager.ts
import { MessageId } from '../../../shared/types'

const controllers = new Map<MessageId, AbortController>()
const abortingGenerations = new Set<MessageId>()

export function createGeneration(messageId: MessageId) {
  console.log(`🔴 [generationManager] createGeneration called for messageId: ${messageId}`)
  const controller = new AbortController()
  controllers.set(messageId, controller)
  console.log(`🔴 [generationManager] Controller created and stored. Signal aborted: ${controller.signal.aborted}`)
  console.log(`🔴 [generationManager] Controllers map size after create: ${controllers.size}`)
  return { id: messageId, controller }
}

export function getController(messageId: MessageId): AbortController | undefined {
  return controllers.get(messageId)
}

export function getSignal(messageId: MessageId): AbortSignal | undefined {
  return controllers.get(messageId)?.signal
}

export function abortGeneration(messageId: MessageId): boolean {
  console.log(`🔴 [generationManager] abortGeneration called for messageId: ${messageId}`)
  console.log(`🔴 [generationManager] Current controllers map size: ${controllers.size}`)
  console.log(`🔴 [generationManager] Controllers map keys:`, Array.from(controllers.keys()))

  // Mark as aborting to prevent clearGeneration from removing it
  abortingGenerations.add(messageId)

  const c = controllers.get(messageId)
  if (!c) {
    console.log(`🔴 [generationManager] ❌ No controller found for message ${messageId}`)
    abortingGenerations.delete(messageId)
    return false
  }
  console.log(`🔴 [generationManager] ✓ Controller found, calling abort()`)
  console.log(`🔴 [generationManager] Signal aborted before abort(): ${c.signal.aborted}`)
  try {
    c.abort()
    console.log(`🔴 [generationManager] Signal aborted after abort(): ${c.signal.aborted}`)
  } finally {
    controllers.delete(messageId)
    abortingGenerations.delete(messageId)
    console.log(`🔴 [generationManager] Controller deleted from map`)
  }
  return true
}

export function clearGeneration(messageId: MessageId): void {
  // Don't clear if currently being aborted
  if (abortingGenerations.has(messageId)) {
    return
  }
  controllers.delete(messageId)
}

// server/src/utils/generationManager.ts
const controllers = new Map<number, AbortController>()
const abortingGenerations = new Set<number>()

export function createGeneration(messageId: number) {
  const controller = new AbortController()
  controllers.set(messageId, controller)
  return { id: messageId, controller }
}

export function getController(messageId: number): AbortController | undefined {
  return controllers.get(messageId)
}

export function getSignal(messageId: number): AbortSignal | undefined {
  return controllers.get(messageId)?.signal
}

export function abortGeneration(messageId: number): boolean {
  // Mark as aborting to prevent clearGeneration from removing it
  abortingGenerations.add(messageId)

  const c = controllers.get(messageId)
  if (!c) {
    console.log('No controller found for message', messageId)
    abortingGenerations.delete(messageId)
    return false
  }
  try {
    c.abort()
  } finally {
    controllers.delete(messageId)
    abortingGenerations.delete(messageId)
  }
  return true
}

export function clearGeneration(messageId: number): void {
  // Don't clear if currently being aborted
  if (abortingGenerations.has(messageId)) {
    return
  }
  controllers.delete(messageId)
}

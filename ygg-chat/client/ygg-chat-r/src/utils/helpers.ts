// Utility helper functions
import { MessageId } from '../../../../shared/types'

/**
 * Parse ID based on environment mode
 * - Local mode (SQLite): Converts to integer
 * - Web mode (Supabase): Keeps as string (UUID)
 *
 * @param id - The ID to parse (string or number)
 * @returns Parsed ID appropriate for the current environment
 */
export const parseId = (id: string | number): MessageId => {
  const environment = import.meta.env.VITE_ENVIRONMENT || 'local'

  if (environment === 'local') {
    // SQLite mode - convert to integer
    return typeof id === 'string' ? parseInt(id, 10) : id
  } else {
    // Supabase/Web mode - keep as string (UUID)
    return typeof id === 'string' ? id : String(id)
  }
}

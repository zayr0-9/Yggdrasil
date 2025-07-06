// server/src/test-db.ts
import { ConversationService, MessageService, UserService } from './database/models'

const user = UserService.create('testuser')
const conv = ConversationService.create(user.id, 'Test Chat')
MessageService.create(conv.id, 'user', 'Hello')
MessageService.create(conv.id, 'assistant', 'Hi there!')

console.log('Messages:', MessageService.getByConversation(conv.id))

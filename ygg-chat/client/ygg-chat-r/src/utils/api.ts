// import { ChatRequest, ChatResponse, ChatMessage } from '../../../shared/types';

// const API_BASE_URL =  'http://localhost:3001';
// //import.meta.env.VITE_API_URL ||
// export const chatApi = {
//   async sendMessage(request: ChatRequest): Promise<ChatResponse> {
//     const response = await fetch(`${API_BASE_URL}/api/chat`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(request)
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.error || 'Failed to send message');
//     }

//     return response.json();
//   },

//   async getChatHistory(chatId: string): Promise<ChatMessage[]> {
//     const response = await fetch(`${API_BASE_URL}/api/chat/${chatId}`);
    
//     if (!response.ok) {
//       throw new Error('Failed to load chat history');
//     }

//     return response.json();
//   }
// };
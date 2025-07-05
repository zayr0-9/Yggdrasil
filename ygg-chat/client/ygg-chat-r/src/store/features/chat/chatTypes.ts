export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  // For streaming responses, we might have partial messages
  isComplete: boolean;
  error?: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  // Track streaming state separately from loading
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
  // For Ollama, we might want to track the current model
  currentModel: string;
}

// Define the shape of data we send to Ollama
export interface SendMessagePayload {
  content: string;
  model?: string;
  temperature?: number;
}

// Define what we get back from streaming
export interface StreamToken {
  token: string;
  messageId: string;
  isComplete: boolean;
}
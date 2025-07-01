import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, Message, StreamToken } from './chatTypes';

// Define our initial state - the starting point
const initialState: ChatState = {
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingMessageId: null,
  error: null,
  currentModel: 'llama2', // Default model
};

// Create the slice - this is where the magic happens
const chatSlice = createSlice({
  name: 'chat', // This prefixes all our action types
  initialState,
  reducers: {
    // Each reducer is a pure function that updates state
    // Redux Toolkit uses Immer, so we can "mutate" state safely
    
    addMessage: (state, action: PayloadAction<Message>) => {
      // Simply push the new message - Immer makes this immutable behind the scenes
      state.messages.push(action.payload);
      state.error = null; // Clear any previous errors
    },
    
    startStreaming: (state, action: PayloadAction<string>) => {
      state.isStreaming = true;
      state.streamingMessageId = action.payload;
      state.error = null;
    },
    
    appendToMessage: (state, action: PayloadAction<StreamToken>) => {
      // Find the message we're streaming to and append the token
      const message = state.messages.find(m => m.id === action.payload.messageId);
      if (message) {
        message.content += action.payload.token;
        message.isComplete = action.payload.isComplete;
      }
    },
    
    stopStreaming: (state) => {
      state.isStreaming = false;
      state.streamingMessageId = null;
    },
    
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.isStreaming = false;
    },
    
    clearChat: (state) => {
      // Reset to initial state, but keep the current model
      return { ...initialState, currentModel: state.currentModel };
    },
    
    setModel: (state, action: PayloadAction<string>) => {
      state.currentModel = action.payload;
    },
  },
});

// Export the auto-generated action creators
export const {
  addMessage,
  startStreaming,
  appendToMessage,
  stopStreaming,
  setError,
  clearChat,
  setModel,
} = chatSlice.actions;

// Export the reducer to be included in the store
export default chatSlice.reducer;

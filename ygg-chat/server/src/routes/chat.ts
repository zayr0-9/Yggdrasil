import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { ChatRequest, ChatResponse } from '../../../shared/types';
import { callOllama } from '../utils/ollama';
import { asyncHandler } from '../utils/asyncHandler';
import {Message} from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const maxMsgLen: number = 4000; //use a user set variable later
const msgContextLimit: number = 20; // Limit context to prevent token overflow. user set
// Validation schema
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(maxMsgLen),
  chatId: z.string().uuid().optional(),
  model: z.string().optional()
});

// Send message endpoint
router.post('/', asyncHandler(async (req, res) => {
  const validatedData = ChatRequestSchema.parse(req.body);
  
  // Create or get existing chat session
  let chatSession;
  //check if request has chatId
  if (validatedData.chatId) {
    //check if chat session exists on the database
    chatSession = await prisma.chatSession.findUnique({
      where: { id: validatedData.chatId }
    });
  }

  // If chat session does not exist, create a new one
  if (!chatSession) {
    chatSession = await prisma.chatSession.create({
      data: {
        // title is the first 50 characters of the message
        title: validatedData.message.substring(0, 50) + '...',
      }
    });
  }

  // Save user message by creating a new message record
  const userMessage = await prisma.message.create({
    data: {
      role: 'user',
      content: validatedData.message,
      chatSessionId: chatSession.id
    }
  });

  // Get conversation history for context
  const previousMessages = await prisma.message.findMany({
    where: { chatSessionId: chatSession.id },
    orderBy: { createdAt: 'asc' },
    take: msgContextLimit // Limit context to prevent token overflow
  });


  // Call Ollama API
  const assistantResponse = await callOllama(
    previousMessages.map((msg: Message) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    validatedData.model || process.env.OLLAMA_DEFAULT_MODEL
  );

  // Save assistant response
  const assistantMessage = await prisma.message.create({
    data: {
      role: 'assistant',
      content: assistantResponse,
      chatSessionId: chatSession.id
    }
  });

  // Update chat session but only two fields: updatedAt and messageCount
  await prisma.chatSession.update({
    where: { id: chatSession.id },
    data: { 
      updatedAt: new Date(),
      messageCount: { increment: 2 }
    }
  });

  
  const response: ChatResponse = {
    message: {
      id: assistantMessage.id,
      role: 'assistant',
      content: assistantResponse,
      timestamp: assistantMessage.createdAt,
      chatId: chatSession.id
    },
    chatId: chatSession.id
  };

  res.json(response);
}));

// Get chat history endpoint
router.get('/:chatId', asyncHandler(async (req, res) => {
  const chatId = req.params.chatId;
  //find chat session by id
  const messages = await prisma.message.findMany({
    where: { chatSessionId: chatId },
    orderBy: { createdAt: 'asc' }
  });
  //return chat messages
  res.json(messages);
}));

export { router as chatRouter };
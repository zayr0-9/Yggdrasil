interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export async function callOllama(
  messages: OllamaMessage[], 
  model?: string
): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const defaultModel = model || process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2:3b';

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: defaultModel,
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    // FIX: Type assertion for unknown response
    const data = await response.json() as OllamaResponse;
    
    // Additional validation for runtime safety
    if (!data.message?.content) {
      throw new Error('Invalid response format from Ollama API');
    }
    
    return data.message.content;
  } catch (error) {
    console.error('Ollama API call failed:', error);
    throw new Error('Failed to get response from Ollama');
  }
}
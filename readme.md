# Ollama Chat

A simple LLM chat frontend using Node.js, Express, React, and Ollama.

## Features

- **Express API proxy** to a local Ollama server (runs at `localhost:11434`).
- **TypeScript-only** codebase across server and client.
- **React + Redux Toolkit** for state management.
- **Tailwind CSS** for utility-first styling.
- **Local persistence** via IndexedDB (Dexie) or optional SQLite + Prisma.
- Ready for streaming responses, authentication, and multi-chat sessions.

## Prerequisites

- Node.js
- npm or pnpm
- Ollama installed and running locally
- (Optional) SQLite for server-side persistence

## Project Structure

```
ollama-chat/
├── server/       # Node.js + Express API proxy and database models
├── web/          # React client (Vite, Redux, Tailwind)
└── package.json  # Monorepo root (npm workspaces or pnpm)
```

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd ollama-chat
```

### 2. Start Ollama

In a separate terminal:

```bash
ollama serve
```

### 3. Setup and run the server

```bash
cd server
npm install
cp .env.example .env
# Edit .env if you need to change OLLAMA_MODEL (default: llama3.2)
npm run dev
```

The server will listen on `http://localhost:3000/api/chat`.

### 4. Setup and run the client

```bash
cd web
npm install
npm run dev
```

Open your browser to `http://localhost:5173` to access the chat UI.

## Usage

1. Type a message in the input bar.
2. Press **Send**.
3. The message is sent to the Express proxy, which forwards it to Ollama.
4. The assistant's reply appears in the chat list.

## Scripts

At the monorepo root, you can define in `package.json`:

```json
"scripts": {
  "dev:server": "npm --workspace server run dev",
  "dev:web": "npm --workspace web run dev"
}
```

## Environment Variables

- `OLLAMA_MODEL`: (default: `llama3.2`) The name of the model to use in Ollama.

## Next Steps

- **Streaming**: Enable server-sent events for streaming tokens.
- **Authentication**: Add JWT-based auth in the proxy and secure cookies.
- **Multi-chat**: Expand the database schema to support multiple chat sessions.
- **Mobile**: Port the client to React Native or Expo with React Navigation.

## License

MIT

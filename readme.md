# Yggdrasil

Yggdrasil is a custom LLM front end/ database etc
I started this project as I was frustrated with every LLM chat front end having basically the same UI.

Humans don't think linearly like in a chat, we go off tangents, we have side conversations, we have different thoughts and ideas while working on one overarching goal. Yggdrasil aims to actualise this by allowing the user to branch their conversation and navigate through it.

To achieve this, Yggdrasil tracks the whole conversation in a tree structure and allows the user to navigate through it.

I believe our conversations with any LLM contain how we think and how we reason as well. Yggdrasil allows the user to visualise their own mind map, of how they apporach any topic.

There is no proper history or documentation of AI generated code, without AI the programmer who made the changes preserved some history of the changes they made, now it gets chucked away in some chat. I feel as we depend more on AI generated code, it is important that we have some way to log and easily access AI usage history.

Yggdrasil is also really good as a learning tool as it helps encapsulate different topics into their own isolated branch, avoiding context pollution both for the LLM
and visual pollution for the user.

Our conversation, back and forth with AI systems is valuable data currently being wasted.
The goal of Yggdrasil is to help the user better visualise and manage their conversation data.

## Features

- **Heimdall conversation tree**: branch, visualize, and navigate non-linear chat trees.
- **Attachments**: image uploads via base64 or multipart; served from `/uploads` and rendered inline.
- **Custom prompts**: set a system prompt and conversation context for each conversation.
- **Custom context**: set a conversation context for each conversation.
- **Search**: search across user messages, auto scroll to searched message.
- **Providers**: local Ollama plus cloud providers (OpenAI, Google Gemini, Anthropic, OpenRouter) via server endpoints.
- **Local persistence**: conversations/messages stored in a local SQLite DB; search across user messages.

## Prerequisites

- Node.js 18+
- npm
- Ollama installed and running locally (for local models) at `http://localhost:11434`
- Optional: API keys if you want to use cloud providers (OpenAI, Google Gemini, Anthropic, OpenRouter)

## Project Structure

```
Yggdrasil/
└── ygg-chat/
    ├── client/
    │   └── ygg-chat-r/   # React client (Vite, Redux Toolkit, Tailwind, TypeScript)
    ├── server/           # Node.js + Express API + SQLite persistence
    │   └── src/
    └── shared/           # Shared assets/config (e.g., providers.json)
```

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd Yggdrasil/ygg-chat
```

### 2. Install dependencies (monorepo workspaces)

```bash
npm install
# Optionally, install per workspace if needed
# (from repo root) cd client/ygg-chat-r && npm install
# (from repo root) cd server && npm install
```

### 3. Run the server and client in concurrent mode (port 3001 and 5173)

```bash
npm run dev
```

Server base URL: `http://localhost:3001/api`

####Open your browser to `http://localhost:5173` to access the chat UI.

## Usage

1. Type a message in the input bar.
2. Press **Send**.
3. The request streams via SSE from the server. Click **Stop** to abort generation.
4. Use the Heimdall tree to branch, select nodes, and navigate conversation paths.
5. Optionally attach images to user messages; they’ll appear inline.

## Scripts

At `ygg-chat/package.json`:

```json
"scripts": {
  "dev:client": "cd client/ygg-chat-r && npm run dev",
  "dev:server": "cd server && npm run dev",
  "build": "npm run build:client && npm run build:server",
  "build:client": "cd client/ygg-chat-r && npm run build",
  "build:server": "cd server && npm run build",
  "dev": "concurrently -n server,client -c yellow,cyan \"npm --prefix server run dev\" \"npm --prefix client/ygg-chat-r run dev\"",
}
```

Tip: you can run dev and client in different terminals using `npm run dev:client` and `npm run dev:server`

## API Overview (key endpoints)

Base path: `http://localhost:3001/api`

- **Models**

  - `GET /api/models` — list local Ollama models (via `modelService`).
  - `GET /api/models/openai` — list OpenAI models (requires `OPENAI_API_KEY`).
  - `GET /api/models/openrouter` — list OpenRouter models (requires `OPENROUTER_API_KEY`).
  - `GET /api/models/anthropic` — list Anthropic models (requires `ANTHROPIC_API_KEY`).
  - `GET /api/models/gemini` — list Google Gemini models (requires `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`).

- **Chat streaming** (`server/src/routes/chat.ts`)

  - `POST /api/conversations/:id/messages` — stream assistant response via SSE.
  - `POST /api/conversations/:id/messages/repeat` — run N repeats and stream each.
  - `POST /api/messages/:id/abort` — abort in-flight generation by user messageId.

- **Conversations & messages**

  - `POST /api/conversations` — create conversation.
  - `GET /api/conversations/:id/messages` — list messages.
  - `GET /api/conversations/:id/messages/tree` — Heimdall tree data.
  - `PATCH /api/conversations/:id` — update title.
  - `PATCH /api/conversations/:id/system-prompt` — set/clear system prompt.
  - `PATCH /api/conversations/:id/context` — set conversation context.

- **Attachments**

  - `POST /api/attachments` — upload file (multipart field `file`) or create metadata-only record.
  - `GET /api/attachments/:id` — fetch metadata.
  - `GET|POST|DELETE /api/messages/:id/attachments` — list, link, or delete all for a message.
  - `DELETE /api/messages/:id/attachments/:attachmentId` — unlink one attachment.
  - Files are served from `GET /uploads/...`.

- **Settings**
  - `GET /api/settings/env` — read server `.env` as JSON.
  - `PUT /api/settings/env` — write server `.env` from JSON body.

## Environment Variables

- `OPENAI_API_KEY` — required for OpenAI model listing/usage
- `OPENROUTER_API_KEY` — required for OpenRouter model listing/usage
- `ANTHROPIC_API_KEY` — required for Anthropic model listing/usage
- `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` — required for Gemini model listing/usage
- Ollama is expected at `http://localhost:11434` (no key required)

## Roadmap

- **Model settings**: more model settings through api request.
- **Export**: export conversations/trees with attachments.
- **Attachments**: more attachment types.
- **Fuzzy search**
-
- **Mobile**: potential React Native/Expo client.

## License

This project is licensed under the Business Source License 1.1. See [license.md](license.md) for details.

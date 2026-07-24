# Pointing Poker

A real-time web application for agile story pointing sessions. Users can join a session, select their estimate, and see all votes once everyone has submitted.

## Features

- Real-time synchronization via WebSockets
- Session-based voting rooms
- Automatic results reveal when all users have voted
- Simple card UI using CSS (no custom graphics)
- Reset capability for new rounds
- Responsive design for mobile and desktop

## Card Values

The application uses the following card values: 0.5, 1, 2, 3, 4, 5, 6, 7, 8

## Development

### Prerequisites

- Node.js 20 or higher
- npm

### Setup

1. Install backend dependencies:
```bash
cd server
npm install
```

2. Install frontend dependencies:
```bash
cd ../client
npm install
```

### Running Locally

1. Start the backend server:
```bash
cd server
npm start
# or for development with auto-reload:
npm run dev
```

2. In a separate terminal, start the frontend dev server:
```bash
cd client
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Optional: Gemini Session Backgrounds

If you want AI-generated background images per session:

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Set the key for the backend process:
```bash
cd server
export GEMINI_API_KEY="your_api_key_here"
npm run dev
```

You can also place `GEMINI_API_KEY=...` in the project root `.env`; the server auto-loads that file on startup.

The server caches generated session background images on disk:
- Local default: `server/.cache/session-backgrounds`
- Override path with `SESSION_BACKGROUND_CACHE_DIR=/custom/path`
- Files are named from the session name (for example `Superman_s_Den.bin`) and keep character/place metadata
- Images are retained after sessions end and reused as an archive fallback when Gemini/Hugging Face fail or return no image (match character and place, then either, otherwise a random saved image)

Optional: if you need to force a specific Gemini model, set:
```bash
export GEMINI_IMAGE_MODEL="gemini-2.5-flash-image-preview"
```
3. In another terminal, run the frontend:
```bash
cd client
npm run dev
```

The frontend never sees this key. It only calls the backend endpoint (`POST /api/session-background`), and the backend calls Gemini.

### Optional: Hugging Face Fallback (or primary)

You can also use Hugging Face for image generation. The backend will try providers in this order:

1. Gemini (`GEMINI_API_KEY`) if configured
2. Hugging Face (`HUGGING_FACE_API_KEY`) as fallback
3. Saved session-background archive on disk (character/place match, then random)

If you only set `HUGGING_FACE_API_KEY`, Hugging Face becomes the primary provider.

Add to root `.env`:
```bash
HUGGING_FACE_API_KEY="your_hugging_face_api_key"
# optional model override
HUGGING_FACE_IMAGE_MODEL="stabilityai/stable-diffusion-xl-base-1.0"
# optional provider override (default: auto)
HUGGING_FACE_PROVIDER="auto"
```

Provider notes:
- `HUGGING_FACE_PROVIDER="auto"` lets Hugging Face route to a compatible provider.
- You can pin a provider such as `fal-ai` when a model requires it.

Quick verification from your shell:
```bash
curl -X POST http://localhost:3000/api/session-background \
  -H "Content-Type: application/json" \
  -d '{"sessionName":"Gandalf'\''s Tower"}' \
  --output session-bg.png
```

If successful, `session-bg.png` should be an image file.

## Deployment to Fly.io

1. Install the Fly CLI if you haven't already:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Login to Fly.io:
```bash
fly auth login
```

3. Deploy:
```bash
fly deploy
```

4. Set Gemini API key in Fly secrets (server-side only):
```bash
fly secrets set GEMINI_API_KEY="your_api_key_here"
```

Optional Hugging Face secret:
```bash
fly secrets set HUGGING_FACE_API_KEY="your_hugging_face_api_key"
```

5. Create and attach a Fly volume for image cache persistence:
```bash
fly volumes create session_backgrounds --region iad --size 1
```

`fly.toml` mounts this volume at `/data` and the app writes retained cache/archive files to `/data/session-backgrounds`.

The application will be available at `https://pointing-poker.fly.dev` (or your configured app name).

## Project Structure

```
pointing-poker/
├── server/          # Node.js/Express backend
│   ├── server.js
│   ├── sessionManager.js
│   └── socketHandlers.js
├── client/          # Vue.js frontend
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── config/
│   └── dist/        # Built frontend (generated)
├── Dockerfile       # Multi-stage build for production
└── fly.toml         # Fly.io configuration
```

## How to Use

1. Open the application in your browser
2. (Optional) Select an existing active session from the dropdown, or leave "Start new Session" selected to create a new one
3. If creating a new session, a random session name will be automatically generated (e.g., "Superman's Den", "Gandalf's Tower")
4. You can click the refresh button (🔄) to generate a different random session name
5. Enter your name
6. Click "Join Session"
7. Select your estimate card
8. Submit your vote
9. Wait for all participants to vote
10. View all results once everyone has voted
11. Click "New Round" to start a new voting round


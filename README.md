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


# BUZZ! Quiz Game Show

A full-featured quiz game show application with PlayStation 2 Buzz controller support. Create teams with fun names, manage questions across 8 different round types, and let players buzz in using authentic Buzz controllers!

## Features

### Game Show Experience
- **8 Unique Round Types**: Each with distinct scoring rules and mechanics
- **Fun Team Names**: Auto-generated silly team names like "Quiz Khalifa" and "Beyonce Know-les"
- **Sound Effects**: Buzzer sounds, correct/wrong feedback, dramatic reveals
- **Polished UI**: Game show-style animations and visual effects
- **Real-time Gameplay**: WebSocket-based live updates

### Round Types

| Round | Description | Points |
|-------|-------------|--------|
| **Fastest Finger** | Race to buzz first! Wrong answers penalized | +500 / -250 |
| **Multiple Choice** | Everyone answers simultaneously. Faster = more points | +500 (fast) / +300 (slow) |
| **True or False** | Quick decisions with risk! Wrong answers hurt | +250 / -250 |
| **Picture/Sound** | Identify images, sounds, or clips | +500 (fast) / +250 (slow) |
| **Point Heist** | Steal points from rivals on correct answer | Steal 750 / Lose 500 |
| **Hot Potato** | Pass the bomb - don't hold it when it explodes! | +250 / -500 (explosion) |
| **The Ladder** | Climb for big points, but bank before you fall! | 250 → 8000 |
| **Final Showdown** | All or nothing! High stakes finale | +5000 / -5000 |

### Buzz Controller Support
- Works with PS2 Buzz controllers (4 players)
- LED light control for each player's buzzer
- Red button to buzz in, colored buttons to answer

### Data Persistence
- MongoDB integration for saving games
- Question banks for reusable content
- Works without MongoDB (in-memory mode)

## Prerequisites

- Node.js 18+
- npm or yarn
- MongoDB (optional, for persistence)
- PS2 Buzz Controllers (optional, but recommended!)

## Installation

```bash
# Navigate to the project
cd Buzz

# Install all dependencies
npm install

# Start both backend and frontend
npm run dev
```

The backend runs on http://localhost:3001
The frontend runs on http://localhost:5173

## Buzz Controller Setup (Windows)

1. Connect your PS2 Buzz controllers via USB
2. Open **Device Manager**
3. Find the Buzz controller under "Human Interface Devices"
4. Right-click → **Update Driver**
5. Choose "Browse my computer for drivers"
6. Select "Let me pick from available drivers"
7. Choose **"USB Input Device"** (not HID-compliant device)
8. Controller appears as "Logitech Buzz(tm) Controller V1"

### Button Layout

```
Player 1: Buttons 1-5   (Red, Yellow, Green, Orange, Blue)
Player 2: Buttons 6-10
Player 3: Buttons 11-15
Player 4: Buttons 16-20
```

### LED Control

Red button LEDs controlled via HID reports:
- Format: `[0x00, 0x00, P1, P2, P3, P4, 0x00, 0x00]`
- Use `0xFF` for on, `0x00` for off

## How to Play

### Setup
1. Open http://localhost:5173
2. Click **"New Game"** and enter a game name
3. **Add Teams**: Assign fun names and player controllers
4. **Configure Rounds**: Select which round types to include
5. **Add Questions**: For each round, add appropriate questions

### During the Game
1. Display the **Game Screen** (`/game`) on a TV/projector
2. Host uses **Host Controls** (`/host`) on a separate device
3. Host starts rounds and questions
4. Players buzz in with the **RED button**
5. Players answer with **colored buttons** (Blue, Orange, Green, Yellow)
6. Host reveals answers and moves to next question

### Scoring
- Points vary by round type (see table above)
- Speed bonuses in some rounds
- Ladder round has banking mechanic
- Steal round allows taking opponent points

## Project Structure

```
Buzz/
├── backend/
│   └── src/
│       ├── index.ts           # Express + Socket.IO server
│       ├── buzz-controller.ts # HID controller interface
│       ├── game-engine.ts     # Game logic and state
│       ├── models/            # MongoDB schemas
│       └── types.ts           # TypeScript interfaces
├── frontend/
│   └── src/
│       ├── App.tsx            # Main app with routing
│       ├── pages/             # Page components
│       │   ├── HomePage.tsx   # Landing page
│       │   ├── SetupPage.tsx  # Game configuration
│       │   ├── GamePage.tsx   # Main game display
│       │   └── HostPage.tsx   # Host controls
│       ├── components/        # Reusable UI components
│       ├── hooks/             # Custom React hooks
│       │   └── useSounds.ts   # Sound effect system
│       └── store/             # Zustand state management
└── package.json               # Workspace root
```

## API Reference

### WebSocket Events

**Game Management:**
- `createGame(name)` - Create new game
- `joinGame(gameId)` - Join existing game
- `startGame()` - Begin the game

**Round Control:**
- `startRound(roundIndex)` - Start a specific round
- `startQuestion()` - Show next question
- `revealAnswer()` - Show correct answer
- `nextQuestion()` - Advance to next question
- `endRound()` - Complete current round

**Team/Question:**
- `addTeam(team)` - Add a team
- `addQuestion(roundId, question)` - Add question to round
- `adjustScore(teamId, points)` - Manual score adjustment

**Controller:**
- `testLights()` - Test LED sequence
- `setLights([p1, p2, p3, p4])` - Control individual LEDs
- `resetBuzz()` - Clear buzz state

### REST Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server status and controller connection |
| `GET /api/devices` | List HID devices |
| `GET /api/games` | List active games |
| `GET /api/games/:id` | Get specific game state |
| `GET /api/saved-games` | List MongoDB saved games |

## Environment Variables

```bash
PORT=3001              # Backend port
MONGODB_URI=mongodb://localhost:27017/buzzgame  # MongoDB connection
```

## Troubleshooting

### Controller Not Detected
1. Verify driver is set to "USB Input Device" in Device Manager
2. Check backend console for HID device listings
3. Try unplugging and reconnecting
4. On Linux, add udev rules for HID access

### LEDs Not Working
- Windows: Should work automatically
- Linux: May need `sudo` or udev rules
- Check backend console for HID write errors

### Connection Issues
- Ensure both servers are running (3001 and 5173)
- Check browser console for WebSocket errors
- Verify CORS settings if using different hosts

### MongoDB Not Required
The game works without MongoDB in memory-only mode. Games won't persist between server restarts.

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO, node-hid
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **State**: Zustand (frontend), MongoDB (backend, optional)
- **Build**: npm workspaces

## License

MIT

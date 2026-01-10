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

## Importing Questions (CSV Format)

Questions can be imported via CSV file. The format is:

```
Game Mode,Question,Correct Answer,Wrong Answer 1,Wrong Answer 2,Wrong Answer 3
```

### Round Type Tags

Use these tags in the "Game Mode" column:

| Tag | Round Type | Notes |
|-----|------------|-------|
| `multiple-choice` | Multiple Choice Mayhem | Standard 4-option questions |
| `true-false` | True or False Frenzy | Only needs 2 answers (True/False) |
| `fastest-finger` | Fastest Finger | Buzz-in round, 4 options |
| `picture-sound` | Picture This! | Can use filename for media |
| `speed-race` | Speed Race | Race to answer, position-based scoring |
| `steal-points` or `point heist` | Point Heist | Steal points from rivals |
| `hot-potato` | Hot Potato | Pass the bomb round |
| `ladder` | The Ladder | Climb and bank points |
| `final` | Final Showdown | High-stakes finale |

**Alternative formats accepted:** Tags can use hyphens, spaces, or be joined (e.g., `multiple-choice`, `multiple choice`, `multiplechoice` all work).

### Example CSV

```csv
Game Mode,Question,Correct Answer,Wrong Answer 1,Wrong Answer 2,Wrong Answer 3
multiple-choice,What is the capital of France?,Paris,London,Berlin,Madrid
multiple-choice,Which planet is closest to the Sun?,Mercury,Venus,Earth,Mars
true-false,The Earth is flat.,False,True,,
true-false,Water boils at 100 degrees Celsius.,True,False,,
fastest-finger,What is 2 + 2?,4,3,5,6
hot-potato,What color is the sky?,Blue,Green,Red,Yellow
steal-points,Who wrote Romeo and Juliet?,Shakespeare,Dickens,Austen,Hemingway
speed-race,What is the largest ocean?,Pacific,Atlantic,Indian,Arctic
```

### Picture/Sound Round Media

For `picture-sound` rounds, you can use a filename instead of a question:

```csv
picture-sound,mystery_image.webp,Eiffel Tower,Big Ben,Statue of Liberty,Colosseum
picture-sound,sound_clip.mp3,Dog Barking,Cat Meowing,Bird Chirping,Lion Roaring
```

- Media files should be placed in the `/media/` folder
- Supported image formats: jpg, jpeg, png, gif, webp, svg, bmp
- Supported audio formats: mp3, wav, ogg, m4a, aac, flac
- Supported video formats: mp4, webm, mov, avi, mkv
- The question text will auto-set to "What is this?"

### Import/Export

1. **Download Sample CSV**: Click "Sample CSV" button to get a template
2. **Import CSV**: Click "Import CSV" and select your file
3. **Export CSV**: Click "Export CSV" to download all current questions

Questions are automatically matched to rounds by their game mode tag. If a round type doesn't exist in your game, those questions will be skipped.

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

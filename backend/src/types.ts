// ============================================
// BUZZ! GAME SHOW - TYPE DEFINITIONS
// ============================================

export type RoundType =
  | 'fastest-finger'      // Speed buzz round
  | 'multiple-choice'     // All answer simultaneously
  | 'true-false'          // Binary choice
  | 'picture-sound'       // Media identification
  | 'steal-points'        // Competitive stealing
  | 'hot-potato'          // Bomb passing
  | 'ladder'              // Risk/reward banking
  | 'final';              // High-stakes finale

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Choice {
  id: string;
  text: string;
  color: 'blue' | 'orange' | 'green' | 'yellow';
  isCorrect: boolean;
}

export interface Question {
  id: string;
  text: string;
  choices: Choice[];
  category?: string;
  difficulty?: Difficulty;
  mediaUrl?: string;        // For picture/sound rounds
  mediaType?: 'image' | 'audio' | 'video';
  timeLimit?: number;       // Override round default
  roundType?: RoundType;    // Optional: question-specific round type
}

// Available buzzer sounds for players
export type BuzzerSound =
  | 'buzz'        // Default buzzer
  | 'bark'        // Dog bark
  | 'horn'        // Car horn
  | 'bell'        // Bell ding
  | 'whistle'     // Whistle
  | 'airhorn'     // Air horn
  | 'quack'       // Duck quack
  | 'boing'       // Boing spring
  | 'laser'       // Laser zap
  | 'pop';        // Pop sound

export const BUZZER_SOUNDS: { id: BuzzerSound; name: string; emoji: string }[] = [
  { id: 'buzz', name: 'Classic Buzz', emoji: '🔔' },
  { id: 'bark', name: 'Dog Bark', emoji: '🐕' },
  { id: 'horn', name: 'Car Horn', emoji: '🚗' },
  { id: 'bell', name: 'Bell', emoji: '🛎️' },
  { id: 'whistle', name: 'Whistle', emoji: '📯' },
  { id: 'airhorn', name: 'Air Horn', emoji: '📢' },
  { id: 'quack', name: 'Duck Quack', emoji: '🦆' },
  { id: 'boing', name: 'Boing', emoji: '🎾' },
  { id: 'laser', name: 'Laser', emoji: '⚡' },
  { id: 'pop', name: 'Pop', emoji: '💥' },
];

export interface Player {
  id: string;
  name: string;
  controllerIndex: 1 | 2 | 3 | 4;
  avatar?: string;
  color?: string;
  buzzerSound?: BuzzerSound;  // Custom buzzer sound for this player
}

export interface Team {
  id: string;
  name: string;
  color: string;
  players: Player[];
  score: number;
  funName?: string;         // Fun/silly team name
}

// Round configuration
export interface RoundConfig {
  type: RoundType;
  name: string;
  description: string;
  questionCount: number;
  timePerQuestion: number;
  pointsCorrect: number;
  pointsWrong: number;
  pointsFast?: number;      // Bonus for fast answers
  pointsSlow?: number;      // Reduced points for slow answers
  allowSteal?: boolean;
  ladderValues?: number[];  // For ladder round
}

export interface Round {
  id: string;
  config: RoundConfig;
  questions: Question[];
  currentQuestionIndex: number;
  status: 'pending' | 'active' | 'completed';
  startTime?: number;
  scoresAtStart?: { teamId: string; score: number }[];  // Saved scores for retry
}

// Player answer tracking
export interface PlayerAnswer {
  playerId: string;
  teamId: string;
  choiceId: string;
  timestamp: number;
  responseTime: number;
  isCorrect: boolean;
  pointsEarned: number;
}

// Buzz event
export interface BuzzEvent {
  playerId: string;
  teamId: string;
  controllerIndex: number;
  timestamp: number;
  isFirst: boolean;
}

// Ladder round state
export interface LadderState {
  playerId: string;
  currentStep: number;
  unbankedPoints: number;
  bankedPoints: number;
}

// Hot Potato question history entry
export interface HotPotatoQuestionEntry {
  questionText: string;
  correctAnswer: string;
  playerAnswer: string | null;  // null if no answer given
  wasCorrect: boolean | null;   // null if no answer
  playerName: string;
  teamColor: string;
}

// Hot Potato state
export interface HotPotatoState {
  phase: 'playing' | 'passing' | 'exploded';  // playing = answering, passing = selecting target, exploded = bomb went off
  currentHolderId: string;       // Player currently holding the bomb
  currentHolderTeamId: string;   // Team of current holder
  bombTimeLeft: number;          // Seconds remaining on bomb timer
  bombTotalTime: number;         // Total bomb time for this round
  lastCorrectAnswerId?: string;  // Player who just answered correctly (selects next holder)
  questionHistory: HotPotatoQuestionEntry[];  // Track all questions answered in this bomb cycle
}

// Fastest Finger state - turn-based buzzer system
export interface FastestFingerState {
  phase: 'buzzing' | 'answering';  // 'buzzing' = waiting for all teams, 'answering' = turn-based answers
  currentTurnIndex: number;       // Index into buzzedPlayers array
  answerTimeLeft: number;         // Countdown for current player to answer
  answerTimeLimit: number;        // Seconds allowed to answer (e.g., 10)
  eliminatedPlayers: string[];    // Player IDs who have been eliminated (wrong or timeout)
  teamsNotBuzzed: string[];       // Team IDs that haven't buzzed yet
}

// Steal Points (Point Heist) state - first to buzz answers, correct answer steals points
export interface StealPointsState {
  phase: 'buzzing' | 'answering' | 'announcing' | 'stealing';  // buzzing = waiting for first buzz, answering = buzzer answers, announcing = showing who will steal, stealing = selecting victim
  buzzerPlayerId?: string;        // Player who buzzed in
  buzzerTeamId?: string;          // Team of the player who buzzed in
  buzzerControllerIndex?: number; // Controller index of buzzer (1-4)
  stealAmount: number;            // Fixed at 500 points
}

// Main game state
export interface GameState {
  id: string;
  name: string;
  status: 'lobby' | 'setup' | 'playing' | 'paused' | 'finished';
  teams: Team[];
  rounds: Round[];
  currentRoundIndex: number;
  settings: GameSettings;

  // Current round state
  currentQuestion: Question | null;
  buzzedPlayers: BuzzEvent[];
  playerAnswers: PlayerAnswer[];
  answerRevealed: boolean;
  questionStartTime: number | null;
  timerExpired: boolean;  // True when question timer runs out (blocks new answers)

  // Special round states
  ladderState?: LadderState;
  hotPotatoState?: HotPotatoState;
  fastestFingerState?: FastestFingerState;
  stealPointsState?: StealPointsState;
  stealTarget?: string;     // Team ID being stolen from (legacy, kept for compatibility)

  // History
  roundResults: RoundResult[];
}

export interface RoundResult {
  roundId: string;
  roundType: RoundType;
  teamScores: { teamId: string; pointsEarned: number }[];
  mvp?: { playerId: string; pointsEarned: number };
}

export interface GameSettings {
  maxPlayers: number;
  defaultTimeLimit: number;
  buzzLockoutMs: number;
  showLeaderboardBetweenRounds: boolean;
  playBuzzerSounds: boolean;
  playSoundEffects: boolean;
  allowLateBuzz: boolean;
  // Auto-advance settings for smoother game flow
  autoRevealAnswer: boolean;        // Auto-reveal after all answers or timeout (5s delay)
  autoRevealDelayMs: number;        // Delay before auto-reveal (default 5000)
  autoShowPoints: boolean;          // Auto-show points animation after reveal (3s delay)
  autoShowPointsDelayMs: number;    // Delay before showing points (default 3000)
  autoNextQuestion: boolean;        // Auto-advance to next question
  autoNextDelayMs: number;          // Delay before next question (default 3000)
}

// Fixed team colors matching controller buttons (max 4 teams)
export const TEAM_COLORS = [
  { id: 'blue', name: 'Blue', hex: '#1e88e5', controllerIndex: 1 },
  { id: 'orange', name: 'Orange', hex: '#fb8c00', controllerIndex: 2 },
  { id: 'green', name: 'Green', hex: '#43a047', controllerIndex: 3 },
  { id: 'yellow', name: 'Yellow', hex: '#fdd835', controllerIndex: 4 },
] as const;

export type TeamColorId = 'blue' | 'orange' | 'green' | 'yellow';

// Maximum players (teams) per game
export const MAX_TEAMS = 4;

// Fun team name suggestions
export const FUN_TEAM_NAMES = [
  "The Quiz Wizards",
  "Brain Busters",
  "Smarty Pants",
  "The Know-It-Alls",
  "Quiz Khalifa",
  "Agatha Quiztie",
  "Quizteama Aguilera",
  "Les Quizerables",
  "The Fact Checkers",
  "Trivia Newton John",
  "Let's Get Quizzical",
  "I Thought This Was Jeopardy",
  "Quizness As Usual",
  "The Big Bang Theories",
  "Ctrl+Alt+Defeat",
  "404 Answer Not Found",
  "E=MC Hammer",
  "Cirque du So-Lame",
  "The Fact-astic Four",
  "Beyoncé Know-les"
];

// Default round configurations with optimized time limits
export const DEFAULT_ROUNDS: RoundConfig[] = [
  {
    type: 'fastest-finger',
    name: 'Fastest Finger',
    description: 'Race to buzz first! Correct answer = points, wrong = penalty!',
    questionCount: 5,
    timePerQuestion: 5,   // 5s total buzz window
    pointsCorrect: 500,
    pointsWrong: -250
  },
  {
    type: 'multiple-choice',
    name: 'Multiple Choice Mayhem',
    description: 'Everyone answers! Faster = more points!',
    questionCount: 8,
    timePerQuestion: 7,   // 6-8s for fast thinking
    pointsCorrect: 150,   // Base points (after 4s)
    pointsWrong: 0,
    pointsFast: 500,      // 0-2s = +500
    pointsSlow: 300       // 2-4s = +300
  },
  {
    type: 'true-false',
    name: 'True or False Frenzy',
    description: 'Quick decisions! Wrong answers hurt!',
    questionCount: 10,
    timePerQuestion: 5,   // 5s per question
    pointsCorrect: 250,
    pointsWrong: -250
  },
  {
    type: 'picture-sound',
    name: 'Picture This!',
    description: 'Identify the image or sound!',
    questionCount: 5,
    timePerQuestion: 10,  // 8-10s for recognition
    pointsCorrect: 150,   // Base (6-10s)
    pointsWrong: 0,
    pointsFast: 500,      // 0-3s = +500
    pointsSlow: 300       // 3-6s = +300
  },
  {
    type: 'steal-points',
    name: 'Point Heist',
    description: 'Steal points from your rivals!',
    questionCount: 4,
    timePerQuestion: 20,
    pointsCorrect: 500,   // Steal amount (correct = steal this from opponent)
    pointsWrong: -500,    // Wrong = lose this many points
    allowSteal: true
  },
  {
    type: 'hot-potato',
    name: 'Hot Potato',
    description: "Don't get caught when the bomb explodes!",
    questionCount: 20,    // More questions for multiple bomb cycles
    timePerQuestion: 15,  // 15s bomb timer
    pointsCorrect: 250,
    pointsWrong: -500     // Bomb explosion penalty
  },
  {
    type: 'ladder',
    name: 'The Ladder',
    description: 'Climb for big points, but bank before you fall!',
    questionCount: 10,
    timePerQuestion: 5,   // 5s answer + 2s bank decision
    pointsCorrect: 0,     // Uses ladder values instead
    pointsWrong: 0,       // Loses unbanked
    ladderValues: [250, 500, 1000, 2000, 4000, 8000]
  },
  {
    type: 'final',
    name: 'The Final Showdown',
    description: 'All or nothing! This is it!',
    questionCount: 3,
    timePerQuestion: 5,   // 4-5s high stakes
    pointsCorrect: 5000,
    pointsWrong: -5000
  }
];

// Raw button press event (for testing)
export interface ButtonPressEvent {
  player: number;
  button: string;
  timestamp: number;
}

// Saved game summary for listing
export interface SavedGameSummary {
  gameId: string;
  name: string;
  status: string;
  teamCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

// WebSocket Events
export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  buzzEvent: (event: BuzzEvent) => void;
  buttonPress: (event: ButtonPressEvent) => void;  // Raw button press for testing
  gamesList: (games: SavedGameSummary[]) => void;  // List of saved games
  controllerConnected: () => void;
  controllerDisconnected: () => void;
  questionStart: (question: Question, roundConfig: RoundConfig) => void;
  answerRevealed: (correctChoiceId: string, scores: { teamId: string; points: number }[], pointChanges: { teamId: string; change: number }[]) => void;
  roundStart: (round: Round) => void;
  roundRetry: (round: Round) => void;
  roundEnd: (result: RoundResult) => void;
  timerUpdate: (secondsLeft: number) => void;
  timeUp: () => void;
  soundEffect: (sound: SoundEffect) => void;
  playerBuzzerSound: (sound: BuzzerSound, playerId: string) => void;  // Play player's custom buzzer sound
  ladderUpdate: (state: LadderState) => void;
  hotPotatoUpdate: (state: HotPotatoState) => void;
  hotPotatoTick: (timeLeft: number) => void;
  hotPotatoExplode: (result: { playerId: string; playerName: string; teamId: string; teamName: string; penalty: number; questionHistory: HotPotatoQuestionEntry[] }) => void;
  fastestFingerUpdate: (state: FastestFingerState) => void;
  fastestFingerTurnTimeout: () => void;
  stealTargetSelect: (fromTeamId: string) => void;
  stealPointsUpdate: (state: StealPointsState) => void;
  stealExecuted: (result: { stealingTeamId: string; targetTeamId: string; amountStolen: number; stealerNewScore: number; targetNewScore: number }) => void;
  gameOver: (finalScores: Team[]) => void;
  error: (message: string) => void;
  // Active game management - all clients share one active game
  activeGameChanged: (state: GameState) => void;
  activeGameCleared: () => void;
  noActiveGame: () => void;
  // Full-screen animations
  showPointsAnimation: (pointChanges: { teamId: string; teamName: string; teamColor: string; change: number; oldScore: number; newScore: number }[]) => void;
}

export type SoundEffect =
  | 'buzz'
  | 'correct'
  | 'wrong'
  | 'tick'
  | 'bomb-explode'
  | 'bank'
  | 'steal'
  | 'round-start'
  | 'round-end'
  | 'game-over'
  | 'countdown'
  | 'dramatic';

export interface ClientToServerEvents {
  // Game management
  createGame: (name: string) => void;
  joinGame: (gameId: string) => void;
  loadGame: (gameId: string) => void;
  listGames: () => void;
  deleteGame: (gameId: string) => void;
  updateGameName: (gameId: string, newName: string) => void;
  requestActiveGame: () => void;  // Request the currently active game

  // Setup
  addTeam: (team: Omit<Team, 'id' | 'score'>) => void;
  removeTeam: (teamId: string) => void;
  updateTeam: (team: Team) => void;
  setRounds: (rounds: RoundConfig[]) => void;
  updateRoundConfig: (roundId: string, config: Partial<RoundConfig>) => void;

  // Questions
  addQuestion: (roundId: string, question: Omit<Question, 'id'>) => void;
  removeQuestion: (roundId: string, questionId: string) => void;
  updateQuestion: (roundId: string, question: Question) => void;
  importQuestions: (roundId: string, questions: Omit<Question, 'id'>[]) => void;

  // Game flow
  startGame: () => void;
  startRound: (roundIndex: number) => void;
  retryRound: () => void;
  startQuestion: () => void;
  revealAnswer: () => void;
  nextQuestion: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endRound: () => void;
  endGame: () => void;
  startNewBombCycle: () => void;  // Hot Potato: start new cycle after explosion

  // Player actions (via controller)
  playerBuzz: (playerId: string) => void;
  playerAnswer: (playerId: string, choiceId: string) => void;
  playerBank: (playerId: string) => void;          // Ladder round
  selectStealTarget: (targetTeamId: string) => void;

  // Score management
  adjustScore: (teamId: string, points: number) => void;

  // Controller
  testLights: () => void;
  setLights: (lights: [boolean, boolean, boolean, boolean]) => void;
  resetBuzz: () => void;

  // Settings
  updateSettings: (settings: Partial<GameSettings>) => void;

  // Animations
  triggerPointsAnimation: () => void;
}

export interface InterServerEvents {}

export interface SocketData {
  gameId?: string;
  isHost?: boolean;
}

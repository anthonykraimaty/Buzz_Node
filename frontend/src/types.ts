// ============================================
// BUZZ! GAME SHOW - FRONTEND TYPES
// ============================================

export type RoundType =
  | 'fastest-finger'
  | 'multiple-choice'
  | 'true-false'
  | 'picture-sound'
  | 'speed-race'
  | 'steal-points'
  | 'hot-potato'
  | 'ladder'
  | 'final';

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
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video';
  timeLimit?: number;
  roundType?: RoundType;
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
  funName?: string;
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

export interface RoundConfig {
  type: RoundType;
  name: string;
  description: string;
  questionCount: number;
  timePerQuestion: number;
  pointsCorrect: number;
  pointsWrong: number;
  pointsFast?: number;
  pointsSlow?: number;
  fastThresholdMs?: number;  // Threshold in ms for fast vs slow (default: 2000ms)
  allowSteal?: boolean;
  ladderValues?: number[];
  speedRacePoints?: number[];  // For speed-race round: points by position [1st, 2nd, 3rd, 4th]
}

// Optimized time limits per round type
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
    description: 'NO BUZZER - Answer directly! 1st correct = 500pts, rest = 300pts',
    questionCount: 8,
    timePerQuestion: 7,   // 6-8s for fast thinking
    pointsCorrect: 150,   // Base points (fallback)
    pointsWrong: 0,
    pointsFast: 500,      // 1st correct gets this
    pointsSlow: 300       // 2nd+ correct gets this
  },
  {
    type: 'true-false',
    name: 'True or False Frenzy',
    description: 'NO BUZZER - Quick decisions! Wrong answers hurt!',
    questionCount: 10,
    timePerQuestion: 5,   // 5s per question
    pointsCorrect: 250,
    pointsWrong: -250
  },
  {
    type: 'picture-sound',
    name: 'Picture This!',
    description: 'NO BUZZER - Identify the image or sound! 1st correct = 500pts, rest = 300pts',
    questionCount: 5,
    timePerQuestion: 10,  // 8-10s for recognition
    pointsCorrect: 150,   // Base (fallback)
    pointsWrong: 0,
    pointsFast: 500,      // 1st correct gets this
    pointsSlow: 300       // 2nd+ correct gets this
  },
  {
    type: 'speed-race',
    name: 'Speed Race',
    description: 'NO BUZZER - Race to answer! 1st correct = 500pts, 2nd = 300pts, 3rd = 150pts, 4th = 50pts',
    questionCount: 8,
    timePerQuestion: 10,  // 10s for everyone to answer
    pointsCorrect: 0,     // Uses speedRacePoints instead
    pointsWrong: 0,       // No penalty for wrong
    speedRacePoints: [500, 300, 150, 50]  // 1st, 2nd, 3rd, 4th correct
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
    timePerQuestion: 8,   // High stakes
    pointsCorrect: 5000,
    pointsWrong: -5000
  }
];

export interface Round {
  id: string;
  config: RoundConfig;
  questions: Question[];
  currentQuestionIndex: number;
  status: 'pending' | 'active' | 'completed';
  startTime?: number;
  scoresAtStart?: { teamId: string; score: number }[];  // Saved scores for retry
}

export interface BuzzEvent {
  playerId: string;
  teamId: string;
  controllerIndex: number;
  timestamp: number;
  isFirst: boolean;
}

// Raw button press event (for testing)
export interface ButtonPressEvent {
  player: number;
  button: string;
  timestamp: number;
}

export interface PlayerAnswer {
  playerId: string;
  teamId: string;
  choiceId: string;
  timestamp: number;
  responseTime: number;
  isCorrect: boolean;
  pointsEarned: number;
}

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

export interface HotPotatoState {
  phase: 'playing' | 'passing' | 'exploded';  // playing = answering, passing = selecting target, exploded = bomb went off
  currentHolderId: string;       // Player currently holding the bomb
  currentHolderTeamId: string;   // Team of current holder
  bombTimeLeft: number;          // Seconds remaining on bomb timer
  bombTotalTime: number;         // Total bomb time for this round
  lastCorrectAnswerId?: string;  // Player who just answered correctly (selects next holder)
  questionHistory: HotPotatoQuestionEntry[];  // Track all questions answered in this bomb cycle
}

// Hot Potato explosion result with question history
export interface HotPotatoExplosionResult {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  penalty: number;
  questionHistory: HotPotatoQuestionEntry[];
}

export interface FastestFingerState {
  phase: 'buzzing' | 'answering';
  currentTurnIndex: number;
  answerTimeLeft: number;
  answerTimeLimit: number;
  eliminatedPlayers: string[];
  teamsNotBuzzed: string[];
}

// Steal Points (Point Heist) state - first to buzz answers, correct answer steals points
export interface StealPointsState {
  phase: 'buzzing' | 'answering' | 'announcing' | 'stealing';  // announcing = showing who will steal
  buzzerPlayerId?: string;
  buzzerTeamId?: string;
  buzzerControllerIndex?: number;
  stealAmount: number;
  answerTimeLeft: number;         // Seconds left to answer (countdown)
  answerTimeLimit: number;        // Total seconds allowed to answer (e.g., 5)
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

export interface GameState {
  id: string;
  name: string;
  status: 'lobby' | 'setup' | 'playing' | 'paused' | 'finished';
  teams: Team[];
  rounds: Round[];
  currentRoundIndex: number;
  settings: GameSettings;
  currentQuestion: Question | null;
  buzzedPlayers: BuzzEvent[];
  playerAnswers: PlayerAnswer[];
  answerRevealed: boolean;
  questionStartTime: number | null;
  timerExpired: boolean;  // True when question timer runs out (blocks new answers)
  ladderState?: LadderState;
  hotPotatoState?: HotPotatoState;
  fastestFingerState?: FastestFingerState;
  stealPointsState?: StealPointsState;
  stealTarget?: string;  // Legacy
  roundResults: RoundResult[];
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
  "Beyonce Know-les"
];

export const ROUND_ICONS: Record<RoundType, string> = {
  'fastest-finger': '⚡',
  'multiple-choice': '🎯',
  'true-false': '⚖️',
  'picture-sound': '🖼️',
  'speed-race': '🏁',
  'steal-points': '💰',
  'hot-potato': '💣',
  'ladder': '📈',
  'final': '🏆'
};

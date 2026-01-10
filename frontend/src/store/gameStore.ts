import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import {
  GameState,
  GameSettings,
  Team,
  Question,
  Round,
  RoundConfig,
  BuzzEvent,
  ButtonPressEvent,
  LadderState,
  HotPotatoState,
  HotPotatoExplosionResult,
  StealPointsState,
  SoundEffect,
  BuzzerSound
} from '../types';

// Points animation data
export interface PointsAnimationData {
  teamId: string;
  teamName: string;
  teamColor: string;
  change: number;
  oldScore: number;
  newScore: number;
}

// Saved game summary for listing
interface SavedGameSummary {
  gameId: string;
  name: string;
  status: string;
  teamCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface GameStore {
  socket: Socket | null;
  connected: boolean;
  controllerConnected: boolean;
  gameState: GameState | null;
  savedGames: SavedGameSummary[];
  timeLeft: number;
  lastSoundEffect: SoundEffect | null;
  lastBuzzerSound: BuzzerSound | null;
  lastButtonPress: ButtonPressEvent | null;
  pointsAnimation: PointsAnimationData[] | null;
  hotPotatoExplosion: HotPotatoExplosionResult | null;  // Explosion result with question history
  error: string | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  forceReconnect: () => void;
  createGame: (name: string) => void;
  joinGame: (gameId: string) => void;
  loadGame: (gameId: string) => void;
  listSavedGames: () => void;
  clearGame: () => void;
  requestActiveGame: () => void;
  deleteGame: (gameId: string) => void;
  updateGameName: (gameId: string, newName: string) => void;

  // Team management
  addTeam: (team: Omit<Team, 'id' | 'score'>) => void;
  removeTeam: (teamId: string) => void;
  updateTeam: (team: Team) => void;
  adjustScore: (teamId: string, points: number) => void;

  // Round/Question management
  setRounds: (rounds: RoundConfig[]) => void;
  updateRoundConfig: (roundId: string, config: Partial<RoundConfig>) => void;
  addQuestion: (roundId: string, question: Omit<Question, 'id'>) => void;
  removeQuestion: (roundId: string, questionId: string) => void;
  updateQuestion: (roundId: string, question: Question) => void;
  importQuestions: (roundId: string, questions: Omit<Question, 'id'>[]) => void;

  // Game flow
  startGame: () => void;
  startRound: (roundIndex: number) => void;
  retryRound: (keepScores?: boolean) => void;
  startQuestion: () => void;
  nextQuestion: () => void;
  revealAnswer: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endRound: () => void;
  endGame: () => void;

  // Special actions
  playerBank: (playerId: string) => void;
  selectStealTarget: (targetTeamId: string) => void;
  startNewBombCycle: () => void;  // Hot Potato: start new cycle after explosion
  resetBombTimer: () => void;     // Hot Potato: reset bomb timer to full (for when timer bugs out)

  // Controller
  resetBuzz: () => void;
  testLights: () => void;
  setLights: (lights: [boolean, boolean, boolean, boolean]) => void;

  // Settings
  updateSettings: (settings: Partial<GameSettings>) => void;

  // Animations
  triggerPointsAnimation: () => void;
  clearPointsAnimation: () => void;
  clearHotPotatoExplosion: () => void;

  clearError: () => void;
  clearSoundEffect: () => void;
  clearBuzzerSound: () => void;
  clearButtonPress: () => void;
}

const ACTIVE_GAME_KEY = 'buzz-active-game-id';
const LAST_PAGE_KEY = 'buzz-last-page';

// Helper functions for page persistence
export const saveLastPage = (page: string) => {
  localStorage.setItem(LAST_PAGE_KEY, page);
};

export const getLastPage = (): string | null => {
  return localStorage.getItem(LAST_PAGE_KEY);
};

export const clearLastPage = () => {
  localStorage.removeItem(LAST_PAGE_KEY);
};

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  connected: false,
  controllerConnected: false,
  gameState: null,
  savedGames: [],
  timeLeft: 0,
  lastSoundEffect: null,
  lastBuzzerSound: null,
  lastButtonPress: null,
  pointsAnimation: null,
  hotPotatoExplosion: null,
  error: null,

  connect: () => {
    // Use the same host as the page but with backend port 3005
    const backendUrl = `http://${window.location.hostname}:3005`;
    const socket = io(backendUrl);

    socket.on('connect', () => {
      set({ connected: true });

      // Request active game from server - server will auto-join us if one exists
      // The server sends gameState automatically on connect if there's an active game

      // Always fetch the list of saved games
      socket.emit('listGames');
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    socket.on('gameState', (state: GameState) => {
      set({ gameState: state });
      // Save active game ID to localStorage for resume on refresh
      if (state?.id) {
        localStorage.setItem(ACTIVE_GAME_KEY, state.id);
      }
    });

    socket.on('gamesList', (games: SavedGameSummary[]) => {
      set({ savedGames: games });
    });

    socket.on('controllerConnected', () => {
      set({ controllerConnected: true });
    });

    socket.on('controllerDisconnected', () => {
      set({ controllerConnected: false });
    });

    socket.on('questionStart', (_question: unknown, roundConfig: { timePerQuestion: number }) => {
      // Initialize timeLeft to the full time so blur starts at max
      set({ timeLeft: roundConfig.timePerQuestion });
    });

    socket.on('timerUpdate', (seconds: number) => {
      set({ timeLeft: seconds });
    });

    socket.on('timeUp', () => {
      set({ timeLeft: 0 });
      // Also update timerExpired in gameState
      const gameState = get().gameState;
      if (gameState) {
        set({ gameState: { ...gameState, timerExpired: true } });
      }
    });

    socket.on('soundEffect', (sound: SoundEffect) => {
      set({ lastSoundEffect: sound });
    });

    socket.on('playerBuzzerSound', (sound: BuzzerSound, _playerId: string) => {
      set({ lastBuzzerSound: sound });
    });

    socket.on('buttonPress', (event: ButtonPressEvent) => {
      set({ lastButtonPress: event });
    });

    socket.on('buzzEvent', (event: BuzzEvent) => {
      const gameState = get().gameState;
      if (gameState) {
        set({
          gameState: {
            ...gameState,
            buzzedPlayers: [...gameState.buzzedPlayers, event]
          }
        });
      }
    });

    socket.on('ladderUpdate', (state: LadderState) => {
      const gameState = get().gameState;
      if (gameState) {
        set({ gameState: { ...gameState, ladderState: state } });
      }
    });

    socket.on('hotPotatoUpdate', (state: HotPotatoState) => {
      const gameState = get().gameState;
      if (gameState) {
        set({ gameState: { ...gameState, hotPotatoState: state } });
      }
    });

    socket.on('hotPotatoTick', (timeLeft: number) => {
      const gameState = get().gameState;
      if (gameState && gameState.hotPotatoState) {
        set({
          gameState: {
            ...gameState,
            hotPotatoState: { ...gameState.hotPotatoState, bombTimeLeft: timeLeft }
          }
        });
      }
    });

    socket.on('hotPotatoExplode', (result: HotPotatoExplosionResult) => {
      const gameState = get().gameState;
      if (gameState && gameState.hotPotatoState) {
        set({
          gameState: {
            ...gameState,
            hotPotatoState: { ...gameState.hotPotatoState, phase: 'exploded' }
          },
          hotPotatoExplosion: result  // Store explosion result with question history
        });
        // The explosion/summary screen will be handled by GamePage
      }
    });

    socket.on('stealPointsUpdate', (state: StealPointsState) => {
      const gameState = get().gameState;
      if (gameState) {
        set({ gameState: { ...gameState, stealPointsState: state } });
      }
    });

    socket.on('stealExecuted', (result: {
      stealingTeamId: string;
      targetTeamId: string;
      amountStolen: number;
      stealerNewScore: number;
      targetNewScore: number;
    }) => {
      const gameState = get().gameState;
      if (gameState) {
        // Find teams to get their names and colors
        const stealingTeam = gameState.teams.find(t => t.id === result.stealingTeamId);
        const targetTeam = gameState.teams.find(t => t.id === result.targetTeamId);

        if (!stealingTeam || !targetTeam) return;

        // Calculate old scores
        const stealerOldScore = result.stealerNewScore - result.amountStolen;
        const targetOldScore = result.targetNewScore + result.amountStolen;

        // Update team scores
        const updatedTeams = gameState.teams.map(team => {
          if (team.id === result.stealingTeamId) {
            return { ...team, score: result.stealerNewScore };
          }
          if (team.id === result.targetTeamId) {
            return { ...team, score: result.targetNewScore };
          }
          return team;
        });

        // Show points animation with full data
        set({
          gameState: {
            ...gameState,
            teams: updatedTeams,
            stealPointsState: undefined  // Clear steal state after execution
          },
          pointsAnimation: [
            {
              teamId: result.stealingTeamId,
              teamName: stealingTeam.name,
              teamColor: stealingTeam.color,
              change: result.amountStolen,
              oldScore: stealerOldScore,
              newScore: result.stealerNewScore
            },
            {
              teamId: result.targetTeamId,
              teamName: targetTeam.name,
              teamColor: targetTeam.color,
              change: -result.amountStolen,
              oldScore: targetOldScore,
              newScore: result.targetNewScore
            }
          ]
        });
      }
    });

    socket.on('roundStart', (round: Round) => {
      const gameState = get().gameState;
      if (gameState) {
        const rounds = [...gameState.rounds];
        const index = rounds.findIndex(r => r.id === round.id);
        if (index !== -1) {
          rounds[index] = round;
        }
        set({ gameState: { ...gameState, rounds } });
      }
    });

    socket.on('roundEnd', () => {
      // Round ended
    });

    socket.on('gameOver', () => {
      // Game over
    });

    // Active game management - all clients share one active game
    socket.on('activeGameChanged', (state: GameState) => {
      // Another client loaded/created a game - sync to it
      set({ gameState: state });
      if (state?.id) {
        localStorage.setItem(ACTIVE_GAME_KEY, state.id);
      }
      console.log('Active game changed:', state?.name);
    });

    socket.on('activeGameCleared', () => {
      // Active game was cleared (ended)
      localStorage.removeItem(ACTIVE_GAME_KEY);
      set({ gameState: null });
      console.log('Active game cleared');
    });

    socket.on('noActiveGame', () => {
      // No active game on server
      console.log('No active game on server');
    });

    socket.on('error', (message: string) => {
      set({ error: message });
    });

    // Points animation
    socket.on('showPointsAnimation', (pointChanges: PointsAnimationData[]) => {
      set({ pointsAnimation: pointChanges });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },

  forceReconnect: () => {
    const { socket } = get();
    console.log('🔄 Force reconnecting...');

    // Clean up existing socket if any
    if (socket) {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch (e) {
        console.log('Socket cleanup error:', e);
      }
    }

    // Reset state
    set({ socket: null, connected: false, controllerConnected: false, error: null });

    // Small delay then create fresh connection
    setTimeout(() => {
      // Call connect directly (re-fetch from store to get the function)
      get().connect();
    }, 200);
  },

  createGame: (name) => {
    const { socket } = get();
    socket?.emit('createGame', name);
  },

  joinGame: (gameId) => {
    const { socket } = get();
    socket?.emit('joinGame', gameId);
  },

  loadGame: (gameId) => {
    const { socket } = get();
    socket?.emit('loadGame', gameId);
  },

  listSavedGames: () => {
    const { socket } = get();
    socket?.emit('listGames');
  },

  clearGame: () => {
    localStorage.removeItem(ACTIVE_GAME_KEY);
    set({ gameState: null });
  },

  requestActiveGame: () => {
    const { socket } = get();
    socket?.emit('requestActiveGame');
  },

  deleteGame: (gameId) => {
    const { socket } = get();
    socket?.emit('deleteGame', gameId);
    // Clear local state if this is the active game
    const activeGameId = localStorage.getItem(ACTIVE_GAME_KEY);
    if (activeGameId === gameId) {
      localStorage.removeItem(ACTIVE_GAME_KEY);
      set({ gameState: null });
    }
  },

  updateGameName: (gameId, newName) => {
    const { socket } = get();
    socket?.emit('updateGameName', gameId, newName);
  },

  // Team management
  addTeam: (team) => {
    const { socket } = get();
    socket?.emit('addTeam', team);
  },

  removeTeam: (teamId) => {
    const { socket } = get();
    socket?.emit('removeTeam', teamId);
  },

  updateTeam: (team) => {
    const { socket } = get();
    socket?.emit('updateTeam', team);
  },

  adjustScore: (teamId, points) => {
    const { socket } = get();
    socket?.emit('adjustScore', teamId, points);
  },

  // Round/Question management
  setRounds: (rounds) => {
    const { socket } = get();
    socket?.emit('setRounds', rounds);
  },

  updateRoundConfig: (roundId, config) => {
    const { socket } = get();
    socket?.emit('updateRoundConfig', roundId, config);
  },

  addQuestion: (roundId, question) => {
    const { socket } = get();
    socket?.emit('addQuestion', roundId, question);
  },

  removeQuestion: (roundId, questionId) => {
    const { socket } = get();
    socket?.emit('removeQuestion', roundId, questionId);
  },

  updateQuestion: (roundId, question) => {
    const { socket } = get();
    socket?.emit('updateQuestion', roundId, question);
  },

  importQuestions: (roundId, questions) => {
    const { socket } = get();
    socket?.emit('importQuestions', roundId, questions);
  },

  // Game flow
  startGame: () => {
    const { socket } = get();
    socket?.emit('startGame');
  },

  startRound: (roundIndex) => {
    const { socket } = get();
    socket?.emit('startRound', roundIndex);
  },

  retryRound: (keepScores = false) => {
    const { socket } = get();
    socket?.emit('retryRound', keepScores);
  },

  startQuestion: () => {
    const { socket } = get();
    socket?.emit('startQuestion');
  },

  nextQuestion: () => {
    const { socket } = get();
    socket?.emit('nextQuestion');
  },

  revealAnswer: () => {
    const { socket } = get();
    socket?.emit('revealAnswer');
  },

  pauseGame: () => {
    const { socket } = get();
    socket?.emit('pauseGame');
  },

  resumeGame: () => {
    const { socket } = get();
    socket?.emit('resumeGame');
  },

  endRound: () => {
    const { socket } = get();
    socket?.emit('endRound');
  },

  endGame: () => {
    const { socket } = get();
    socket?.emit('endGame');
  },

  // Special actions
  playerBank: (playerId) => {
    const { socket } = get();
    socket?.emit('playerBank', playerId);
  },

  selectStealTarget: (targetTeamId) => {
    const { socket } = get();
    socket?.emit('selectStealTarget', targetTeamId);
  },

  startNewBombCycle: () => {
    const { socket } = get();
    socket?.emit('startNewBombCycle');
    set({ hotPotatoExplosion: null });  // Clear explosion when starting new cycle
  },

  resetBombTimer: () => {
    const { socket } = get();
    socket?.emit('resetBombTimer');
  },

  // Controller
  resetBuzz: () => {
    const { socket } = get();
    socket?.emit('resetBuzz');
  },

  testLights: () => {
    const { socket } = get();
    socket?.emit('testLights');
  },

  setLights: (lights) => {
    const { socket } = get();
    socket?.emit('setLights', lights);
  },

  // Settings
  updateSettings: (settings) => {
    const { socket, gameState } = get();
    if (socket && gameState) {
      socket.emit('updateSettings', settings);
      // Optimistic update
      set({
        gameState: {
          ...gameState,
          settings: { ...gameState.settings, ...settings }
        }
      });
    }
  },

  // Animations
  triggerPointsAnimation: () => {
    const { socket } = get();
    socket?.emit('triggerPointsAnimation');
  },
  clearPointsAnimation: () => set({ pointsAnimation: null }),
  clearHotPotatoExplosion: () => set({ hotPotatoExplosion: null }),

  clearError: () => set({ error: null }),
  clearSoundEffect: () => set({ lastSoundEffect: null }),
  clearBuzzerSound: () => set({ lastBuzzerSound: null }),
  clearButtonPress: () => set({ lastButtonPress: null }),
}));

import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  GameSettings,
  Team,
  Question,
  Round,
  RoundConfig,
  RoundResult,
  BuzzEvent,
  PlayerAnswer,
  LadderState,
  HotPotatoState,
  FastestFingerState,
  DEFAULT_ROUNDS,
  FUN_TEAM_NAMES,
  TEAM_COLORS,
  MAX_TEAMS,
  RoundType
} from './types';

const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 4,
  defaultTimeLimit: 20,
  buzzLockoutMs: 500,
  showLeaderboardBetweenRounds: true,
  playBuzzerSounds: true,
  playSoundEffects: true,
  allowLateBuzz: false,
  autoRevealAnswer: true,
  autoRevealDelayMs: 5000,        // 5 seconds after all answer or timeout
  autoShowPoints: true,
  autoShowPointsDelayMs: 3000,   // 3 seconds after reveal
  autoNextQuestion: true,
  autoNextDelayMs: 3000
};

export class GameEngine {
  private games: Map<string, GameState> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private hotPotatoTimers: Map<string, NodeJS.Timeout> = new Map();

  // =====================================
  // GAME LIFECYCLE
  // =====================================

  createGame(name: string): GameState {
    const gameId = uuidv4();
    const game: GameState = {
      id: gameId,
      name,
      status: 'lobby',
      teams: [],
      rounds: DEFAULT_ROUNDS.map(config => ({
        id: uuidv4(),
        config,
        questions: [],
        currentQuestionIndex: -1,
        status: 'pending'
      })),
      currentRoundIndex: -1,
      settings: { ...DEFAULT_SETTINGS },
      currentQuestion: null,
      buzzedPlayers: [],
      playerAnswers: [],
      answerRevealed: false,
      timerExpired: false,
      questionStartTime: null,
      roundResults: [],
      fastestFingerState: undefined
    };

    this.games.set(gameId, game);
    return game;
  }

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  getAllGames(): GameState[] {
    return Array.from(this.games.values());
  }

  restoreGame(gameState: GameState): GameState {
    // Validate and fix any corrupted round indexes before storing
    for (const round of gameState.rounds) {
      // Reset corrupted currentQuestionIndex values
      if (round.currentQuestionIndex < -1 || round.currentQuestionIndex >= round.questions.length) {
        console.log(`restoreGame: fixing corrupted index ${round.currentQuestionIndex} for round ${round.config.name} (${round.questions.length} questions)`);
        round.currentQuestionIndex = -1;
      }
    }

    // Migrate team colors to the new fixed color scheme
    this.migrateTeamColors(gameState);

    // Store game in memory from saved state
    this.games.set(gameState.id, gameState);
    return gameState;
  }

  private migrateTeamColors(gameState: GameState): void {
    console.log(`[MIGRATE] Starting team color/controller migration for ${gameState.teams.length} teams`);

    // Map old colors to new fixed colors
    const colorMap: Record<string, typeof TEAM_COLORS[number]> = {
      // Old colors
      '#e53935': TEAM_COLORS[0], // Red -> Blue
      '#8e24aa': TEAM_COLORS[1], // Purple -> Orange
      '#00acc1': TEAM_COLORS[2], // Cyan -> Green
    };

    const usedNewColors = new Set<string>();

    gameState.teams.forEach((team, index) => {
      console.log(`[MIGRATE] Team ${index}: "${team.name}" color=${team.color}`);
      if (team.players.length > 0) {
        console.log(`[MIGRATE]   Player controllerIndex before: ${team.players[0].controllerIndex}`);
      }

      // Check if already using a valid new color
      const existingValid = TEAM_COLORS.find(c => c.hex === team.color);
      if (existingValid && !usedNewColors.has(existingValid.hex)) {
        usedNewColors.add(existingValid.hex);
        // Update controller index and player name to match color
        if (team.players.length > 0) {
          const oldIndex = team.players[0].controllerIndex;
          team.players[0].controllerIndex = existingValid.controllerIndex as 1 | 2 | 3 | 4;
          console.log(`[MIGRATE]   Fixed controllerIndex: ${oldIndex} -> ${existingValid.controllerIndex} (color: ${existingValid.name})`);
          // Update player name if it looks like a default name (Player 1, Player 2, etc.)
          if (/^Player \d+$/.test(team.players[0].name)) {
            team.players[0].name = `Player ${existingValid.controllerIndex}`;
          }
        }
        return;
      }

      // Need to assign a new color
      const mappedColor = colorMap[team.color];
      if (mappedColor && !usedNewColors.has(mappedColor.hex)) {
        console.log(`Migrating team "${team.name}" from ${team.color} to ${mappedColor.hex} (${mappedColor.name})`);
        team.color = mappedColor.hex;
        usedNewColors.add(mappedColor.hex);
        if (team.players.length > 0) {
          team.players[0].controllerIndex = mappedColor.controllerIndex as 1 | 2 | 3 | 4;
          // Update player name if it looks like a default name (Player 1, Player 2, etc.)
          if (/^Player \d+$/.test(team.players[0].name)) {
            team.players[0].name = `Player ${mappedColor.controllerIndex}`;
          }
        }
        return;
      }

      // Find first available color
      const availableColor = TEAM_COLORS.find(c => !usedNewColors.has(c.hex));
      if (availableColor) {
        console.log(`Migrating team "${team.name}" from ${team.color} to ${availableColor.hex} (${availableColor.name})`);
        team.color = availableColor.hex;
        usedNewColors.add(availableColor.hex);
        if (team.players.length > 0) {
          team.players[0].controllerIndex = availableColor.controllerIndex as 1 | 2 | 3 | 4;
          // Update player name if it looks like a default name (Player 1, Player 2, etc.)
          if (/^Player \d+$/.test(team.players[0].name)) {
            team.players[0].name = `Player ${availableColor.controllerIndex}`;
          }
        }
      }
    });

    // Limit to 4 teams max
    if (gameState.teams.length > MAX_TEAMS) {
      console.log(`Trimming teams from ${gameState.teams.length} to ${MAX_TEAMS}`);
      gameState.teams = gameState.teams.slice(0, MAX_TEAMS);
    }

    // Final summary log
    console.log(`[MIGRATE] Migration complete. Final team controller assignments:`);
    gameState.teams.forEach((team, index) => {
      const controllerIndices = team.players.map(p => p.controllerIndex).join(', ');
      console.log(`[MIGRATE]   Team ${index}: "${team.name}" -> controllerIndices [${controllerIndices}]`);
    });
  }

  // =====================================
  // TEAM MANAGEMENT
  // =====================================

  addTeam(gameId: string, teamData: Omit<Team, 'id' | 'score'>): Team | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    // Enforce max 4 teams
    if (game.teams.length >= MAX_TEAMS) {
      console.log(`Cannot add team: max ${MAX_TEAMS} teams allowed`);
      return null;
    }

    // Validate color is one of the allowed colors
    const validColor = TEAM_COLORS.find(c => c.hex === teamData.color || c.id === teamData.color);
    if (!validColor) {
      console.log(`Invalid team color: ${teamData.color}`);
      return null;
    }

    // Check if color is already taken
    const colorTaken = game.teams.some(t => t.color === validColor.hex);
    if (colorTaken) {
      console.log(`Color ${validColor.name} is already taken`);
      return null;
    }

    const team: Team = {
      id: uuidv4(),
      score: 0,
      funName: teamData.funName || this.getRandomFunName(game.teams),
      ...teamData,
      color: validColor.hex // Ensure we use the hex value
    };

    // Assign the player's controller index based on color
    if (team.players.length > 0) {
      team.players[0].controllerIndex = validColor.controllerIndex as 1 | 2 | 3 | 4;
    }

    game.teams.push(team);
    return team;
  }

  private getRandomFunName(existingTeams: Team[]): string {
    const usedNames = new Set(existingTeams.map(t => t.funName));
    const available = FUN_TEAM_NAMES.filter(n => !usedNames.has(n));
    if (available.length === 0) return FUN_TEAM_NAMES[0];
    return available[Math.floor(Math.random() * available.length)];
  }

  getAvailableColors(gameId: string): typeof TEAM_COLORS[number][] {
    const game = this.games.get(gameId);
    if (!game) return [...TEAM_COLORS];

    const usedColors = new Set(game.teams.map(t => t.color));
    return TEAM_COLORS.filter(c => !usedColors.has(c.hex));
  }

  removeTeam(gameId: string, teamId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const index = game.teams.findIndex(t => t.id === teamId);
    if (index === -1) return false;

    game.teams.splice(index, 1);
    return true;
  }

  updateTeam(gameId: string, team: Team): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const index = game.teams.findIndex(t => t.id === team.id);
    if (index === -1) return false;

    game.teams[index] = team;
    return true;
  }

  adjustScore(gameId: string, teamId: string, points: number): Team | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    const team = game.teams.find(t => t.id === teamId);
    if (!team) return null;

    team.score = Math.max(0, team.score + points);
    return team;
  }

  // =====================================
  // ROUND MANAGEMENT
  // =====================================

  setRounds(gameId: string, configs: RoundConfig[]): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    // Preserve existing questions when reordering rounds
    const existingRoundsByType = new Map(
      game.rounds.map(r => [r.config.type, r])
    );

    game.rounds = configs.map(config => {
      const existingRound = existingRoundsByType.get(config.type);
      if (existingRound) {
        // Preserve existing round with its questions, update config
        return {
          ...existingRound,
          config
        };
      }
      // New round
      return {
        id: uuidv4(),
        config,
        questions: [],
        currentQuestionIndex: -1,
        status: 'pending' as const
      };
    });
    return true;
  }

  getRound(gameId: string, roundIndex: number): Round | null {
    const game = this.games.get(gameId);
    if (!game || roundIndex < 0 || roundIndex >= game.rounds.length) return null;
    return game.rounds[roundIndex];
  }

  getCurrentRound(gameId: string): Round | null {
    const game = this.games.get(gameId);
    if (!game || game.currentRoundIndex < 0) return null;
    return game.rounds[game.currentRoundIndex];
  }

  // =====================================
  // QUESTION MANAGEMENT
  // =====================================

  addQuestion(gameId: string, roundId: string, questionData: Omit<Question, 'id'>): Question | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    const round = game.rounds.find(r => r.id === roundId);
    if (!round) return null;

    const question: Question = {
      id: uuidv4(),
      ...questionData
    };

    round.questions.push(question);
    return question;
  }

  removeQuestion(gameId: string, roundId: string, questionId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const round = game.rounds.find(r => r.id === roundId);
    if (!round) return false;

    const index = round.questions.findIndex(q => q.id === questionId);
    if (index === -1) return false;

    round.questions.splice(index, 1);
    return true;
  }

  updateQuestion(gameId: string, roundId: string, question: Question): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const round = game.rounds.find(r => r.id === roundId);
    if (!round) return false;

    const index = round.questions.findIndex(q => q.id === question.id);
    if (index === -1) return false;

    round.questions[index] = question;
    return true;
  }

  importQuestions(gameId: string, roundId: string, questions: Omit<Question, 'id'>[]): Question[] {
    const game = this.games.get(gameId);
    if (!game) return [];

    const round = game.rounds.find(r => r.id === roundId);
    if (!round) return [];

    const newQuestions = questions.map(q => ({
      id: uuidv4(),
      ...q
    }));

    round.questions.push(...newQuestions);
    return newQuestions;
  }

  // =====================================
  // GAME FLOW
  // =====================================

  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.teams.length < 1) return false;

    // Check if all rounds have questions
    const hasQuestions = game.rounds.some(r => r.questions.length > 0);
    if (!hasQuestions) return false;

    game.status = 'playing';
    game.currentRoundIndex = 0;

    // Reset all scores
    game.teams.forEach(t => t.score = 0);

    // Find first round with questions and activate it
    const firstRoundWithQuestions = game.rounds.findIndex(r => r.questions.length > 0);
    if (firstRoundWithQuestions >= 0) {
      game.currentRoundIndex = firstRoundWithQuestions;
      const round = game.rounds[firstRoundWithQuestions];
      round.status = 'active';
      round.currentQuestionIndex = -1;
      round.startTime = Date.now();

      // Reset round-specific state
      game.currentQuestion = null;
      game.buzzedPlayers = [];
      game.playerAnswers = [];
      game.answerRevealed = false;
      game.timerExpired = false;
      game.ladderState = undefined;
      game.hotPotatoState = undefined;
    }

    return true;
  }

  startRound(gameId: string, roundIndex: number): Round | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'playing') return null;

    if (roundIndex < 0 || roundIndex >= game.rounds.length) return null;

    const round = game.rounds[roundIndex];
    if (round.questions.length === 0) return null;

    game.currentRoundIndex = roundIndex;
    round.status = 'active';
    round.currentQuestionIndex = -1;
    round.startTime = Date.now();

    // Save team scores at round start (for retry feature)
    round.scoresAtStart = game.teams.map(t => ({ teamId: t.id, score: t.score }));
    console.log(`[ROUND] Saved scores at start of round ${roundIndex}:`, round.scoresAtStart);

    // Reset round-specific state
    game.currentQuestion = null;
    game.buzzedPlayers = [];
    game.playerAnswers = [];
    game.answerRevealed = false;
    game.timerExpired = false;
    game.ladderState = undefined;
    game.hotPotatoState = undefined;
    game.fastestFingerState = undefined;

    // Initialize ladder state if needed
    if (round.config.type === 'ladder') {
      // Will be set per-question
    }

    return round;
  }

  retryRound(gameId: string, keepScores: boolean = false): Round | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    const roundIndex = game.currentRoundIndex;
    if (roundIndex < 0 || roundIndex >= game.rounds.length) return null;

    const round = game.rounds[roundIndex];

    // Restore scores to what they were at the start of this round (unless keepScores is true)
    if (!keepScores && round.scoresAtStart) {
      console.log(`[RETRY] Restoring scores from round ${roundIndex} start:`, round.scoresAtStart);
      for (const savedScore of round.scoresAtStart) {
        const team = game.teams.find(t => t.id === savedScore.teamId);
        if (team) {
          console.log(`[RETRY]   Team "${team.name}": ${team.score} -> ${savedScore.score}`);
          team.score = savedScore.score;
        }
      }
    } else if (keepScores) {
      console.log(`[RETRY] Keeping current scores for round ${roundIndex}`);
    }

    // Reset round state
    round.status = 'active';
    round.currentQuestionIndex = -1;
    round.startTime = Date.now();

    // Reset game state for this round
    game.currentQuestion = null;
    game.buzzedPlayers = [];
    game.playerAnswers = [];
    game.answerRevealed = false;
    game.timerExpired = false;
    game.ladderState = undefined;
    game.hotPotatoState = undefined;
    game.fastestFingerState = undefined;
    game.stealPointsState = undefined;

    console.log(`[RETRY] Round ${roundIndex} reset for retry`);
    return round;
  }

  startQuestion(gameId: string): { question: Question; roundConfig: RoundConfig } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'playing') {
      console.log(`startQuestion failed: game status is ${game?.status}`);
      return null;
    }

    const round = this.getCurrentRound(gameId);
    if (!round || round.status !== 'active') {
      console.log(`startQuestion failed: round status is ${round?.status}`);
      return null;
    }

    // Validate currentQuestionIndex before incrementing (fix for corrupted data)
    if (round.currentQuestionIndex < -1 || round.currentQuestionIndex >= round.questions.length) {
      console.log(`startQuestion: resetting corrupted index ${round.currentQuestionIndex} to -1`);
      round.currentQuestionIndex = -1;
    }

    round.currentQuestionIndex++;
    if (round.currentQuestionIndex >= round.questions.length) {
      console.log(`startQuestion: no more questions (index ${round.currentQuestionIndex} >= ${round.questions.length})`);
      return null;
    }

    const question = round.questions[round.currentQuestionIndex];
    game.currentQuestion = question;
    game.buzzedPlayers = [];
    game.playerAnswers = [];
    game.answerRevealed = false;
    game.timerExpired = false;
    game.questionStartTime = Date.now();

    // Initialize Fastest Finger state - first to buzz gets to answer
    if (round.config.type === 'fastest-finger') {
      const answerTimeLimit = 3; // 3 seconds to answer (speed round)
      game.fastestFingerState = {
        phase: 'buzzing',
        currentTurnIndex: 0,
        answerTimeLeft: answerTimeLimit,
        answerTimeLimit,
        eliminatedPlayers: [],
        teamsNotBuzzed: []  // Not used in new logic - first buzz wins
      };
    } else {
      game.fastestFingerState = undefined;
    }

    // Initialize Hot Potato if needed
    if (round.config.type === 'hot-potato') {
      const allPlayers = game.teams.flatMap(t => t.players);
      if (allPlayers.length > 0) {
        // Only initialize if not already set (preserve current holder between questions)
        if (!game.hotPotatoState || game.hotPotatoState.phase === 'exploded') {
          // Randomly select starting player for first question of round
          const randomPlayer = allPlayers[Math.floor(Math.random() * allPlayers.length)];
          const playerTeam = game.teams.find(t => t.players.some(p => p.id === randomPlayer.id));

          game.hotPotatoState = {
            phase: 'playing',
            currentHolderId: randomPlayer.id,
            currentHolderTeamId: playerTeam?.id || '',
            bombTimeLeft: round.config.timePerQuestion,
            bombTotalTime: round.config.timePerQuestion,
            questionHistory: []
          };
          console.log(`[HOT-POTATO] Initialized: ${randomPlayer.name} starts with bomb, ${round.config.timePerQuestion}s timer`);
        } else {
          // Preserve current holder, just reset to playing phase if needed
          if (game.hotPotatoState.phase === 'passing') {
            game.hotPotatoState.phase = 'playing';
          }
          const currentHolder = allPlayers.find(p => p.id === game.hotPotatoState?.currentHolderId);
          console.log(`[HOT-POTATO] Next question: ${currentHolder?.name || 'Unknown'} still has bomb`);
        }
      }
    } else {
      game.hotPotatoState = undefined;
    }

    // Initialize Steal Points (Point Heist) state - first to buzz gets to answer
    if (round.config.type === 'steal-points') {
      game.stealPointsState = {
        phase: 'buzzing',
        stealAmount: 500,  // Fixed steal amount
        answerTimeLeft: 5, // 5 seconds to answer
        answerTimeLimit: 5
      };
      console.log('[STEAL-POINTS] Initialized stealPointsState with phase: buzzing');
    } else {
      game.stealPointsState = undefined;
    }

    return { question, roundConfig: round.config };
  }

  // =====================================
  // BUZZ HANDLING
  // =====================================

  handleBuzz(gameId: string, controllerIndex: number): BuzzEvent | null {
    const game = this.games.get(gameId);

    // Debug: Log all conditions
    console.log(`[BUZZ] Controller ${controllerIndex} pressed`);
    console.log(`[BUZZ] Game exists: ${!!game}, Status: ${game?.status}, Has question: ${!!game?.currentQuestion}`);

    if (!game) {
      console.log('[BUZZ] REJECTED: No game found');
      return null;
    }
    if (game.status !== 'playing') {
      console.log(`[BUZZ] REJECTED: Game status is ${game.status}, not playing`);
      return null;
    }
    if (!game.currentQuestion) {
      console.log('[BUZZ] REJECTED: No current question');
      return null;
    }

    const round = this.getCurrentRound(gameId);
    if (!round) {
      console.log('[BUZZ] REJECTED: No current round');
      return null;
    }

    console.log(`[BUZZ] Round type: ${round.config.type}, Status: ${round.status}`);

    // Find player by controller index
    let foundPlayer = null;
    let foundTeam = null;

    // Debug: Log all teams and their players' controller indices
    console.log(`[BUZZ] Looking for controllerIndex ${controllerIndex} in ${game.teams.length} teams:`);
    for (const team of game.teams) {
      const playerIndices = team.players.map(p => p.controllerIndex).join(', ');
      console.log(`[BUZZ]   Team "${team.name}": controllerIndices [${playerIndices}]`);
      const player = team.players.find(p => p.controllerIndex === controllerIndex);
      if (player) {
        foundPlayer = player;
        foundTeam = team;
        break;
      }
    }

    if (!foundPlayer || !foundTeam) {
      console.log(`[BUZZ] REJECTED: No player found with controllerIndex ${controllerIndex}`);
      return null;
    }

    console.log(`[BUZZ] Found player: ${foundPlayer.name} in team ${foundTeam.name}`);

    // Check if already buzzed (for fastest-finger type)
    const alreadyBuzzed = game.buzzedPlayers.some(b => b.playerId === foundPlayer.id);
    if (alreadyBuzzed) {
      console.log('[BUZZ] REJECTED: Player already buzzed');
      return null;
    }

    const isFirst = game.buzzedPlayers.length === 0;

    const buzzEvent: BuzzEvent = {
      playerId: foundPlayer.id,
      teamId: foundTeam.id,
      controllerIndex,
      timestamp: Date.now(),
      isFirst
    };

    game.buzzedPlayers.push(buzzEvent);

    // For fastest-finger rounds: FIRST BUZZ WINS - immediately transition to answering phase
    if (round.config.type === 'fastest-finger' && game.fastestFingerState) {
      // First buzz immediately locks in and transitions to answering
      if (game.fastestFingerState.phase === 'buzzing' && isFirst) {
        game.fastestFingerState.phase = 'answering';
        game.fastestFingerState.currentTurnIndex = 0;
        game.fastestFingerState.answerTimeLeft = game.fastestFingerState.answerTimeLimit;
        console.log(`[FASTEST-FINGER] First buzz by ${foundPlayer.name}! Transitioning to answering phase.`);
      } else if (game.fastestFingerState.phase === 'answering') {
        // Someone already buzzed first - reject this buzz
        console.log(`[FASTEST-FINGER] Buzz rejected - ${foundPlayer.name} was too slow`);
        game.buzzedPlayers.pop(); // Remove this buzz
        return null;
      }
    }

    // For steal-points rounds, only first buzzer gets to answer - transition immediately to answering phase
    if (round.config.type === 'steal-points') {
      console.log(`[BUZZ] Steal-points round. stealPointsState exists: ${!!game.stealPointsState}, phase: ${game.stealPointsState?.phase}`);

      if (!game.stealPointsState) {
        console.log('[BUZZ] REJECTED: No stealPointsState!');
        return null;
      }

      // Only allow buzzing during buzzing phase
      if (game.stealPointsState.phase !== 'buzzing') {
        console.log(`[BUZZ] REJECTED: stealPointsState.phase is "${game.stealPointsState.phase}", not "buzzing"`);
        game.buzzedPlayers.pop(); // Remove this buzz
        return null;
      }

      if (isFirst) {
        console.log('[BUZZ] SUCCESS: First buzzer in steal-points! Transitioning to answering phase');
        game.stealPointsState.phase = 'answering';
        game.stealPointsState.buzzerPlayerId = foundPlayer.id;
        game.stealPointsState.buzzerTeamId = foundTeam.id;
        game.stealPointsState.buzzerControllerIndex = controllerIndex;
        // Reset answer timer
        game.stealPointsState.answerTimeLeft = game.stealPointsState.answerTimeLimit;
      } else {
        // Not first buzzer - reject the buzz (already have a buzzer)
        console.log('[BUZZ] REJECTED: Not first buzzer in steal-points');
        game.buzzedPlayers.pop(); // Remove this buzz
        return null;
      }
    }

    console.log('[BUZZ] SUCCESS: Buzz accepted!');
    return buzzEvent;
  }

  resetBuzz(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    game.buzzedPlayers = [];
    game.fastestFingerState = undefined;
    return true;
  }

  // Set timer expired flag (blocks new answers in multiple-choice rounds)
  setTimerExpired(gameId: string, expired: boolean): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    game.timerExpired = expired;
    return true;
  }

  // Fastest Finger: Advance to next buzzer's turn
  advanceFastestFingerTurn(gameId: string, eliminateCurrentPlayer: boolean = true): FastestFingerState | null {
    const game = this.games.get(gameId);
    if (!game || !game.fastestFingerState) return null;

    const state = game.fastestFingerState;

    // Eliminate current player if requested (wrong answer or timeout)
    if (eliminateCurrentPlayer) {
      const currentBuzzer = game.buzzedPlayers[state.currentTurnIndex];
      if (currentBuzzer && !state.eliminatedPlayers.includes(currentBuzzer.playerId)) {
        state.eliminatedPlayers.push(currentBuzzer.playerId);
      }
    }

    // Find next valid buzzer
    let nextIndex = state.currentTurnIndex + 1;
    while (nextIndex < game.buzzedPlayers.length) {
      const buzzer = game.buzzedPlayers[nextIndex];
      if (!state.eliminatedPlayers.includes(buzzer.playerId)) {
        break;
      }
      nextIndex++;
    }

    // Check if we have a next buzzer
    if (nextIndex < game.buzzedPlayers.length) {
      state.currentTurnIndex = nextIndex;
      state.answerTimeLeft = state.answerTimeLimit; // Reset timer for new player
      return state;
    }

    // No more buzzers available - question ends with no correct answer
    return null;
  }

  // Fastest Finger: Update timer
  updateFastestFingerTimer(gameId: string, timeLeft: number): FastestFingerState | null {
    const game = this.games.get(gameId);
    if (!game || !game.fastestFingerState) return null;

    game.fastestFingerState.answerTimeLeft = timeLeft;
    return game.fastestFingerState;
  }

  // =====================================
  // ANSWER HANDLING
  // =====================================

  handleAnswer(
    gameId: string,
    controllerIndex: number,
    choiceColor: string
  ): PlayerAnswer | null {
    const game = this.games.get(gameId);
    if (!game || !game.currentQuestion || game.answerRevealed) return null;

    // Block answers after timer has expired (for multiple-choice style rounds)
    if (game.timerExpired) return null;

    const round = this.getCurrentRound(gameId);
    if (!round) return null;

    // Find player
    let foundPlayer = null;
    let foundTeam = null;

    for (const team of game.teams) {
      const player = team.players.find(p => p.controllerIndex === controllerIndex);
      if (player) {
        foundPlayer = player;
        foundTeam = team;
        break;
      }
    }

    if (!foundPlayer || !foundTeam) return null;

    // For fastest-finger mode, only allow the current turn player to answer
    if (round.config.type === 'fastest-finger' && game.fastestFingerState) {
      const currentBuzzer = game.buzzedPlayers[game.fastestFingerState.currentTurnIndex];
      if (!currentBuzzer || currentBuzzer.playerId !== foundPlayer.id) {
        // This player is not the current turn - reject the answer
        return null;
      }
      // Check if this player was already eliminated
      if (game.fastestFingerState.eliminatedPlayers.includes(foundPlayer.id)) {
        return null;
      }
    }

    // For steal-points mode, only the buzzer can answer
    if (round.config.type === 'steal-points' && game.stealPointsState) {
      // Must be in answering phase
      if (game.stealPointsState.phase !== 'answering') {
        return null;
      }
      // Only the buzzer can answer
      if (game.stealPointsState.buzzerPlayerId !== foundPlayer.id) {
        return null;
      }
    }

    // Check if player already answered
    const alreadyAnswered = game.playerAnswers.some(a => a.playerId === foundPlayer.id);
    if (alreadyAnswered) return null;

    // Find the choice by color
    const choice = game.currentQuestion.choices.find(c => c.color === choiceColor);
    if (!choice) return null;

    const now = Date.now();
    const responseTime = game.questionStartTime
      ? now - game.questionStartTime
      : 0;

    console.log(`[ANSWER] Player ${foundPlayer.name} answered. questionStartTime=${game.questionStartTime}, now=${now}, responseTime=${responseTime}ms`);

    // Calculate points based on round type
    const points = this.calculatePoints(round, choice.isCorrect, responseTime, game);

    const answer: PlayerAnswer = {
      playerId: foundPlayer.id,
      teamId: foundTeam.id,
      choiceId: choice.id,
      timestamp: Date.now(),
      responseTime,
      isCorrect: choice.isCorrect,
      pointsEarned: points
    };

    game.playerAnswers.push(answer);

    // NOTE: Points are NOT added here - they are added when answer is revealed
    // This prevents players from deducing correct answer from score changes

    return answer;
  }

  private calculatePoints(
    round: Round,
    isCorrect: boolean,
    responseTime: number,
    game: GameState
  ): number {
    const config = round.config;

    if (!isCorrect) {
      return config.pointsWrong;
    }

    // True-false: only the first correct answer gets points
    if (config.type === 'true-false') {
      const hasCorrectAnswer = game.playerAnswers.some(a => a.isCorrect);
      if (hasCorrectAnswer) {
        return 0; // Someone already answered correctly first
      }
      return config.pointsCorrect;
    }

    // Speed-race: points based on order of correct answers
    if (config.type === 'speed-race') {
      const speedRacePoints = config.speedRacePoints || [500, 300, 150, 50];
      // Count how many correct answers came before this one
      const correctAnswersBefore = game.playerAnswers.filter(a => a.isCorrect).length;
      // Get points for this position (0-indexed)
      if (correctAnswersBefore < speedRacePoints.length) {
        return speedRacePoints[correctAnswersBefore];
      }
      return 0; // Beyond the defined positions, no points
    }

    // Steal-points: correct answer gives 0 points directly - points come from stealing
    if (config.type === 'steal-points') {
      return 0; // Points are added when stealing from opponent
    }

    // Ladder round has special logic
    if (config.type === 'ladder' && game.ladderState) {
      const values = config.ladderValues || [250, 500, 1000, 2000, 4000, 8000];
      const step = Math.min(game.ladderState.currentStep, values.length - 1);
      game.ladderState.currentStep++;
      game.ladderState.unbankedPoints = values[game.ladderState.currentStep] || values[values.length - 1];
      return 0; // Points are added when banked
    }

    // Speed-based points for multiple-choice style rounds
    // Use position-based scoring: 1st correct = pointsFast, 2nd+ correct = pointsSlow
    if (config.pointsFast && config.pointsSlow) {
      const correctAnswersBefore = game.playerAnswers.filter(a => a.isCorrect).length;
      // First correct answer gets pointsFast, everyone else gets pointsSlow
      const points = correctAnswersBefore === 0 ? config.pointsFast : config.pointsSlow;
      console.log(`[POINTS] Position-based scoring: correctAnswersBefore=${correctAnswersBefore}, points=${points} (${correctAnswersBefore === 0 ? '1ST' : 'NOT 1ST'})`);
      return points;
    }

    return config.pointsCorrect;
  }

  // =====================================
  // SPECIAL ROUND MECHANICS
  // =====================================

  // Ladder: Bank points
  bankPoints(gameId: string, playerId: string): number {
    const game = this.games.get(gameId);
    if (!game || !game.ladderState || game.ladderState.playerId !== playerId) return 0;

    const banked = game.ladderState.unbankedPoints;
    game.ladderState.bankedPoints += banked;
    game.ladderState.unbankedPoints = 0;
    game.ladderState.currentStep = 0;

    // Find and update team score
    for (const team of game.teams) {
      if (team.players.some(p => p.id === playerId)) {
        team.score += banked;
        break;
      }
    }

    return banked;
  }

  // Ladder: Lose unbanked on wrong answer
  loseUnbankedPoints(gameId: string): number {
    const game = this.games.get(gameId);
    if (!game || !game.ladderState) return 0;

    const lost = game.ladderState.unbankedPoints;
    game.ladderState.unbankedPoints = 0;
    game.ladderState.currentStep = 0;

    return lost;
  }

  // Hot Potato: Start passing phase (player answered correctly, can choose who to pass to)
  startHotPotatoPassing(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.hotPotatoState) return false;

    game.hotPotatoState.phase = 'passing';
    game.hotPotatoState.lastCorrectAnswerId = playerId;
    console.log(`[HOT-POTATO] Passing phase: ${playerId} can choose who to pass bomb to`);
    return true;
  }

  // Hot Potato: Pass the bomb to a specific player
  passHotPotatoTo(gameId: string, targetPlayerId: string): { newHolderId: string; newHolderTeamId: string; newHolderName: string } | null {
    const game = this.games.get(gameId);
    if (!game || !game.hotPotatoState) return null;

    // Find the target player and their team
    for (const team of game.teams) {
      const player = team.players.find(p => p.id === targetPlayerId);
      if (player) {
        game.hotPotatoState.currentHolderId = targetPlayerId;
        game.hotPotatoState.currentHolderTeamId = team.id;
        game.hotPotatoState.phase = 'playing';
        game.hotPotatoState.lastCorrectAnswerId = undefined;
        console.log(`[HOT-POTATO] Bomb passed to ${player.name} (${team.name})`);
        return { newHolderId: targetPlayerId, newHolderTeamId: team.id, newHolderName: player.name };
      }
    }
    return null;
  }

  // Hot Potato: Update bomb timer (call every second)
  tickHotPotatoTimer(gameId: string): number {
    const game = this.games.get(gameId);
    if (!game || !game.hotPotatoState || game.hotPotatoState.phase === 'exploded') return -1;

    game.hotPotatoState.bombTimeLeft = Math.max(0, game.hotPotatoState.bombTimeLeft - 1);
    return game.hotPotatoState.bombTimeLeft;
  }

  // Hot Potato: Bomb explodes
  explodeBomb(gameId: string): { playerId: string; playerName: string; teamId: string; teamName: string; penalty: number } | null {
    const game = this.games.get(gameId);
    if (!game || !game.hotPotatoState) return null;

    const round = this.getCurrentRound(gameId);
    if (!round) return null;

    const holderId = game.hotPotatoState.currentHolderId;
    const penalty = 500; // Fixed penalty

    // Mark as exploded
    game.hotPotatoState.phase = 'exploded';

    // Find team and apply penalty
    for (const team of game.teams) {
      const player = team.players.find(p => p.id === holderId);
      if (player) {
        team.score = Math.max(0, team.score - penalty);
        console.log(`[HOT-POTATO] BOOM! ${player.name} (${team.players[0]?.name || team.name}) loses ${penalty} points!`);
        return { playerId: holderId, playerName: player.name, teamId: team.id, teamName: team.players[0]?.name || team.name, penalty };
      }
    }

    return null;
  }

  // Hot Potato: Get current holder info
  getHotPotatoHolder(gameId: string): { playerId: string; playerName: string; teamId: string; teamName: string; controllerIndex: number } | null {
    const game = this.games.get(gameId);
    if (!game || !game.hotPotatoState) return null;

    for (const team of game.teams) {
      const player = team.players.find(p => p.id === game.hotPotatoState!.currentHolderId);
      if (player) {
        return {
          playerId: player.id,
          playerName: player.name,
          teamId: team.id,
          teamName: team.players[0]?.name || team.name,
          controllerIndex: player.controllerIndex
        };
      }
    }
    return null;
  }

  // Hot Potato: Record question result in history
  recordHotPotatoQuestion(
    gameId: string,
    questionText: string,
    correctAnswer: string,
    playerAnswer: string | null,
    wasCorrect: boolean | null,
    playerName: string,
    teamColor: string
  ): void {
    const game = this.games.get(gameId);
    if (!game || !game.hotPotatoState) return;

    game.hotPotatoState.questionHistory.push({
      questionText,
      correctAnswer,
      playerAnswer,
      wasCorrect,
      playerName,
      teamColor
    });
    console.log(`[HOT-POTATO] Recorded question: "${questionText.substring(0, 30)}..." - ${playerAnswer ? (wasCorrect ? 'CORRECT' : 'WRONG') : 'NO ANSWER'}`);
  }

  // Hot Potato: Reset bomb for a new cycle (after explosion, start fresh)
  resetHotPotatoBomb(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const round = this.getCurrentRound(gameId);
    if (!round || round.config.type !== 'hot-potato') return;

    const allPlayers = game.teams.flatMap(t => t.players);
    if (allPlayers.length > 0) {
      // Randomly select a new starting player
      const randomPlayer = allPlayers[Math.floor(Math.random() * allPlayers.length)];
      const playerTeam = game.teams.find(t => t.players.some(p => p.id === randomPlayer.id));

      game.hotPotatoState = {
        phase: 'playing',
        currentHolderId: randomPlayer.id,
        currentHolderTeamId: playerTeam?.id || '',
        bombTimeLeft: round.config.timePerQuestion,
        bombTotalTime: round.config.timePerQuestion,
        questionHistory: []
      };
      console.log(`[HOT-POTATO] New bomb cycle: ${randomPlayer.name} starts with bomb`);
    }
  }

  // Steal Points: Transition to announcing phase (called when buzzer answers correctly, shows who will steal)
  startAnnouncingPhase(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.stealPointsState) return false;

    game.stealPointsState.phase = 'announcing';
    return true;
  }

  // Steal Points: Transition to stealing phase (called after announcement)
  startStealPhase(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.stealPointsState) return false;

    game.stealPointsState.phase = 'stealing';
    return true;
  }

  // Steal Points: Execute steal when victim is selected
  executeSteal(gameId: string, targetTeamId: string): {
    stealingTeamId: string;
    targetTeamId: string;
    amountStolen: number;
    stealerNewScore: number;
    targetNewScore: number;
  } | null {
    const game = this.games.get(gameId);
    if (!game || !game.stealPointsState || game.stealPointsState.phase !== 'stealing') return null;

    const stealingTeamId = game.stealPointsState.buzzerTeamId;
    if (!stealingTeamId) return null;

    const stealingTeam = game.teams.find(t => t.id === stealingTeamId);
    const targetTeam = game.teams.find(t => t.id === targetTeamId);

    if (!stealingTeam || !targetTeam) return null;

    // Can't steal from yourself
    if (stealingTeamId === targetTeamId) return null;

    const stealAmount = game.stealPointsState.stealAmount;
    const actualSteal = Math.min(stealAmount, targetTeam.score);

    targetTeam.score -= actualSteal;
    stealingTeam.score += actualSteal;

    // Clear steal state
    game.stealPointsState = undefined;

    return {
      stealingTeamId,
      targetTeamId,
      amountStolen: actualSteal,
      stealerNewScore: stealingTeam.score,
      targetNewScore: targetTeam.score
    };
  }

  // Legacy method for backwards compatibility
  setStealTarget(gameId: string, targetTeamId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const targetTeam = game.teams.find(t => t.id === targetTeamId);
    if (!targetTeam) return false;

    game.stealTarget = targetTeamId;
    return true;
  }

  // =====================================
  // ANSWER REVEAL & SCORING
  // =====================================

  revealAnswer(gameId: string): { correctChoiceId: string; scores: { teamId: string; points: number }[]; pointChanges: { teamId: string; change: number }[] } | null {
    const game = this.games.get(gameId);
    if (!game || !game.currentQuestion) return null;

    game.answerRevealed = true;

    const correctChoice = game.currentQuestion.choices.find(c => c.isCorrect);
    if (!correctChoice) return null;

    // Now apply all pending points from player answers
    const pointChanges: { teamId: string; change: number }[] = [];

    for (const answer of game.playerAnswers) {
      const team = game.teams.find(t => t.id === answer.teamId);
      if (team) {
        const previousScore = team.score;
        team.score = Math.max(0, team.score + answer.pointsEarned);
        const actualChange = team.score - previousScore;

        // Track point changes for animations
        const existingChange = pointChanges.find(pc => pc.teamId === team.id);
        if (existingChange) {
          existingChange.change += actualChange;
        } else {
          pointChanges.push({ teamId: team.id, change: actualChange });
        }
      }
    }

    const scores = game.teams.map(t => ({
      teamId: t.id,
      points: t.score
    }));

    return { correctChoiceId: correctChoice.id, scores, pointChanges };
  }

  // =====================================
  // ROUND END
  // =====================================

  endRound(gameId: string): RoundResult | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    const round = this.getCurrentRound(gameId);
    if (!round) return null;

    round.status = 'completed';

    // Calculate round scores
    const result: RoundResult = {
      roundId: round.id,
      roundType: round.config.type,
      teamScores: game.teams.map(t => ({
        teamId: t.id,
        pointsEarned: 0 // Would need to track this during round
      }))
    };

    game.roundResults.push(result);
    return result;
  }

  // =====================================
  // GAME END
  // =====================================

  pauseGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'playing') return false;

    game.status = 'paused';
    this.clearAllTimers(gameId);
    return true;
  }

  resumeGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'paused') return false;

    game.status = 'playing';
    return true;
  }

  endGame(gameId: string): Team[] | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    game.status = 'finished';
    this.clearAllTimers(gameId);

    // Sort teams by score
    return [...game.teams].sort((a, b) => b.score - a.score);
  }

  // =====================================
  // TIMER MANAGEMENT
  // =====================================

  setTimer(gameId: string, callback: () => void, ms: number, timerId?: string): string {
    const id = timerId || uuidv4();
    const key = `${gameId}:${id}`;

    this.clearTimer(gameId, id);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      callback();
    }, ms);
    this.timers.set(key, timer);

    return id;
  }

  clearTimer(gameId: string, timerId: string): void {
    const key = `${gameId}:${timerId}`;
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  clearAllTimers(gameId: string): void {
    for (const [key, timer] of this.timers) {
      if (key.startsWith(gameId)) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    }
    for (const [key, timer] of this.hotPotatoTimers) {
      if (key.startsWith(gameId)) {
        clearTimeout(timer);
        this.hotPotatoTimers.delete(key);
      }
    }
  }

  // =====================================
  // CLEANUP
  // =====================================

  deleteGame(gameId: string): boolean {
    this.clearAllTimers(gameId);
    return this.games.delete(gameId);
  }
}

export const gameEngine = new GameEngine();

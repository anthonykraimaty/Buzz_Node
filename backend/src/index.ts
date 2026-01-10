import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { BuzzController, BuzzEvent as ControllerBuzzEvent } from './buzz-controller';
import { gameEngine } from './game-engine';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  SoundEffect
} from './types';
import { Game } from './models/Game';

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: {
    origin: true, // Allow all origins for LAN access
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from the media folder (for local images)
// Place images in backend/media/ and reference as http://localhost:3005/media/image.jpg
app.use('/media', express.static(path.join(__dirname, '../media')));

// MongoDB Connection (optional - will work without it)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/buzzgame';
mongoose.connect(MONGODB_URI).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.log('MongoDB not available, running in memory-only mode');
});

// Track the currently active game (only one game active at a time)
let activeGameId: string | null = null;

// Helper to set active game and notify all clients
function setActiveGame(gameId: string | null) {
  activeGameId = gameId;
  if (gameId) {
    const game = gameEngine.getGame(gameId);
    if (game) {
      // Join ALL connected sockets to this game room and set their gameId
      const sockets = io.sockets.sockets;
      sockets.forEach((socket) => {
        socket.data.gameId = gameId;
        socket.join(gameId);
      });
      io.emit('activeGameChanged', game);
      console.log(`🎯 Active game set: ${game.name} (${gameId}) - ${sockets.size} clients joined`);
    }
  } else {
    io.emit('activeGameCleared');
    console.log('🎯 Active game cleared');
  }
}

// Initialize Buzz Controller
const buzzController = new BuzzController();

// Debug: List all HID devices
console.log('\n=== HID Devices ===');
const devices = BuzzController.listDevices();
devices.forEach(d => {
  console.log(`${d.manufacturer || 'Unknown'} - ${d.product || 'Unknown'} (VID: ${d.vendorId?.toString(16)}, PID: ${d.productId?.toString(16)})`);
});
console.log('==================\n');

// Helper function to emit sound effects
function emitSound(gameId: string, sound: SoundEffect) {
  io.to(gameId).emit('soundEffect', sound);
}

// Helper function to emit player's custom buzzer sound
function emitPlayerBuzzerSound(gameId: string, controllerIndex: number) {
  const game = gameEngine.getGame(gameId);
  if (!game) return;

  // Find the player by controller index
  const player = game.teams
    .flatMap(t => t.players)
    .find(p => p.controllerIndex === controllerIndex);

  const buzzerSound = player?.buzzerSound || 'buzz';
  io.to(gameId).emit('playerBuzzerSound', buzzerSound, player?.id || '');
}

// Auto-advance timers for smoother game flow
const autoAdvanceTimers: Map<string, NodeJS.Timeout> = new Map();

// Auto-show points animation timers
const autoShowPointsTimers: Map<string, NodeJS.Timeout> = new Map();

// Fastest finger turn timers
const fastestFingerTimers: Map<string, NodeJS.Timeout> = new Map();

// Steal Points answer timers
const stealPointsTimers: Map<string, NodeJS.Timeout> = new Map();

// Hot Potato bomb timers
const hotPotatoTimers: Map<string, NodeJS.Timeout> = new Map();

// Question timer intervals (separate from the timeout)
const questionTimerIntervals: Map<string, NodeJS.Timeout> = new Map();

function clearQuestionTimerInterval(gameId: string) {
  const interval = questionTimerIntervals.get(gameId);
  if (interval) {
    clearInterval(interval);
    questionTimerIntervals.delete(gameId);
  }
}

function clearAutoAdvanceTimer(gameId: string) {
  const timer = autoAdvanceTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    autoAdvanceTimers.delete(gameId);
  }
}

function clearAutoShowPointsTimer(gameId: string) {
  const timer = autoShowPointsTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    autoShowPointsTimers.delete(gameId);
  }
}

function clearHotPotatoTimer(gameId: string) {
  const timer = hotPotatoTimers.get(gameId);
  if (timer) {
    clearInterval(timer);
    hotPotatoTimers.delete(gameId);
  }
}

function startHotPotatoBombTimer(gameId: string) {
  clearHotPotatoTimer(gameId);

  const game = gameEngine.getGame(gameId);
  if (!game || !game.hotPotatoState) return;

  console.log(`[HOT-POTATO] Starting bomb timer: ${game.hotPotatoState.bombTimeLeft}s`);

  // Tick every second
  const timer = setInterval(() => {
    const currentGame = gameEngine.getGame(gameId);
    if (!currentGame || !currentGame.hotPotatoState || currentGame.hotPotatoState.phase === 'exploded') {
      clearHotPotatoTimer(gameId);
      return;
    }

    // Don't tick during passing phase (timer pauses while selecting target)
    if (currentGame.hotPotatoState.phase === 'passing') {
      return;
    }

    const timeLeft = gameEngine.tickHotPotatoTimer(gameId);
    io.to(gameId).emit('hotPotatoTick', timeLeft);

    if (timeLeft <= 3 && timeLeft > 0) {
      emitSound(gameId, 'countdown');
    }

    if (timeLeft <= 0) {
      clearHotPotatoTimer(gameId);

      // Get question history before explosion (it will be preserved in state)
      const questionHistory = currentGame.hotPotatoState?.questionHistory || [];

      // BOOM! Bomb explodes
      const explosionResult = gameEngine.explodeBomb(gameId);
      if (explosionResult) {
        console.log(`[HOT-POTATO] BOOM! ${explosionResult.playerName} loses ${explosionResult.penalty} points`);
        emitSound(gameId, 'wrong'); // Explosion sound

        // Send explosion with question history
        io.to(gameId).emit('hotPotatoExplode', {
          ...explosionResult,
          questionHistory
        });
        io.to(gameId).emit('gameState', currentGame);
        buzzController.allLightsOff();

        // Don't auto-advance - host will start next bomb cycle manually
        // This allows players to review the questions that were asked
      }
    }
  }, 1000);

  hotPotatoTimers.set(gameId, timer);
}

function scheduleAutoShowPoints(gameId: string) {
  const game = gameEngine.getGame(gameId);
  if (!game || !game.settings.autoShowPoints) return;

  clearAutoShowPointsTimer(gameId);
  const timer = setTimeout(() => {
    const currentGame = gameEngine.getGame(gameId);
    if (currentGame && currentGame.answerRevealed && currentGame.status === 'playing') {
      // Build point changes from player answers
      const answerMap = new Map<string, number>();
      currentGame.playerAnswers.forEach(answer => {
        const current = answerMap.get(answer.teamId) || 0;
        answerMap.set(answer.teamId, current + answer.pointsEarned);
      });

      const pointChanges = currentGame.teams.map(team => {
        const change = answerMap.get(team.id) || 0;
        const newScore = team.score;
        const oldScore = newScore - change;
        return {
          teamId: team.id,
          teamName: team.players[0]?.name || team.name,
          teamColor: team.color || '#888',
          change,
          oldScore: Math.max(0, oldScore),
          newScore
        };
      });

      const hasPointChanges = pointChanges.some(pc => pc.change !== 0);
      if (hasPointChanges) {
        emitSound(gameId, 'correct');
      }

      io.to(gameId).emit('showPointsAnimation', pointChanges);

      // Schedule auto-next after showing points
      scheduleAutoNext(gameId);
    }
  }, game.settings.autoShowPointsDelayMs);
  autoShowPointsTimers.set(gameId, timer);
}

function clearFastestFingerTimer(gameId: string) {
  const timer = fastestFingerTimers.get(gameId);
  if (timer) {
    clearInterval(timer);
    fastestFingerTimers.delete(gameId);
  }
}

function startFastestFingerTurnTimer(gameId: string) {
  const game = gameEngine.getGame(gameId);
  if (!game || !game.fastestFingerState) return;

  clearFastestFingerTimer(gameId);

  const timer = setInterval(() => {
    const currentGame = gameEngine.getGame(gameId);
    if (!currentGame || !currentGame.fastestFingerState || currentGame.answerRevealed) {
      clearFastestFingerTimer(gameId);
      return;
    }

    const state = currentGame.fastestFingerState;
    state.answerTimeLeft--;

    // Emit the updated timer to clients
    io.to(gameId).emit('fastestFingerUpdate', state);
    io.to(gameId).emit('gameState', currentGame);

    // Tick sound for countdown
    if (state.answerTimeLeft > 0) {
      emitSound(gameId, 'tick');
    }

    // Time's up - buzzer didn't answer in time (treated as wrong answer with penalty)
    if (state.answerTimeLeft <= 0) {
      clearFastestFingerTimer(gameId);

      // NOTE: Penalty is NOT applied here - it will be applied when answer is revealed
      // This prevents the scoreboard from giving away the timeout before the reveal
      // Store a "timeout" answer so the penalty can be tracked
      const buzzer = currentGame.buzzedPlayers[0];
      if (buzzer) {
        // Add a timeout answer with penalty points
        currentGame.playerAnswers.push({
          playerId: buzzer.playerId,
          teamId: buzzer.teamId,
          choiceId: 'timeout', // Special marker for timeout
          timestamp: Date.now(),
          responseTime: 0,
          isCorrect: false,
          pointsEarned: -250 // Timeout penalty
        });
        console.log(`[FASTEST-FINGER] Timeout - penalty will be applied on reveal`);
      }

      // Turn off lights
      buzzController.allLightsOff();

      // Reveal answer and move on (penalty applied during reveal)
      io.to(gameId).emit('fastestFingerTurnTimeout');
      emitSound(gameId, 'wrong');
      // NOTE: Don't emit gameState here - wait for reveal to prevent scoreboard spoiler
      scheduleAutoReveal(gameId);
    }
  }, 1000);

  fastestFingerTimers.set(gameId, timer);
}

function clearStealPointsTimer(gameId: string) {
  const timer = stealPointsTimers.get(gameId);
  if (timer) {
    clearInterval(timer);
    stealPointsTimers.delete(gameId);
  }
}

function startStealPointsTurnTimer(gameId: string) {
  const game = gameEngine.getGame(gameId);
  if (!game || !game.stealPointsState) return;

  clearStealPointsTimer(gameId);

  const timer = setInterval(() => {
    const currentGame = gameEngine.getGame(gameId);
    if (!currentGame || !currentGame.stealPointsState || currentGame.answerRevealed) {
      clearStealPointsTimer(gameId);
      return;
    }

    const state = currentGame.stealPointsState;
    state.answerTimeLeft--;

    // Emit the updated timer to clients
    io.to(gameId).emit('stealPointsUpdate', state);
    io.to(gameId).emit('gameState', currentGame);

    // Tick sound for countdown
    if (state.answerTimeLeft > 0) {
      emitSound(gameId, 'tick');
    }

    // Time's up - buzzer didn't answer in time (treated as wrong answer with penalty)
    if (state.answerTimeLeft <= 0) {
      clearStealPointsTimer(gameId);

      // Store a "timeout" answer so the penalty can be tracked
      const buzzer = currentGame.buzzedPlayers[0];
      if (buzzer) {
        // Add a timeout answer with penalty points
        currentGame.playerAnswers.push({
          playerId: buzzer.playerId,
          teamId: buzzer.teamId,
          choiceId: 'timeout', // Special marker for timeout
          timestamp: Date.now(),
          responseTime: 0,
          isCorrect: false,
          pointsEarned: -500 // Point Heist timeout penalty
        });
        console.log(`[STEAL-POINTS] Timeout - penalty will be applied on reveal`);
      }

      // Turn off lights
      buzzController.allLightsOff();

      // Reveal answer and move on (penalty applied during reveal)
      emitSound(gameId, 'wrong');
      scheduleAutoReveal(gameId);
    }
  }, 1000);

  stealPointsTimers.set(gameId, timer);
}

function scheduleAutoReveal(gameId: string) {
  const game = gameEngine.getGame(gameId);
  if (!game || !game.settings.autoRevealAnswer) return;

  clearAutoAdvanceTimer(gameId);
  const timer = setTimeout(() => {
    const currentGame = gameEngine.getGame(gameId);
    if (currentGame && currentGame.currentQuestion && !currentGame.answerRevealed && currentGame.status === 'playing') {
      const round = currentGame.rounds[currentGame.currentRoundIndex];
      const result = gameEngine.revealAnswer(gameId);
      if (result) {
        emitSound(gameId, 'dramatic');
        io.to(gameId).emit('answerRevealed', result.correctChoiceId, result.scores, result.pointChanges);
        io.to(gameId).emit('gameState', currentGame);

        // Check if this is steal-points round with a correct answer - start announcing phase
        if (round?.config.type === 'steal-points' && currentGame.stealPointsState) {
          const correctAnswer = currentGame.playerAnswers.find(a => a.isCorrect);
          if (correctAnswer) {
            // Start announcing phase - show who will steal before target selection
            gameEngine.startAnnouncingPhase(gameId);
            // Only light up the winner's buzzer (the one who answered correctly)
            const winnerControllerIndex = currentGame.stealPointsState.buzzerControllerIndex;
            if (winnerControllerIndex) {
              const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
              lights[winnerControllerIndex - 1] = true;
              buzzController.setLights(lights);
            }
            io.to(gameId).emit('stealPointsUpdate', currentGame.stealPointsState);
            io.to(gameId).emit('gameState', currentGame);

            // After 4 seconds, transition to stealing phase
            setTimeout(() => {
              const game = gameEngine.getGame(gameId);
              if (game && game.stealPointsState?.phase === 'announcing') {
                gameEngine.startStealPhase(gameId);
                io.to(gameId).emit('stealPointsUpdate', game.stealPointsState);
                io.to(gameId).emit('gameState', game);
                emitSound(gameId, 'buzz'); // Alert sound for steal selection
              }
            }, 4000);

            // Don't schedule next - wait for steal target selection
            return;
          }
        }

        // Schedule auto-show points if enabled, otherwise schedule auto-next
        if (currentGame.settings.autoShowPoints) {
          scheduleAutoShowPoints(gameId);
        } else {
          scheduleAutoNext(gameId);
        }
      }
    }
  }, game.settings.autoRevealDelayMs);
  autoAdvanceTimers.set(gameId, timer);
}

// Fast next question for Hot Potato wrong answers (500ms delay)
function scheduleHotPotatoQuickNext(gameId: string) {
  const game = gameEngine.getGame(gameId);
  if (!game) return;

  clearAutoAdvanceTimer(gameId);
  const timer = setTimeout(() => {
    const currentGame = gameEngine.getGame(gameId);
    if (currentGame && currentGame.status === 'playing' && currentGame.hotPotatoState?.phase === 'playing') {
      // Clear any pending timers from previous question
      clearQuestionTimerInterval(gameId);

      const result = gameEngine.startQuestion(gameId);
      if (result) {
        io.to(gameId).emit('questionStart', result.question, result.roundConfig);
        io.to(gameId).emit('gameState', currentGame);

        // Only light up the bomb holder's button
        const holder = gameEngine.getHotPotatoHolder(gameId);
        if (holder) {
          const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
          lights[holder.controllerIndex - 1] = true;
          buzzController.setLights(lights);
        }

        // Save current question index to MongoDB
        Game.findOneAndUpdate({ gameId }, {
          rounds: currentGame.rounds,
          currentRoundIndex: currentGame.currentRoundIndex
        }).catch(() => { });

        // Note: No separate timer for hot potato - the bomb timer handles everything
      } else {
        // No more questions - end round
        const roundResult = gameEngine.endRound(gameId);
        if (roundResult) {
          clearHotPotatoTimer(gameId);
          emitSound(gameId, 'round-end');
          io.to(gameId).emit('roundEnd', roundResult);
          io.to(gameId).emit('gameState', currentGame);
          scheduleAutoNextRound(gameId);
        }
      }
    }
  }, 500); // Quick 500ms delay for visual feedback
  autoAdvanceTimers.set(gameId, timer);
}

function scheduleAutoNext(gameId: string) {
  const game = gameEngine.getGame(gameId);
  if (!game || !game.settings.autoNextQuestion) return;

  clearAutoAdvanceTimer(gameId);
  const timer = setTimeout(() => {
    const currentGame = gameEngine.getGame(gameId);
    if (currentGame && currentGame.answerRevealed && currentGame.status === 'playing') {
      // Clear any pending timers from previous question
      clearQuestionTimerInterval(gameId);
      clearFastestFingerTimer(gameId);

      const result = gameEngine.startQuestion(gameId);
      if (result) {
        io.to(gameId).emit('questionStart', result.question, result.roundConfig);
        io.to(gameId).emit('gameState', currentGame);
        buzzController.allLightsOn();

        // Save current question index to MongoDB
        Game.findOneAndUpdate({ gameId }, {
          rounds: currentGame.rounds,
          currentRoundIndex: currentGame.currentRoundIndex
        }).catch(() => { });

        // Start timer for this question
        let timeLeft = result.roundConfig.timePerQuestion;
        const timerInterval = setInterval(() => {
          timeLeft--;
          io.to(gameId).emit('timerUpdate', timeLeft);
          if (timeLeft <= 5 && timeLeft > 0) {
            emitSound(gameId, 'tick');
          }
          if (timeLeft <= 0) {
            clearQuestionTimerInterval(gameId);

            // Set timer expired to block new answers
            gameEngine.setTimerExpired(gameId, true);
            emitSound(gameId, 'countdown');

            // Turn off all buzzer lights when time expires
            buzzController.allLightsOff();

            // Emit timeUp event first, then gameState
            io.to(gameId).emit('timeUp');
            io.to(gameId).emit('gameState', currentGame);
            // Auto-reveal when time runs out (for fastest-finger: no one buzzed = 0 points)
            scheduleAutoReveal(gameId);
          }
        }, 1000);

        // Store the interval so we can clear it when someone buzzes in fastest finger
        questionTimerIntervals.set(gameId, timerInterval);
      } else {
        // No more questions - end round and auto-advance to next round
        const roundResult = gameEngine.endRound(gameId);
        if (roundResult) {
          emitSound(gameId, 'round-end');
          io.to(gameId).emit('roundEnd', roundResult);
          io.to(gameId).emit('gameState', currentGame);

          // Schedule auto-advance to next round
          scheduleAutoNextRound(gameId);
        }
      }
    }
  }, game.settings.autoNextDelayMs);
  autoAdvanceTimers.set(gameId, timer);
}

function scheduleAutoNextRound(gameId: string) {
  const game = gameEngine.getGame(gameId);
  if (!game || !game.settings.autoNextQuestion) return;

  clearAutoAdvanceTimer(gameId);
  const timer = setTimeout(() => {
    const currentGame = gameEngine.getGame(gameId);
    if (!currentGame || currentGame.status !== 'playing') return;

    // Find the next round with questions
    let nextRoundIndex = currentGame.currentRoundIndex + 1;
    while (nextRoundIndex < currentGame.rounds.length) {
      if (currentGame.rounds[nextRoundIndex].questions.length > 0) {
        break;
      }
      nextRoundIndex++;
    }

    if (nextRoundIndex < currentGame.rounds.length) {
      // Start the next round
      const round = gameEngine.startRound(gameId, nextRoundIndex);
      if (round) {
        emitSound(gameId, 'round-start');
        io.to(gameId).emit('roundStart', round);
        io.to(gameId).emit('gameState', currentGame);
        buzzController.allLightsOn();

        // Auto-start first question after a brief delay
        scheduleAutoNext(gameId);
      }
    } else {
      // No more rounds - end the game
      const finalScores = gameEngine.endGame(gameId);
      if (finalScores) {
        emitSound(gameId, 'game-over');
        io.to(gameId).emit('gameOver', finalScores);
        io.to(gameId).emit('gameState', currentGame);
        buzzController.allLightsOff();
      }
    }
  }, game.settings.autoNextDelayMs);
  autoAdvanceTimers.set(gameId, timer);
}

// Buzz controller event handlers
buzzController.on('connected', () => {
  console.log('🎮 Buzz Controller connected!');
  io.emit('controllerConnected');
  buzzController.allLightsOn();
  setTimeout(() => buzzController.allLightsOff(), 1000);
});

buzzController.on('disconnected', () => {
  console.log('🎮 Buzz Controller disconnected');
  io.emit('controllerDisconnected');
});

buzzController.on('press', (event: ControllerBuzzEvent) => {
  console.log(`🔴 Player ${event.player} pressed ${event.button}`);

  // Emit raw button press for testing/debugging (works without active game)
  io.emit('buttonPress', { player: event.player, button: event.button, timestamp: Date.now() });

  // Handle input for active games
  const games = gameEngine.getAllGames();
  console.log(`[PRESS] Checking ${games.length} games for button press`);

  for (const game of games) {
    console.log(`[PRESS] Game "${game.name}": status=${game.status}, hasQuestion=${!!game.currentQuestion}`);

    if (game.status !== 'playing') {
      console.log(`[PRESS] Skipping game: status is ${game.status}`);
      continue;
    }

    const round = gameEngine.getCurrentRound(game.id);
    console.log(`[PRESS] Round: ${round?.config.name || 'none'}, status=${round?.status}, type=${round?.config.type}`);

    if (!round || round.status !== 'active') {
      console.log(`[PRESS] Skipping: round not active`);
      continue;
    }

    if (event.button === 'red') {
      // BUZZ IN - but block for multiple-choice, true-false, picture-sound, speed-race, and hot-potato rounds (no buzzing needed)
      if (round.config.type === 'multiple-choice' || round.config.type === 'true-false' || round.config.type === 'picture-sound' || round.config.type === 'speed-race' || round.config.type === 'hot-potato') {
        // These round types don't use buzzing - players answer directly with colored buttons
        // Red button is ignored
        console.log(`[PRESS] Red button ignored for ${round.config.type} round`);
        continue;
      }

      // Block buzzing when timer has expired
      if (game.timerExpired) {
        console.log(`[PRESS] Buzz rejected - timer expired`);
        continue;
      }

      console.log(`[PRESS] Calling handleBuzz for game ${game.id}`);
      const buzzResult = gameEngine.handleBuzz(game.id, event.player);

      if (buzzResult) {
        // Play player's custom buzzer sound
        emitPlayerBuzzerSound(game.id, event.player);
        io.to(game.id).emit('buzzEvent', buzzResult);
        io.to(game.id).emit('gameState', game);

        // For fastest-finger rounds: FIRST BUZZ WINS - immediately start answer phase
        if (round.config.type === 'fastest-finger' && game.fastestFingerState) {
          io.to(game.id).emit('fastestFingerUpdate', game.fastestFingerState);

          if (game.fastestFingerState.phase === 'answering') {
            // First buzz locked in! Clear question timer and start answer timer
            gameEngine.clearTimer(game.id, 'question');
            clearQuestionTimerInterval(game.id);

            // Turn off all other buzzers - only winner's light stays on
            const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
            lights[event.player - 1] = true;
            buzzController.setLights(lights);

            // Start the answer timer (3 seconds)
            startFastestFingerTurnTimer(game.id);
          }
        } else if (round.config.type === 'steal-points' && game.stealPointsState) {
          // For steal-points: first buzzer gets to answer, others are turned off
          // Clear the question timer - buzzer now has time to answer
          gameEngine.clearTimer(game.id, 'question');
          clearQuestionTimerInterval(game.id);

          io.to(game.id).emit('stealPointsUpdate', game.stealPointsState);

          // Only the buzzer's light stays on, turn off all others
          const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
          lights[event.player - 1] = true;
          buzzController.setLights(lights);

          // Start the answer timer (5 seconds)
          startStealPointsTurnTimer(game.id);
        } else if (round.config.type === 'final' && buzzResult.isFirst) {
          // For final round: first buzzer gets to answer, turn off all other lights
          // Clear the question timer - buzzer now has time to answer
          gameEngine.clearTimer(game.id, 'question');
          clearQuestionTimerInterval(game.id);

          console.log(`[FINAL] First buzz by controller ${event.player} - only they can answer`);
          const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
          lights[event.player - 1] = true;
          buzzController.setLights(lights);
        } else {
          // Other modes: just light up the buzzer
          const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
          lights[event.player - 1] = true;
          buzzController.setLights(lights);
        }
      }
    } else if (round.config.type === 'steal-points' && game.stealPointsState?.phase === 'stealing') {
      // STEAL TARGET SELECTION - handle separately since answer is already revealed
      console.log(`[STEAL] Stealing phase detected! Button: ${event.button}, Controller: ${event.player}`);
      console.log(`[STEAL] Buzzer: playerId=${game.stealPointsState.buzzerPlayerId}, teamId=${game.stealPointsState.buzzerTeamId}, controllerIndex=${game.stealPointsState.buzzerControllerIndex}`);

      // Only the buzzer can select a target - use buzzerControllerIndex directly
      const isBuzzer = event.player === game.stealPointsState.buzzerControllerIndex;
      console.log(`[STEAL] Is buzzer? ${isBuzzer} (controller ${event.player} === buzzerControllerIndex ${game.stealPointsState.buzzerControllerIndex})`);

      if (!isBuzzer) {
        console.log(`[STEAL] REJECTED: Not the buzzer's controller`);
        continue; // Only the winner can select
      }

      // Map button color to team: blue=team0, orange=team1, green=team2, yellow=team3
      const buttonToTeamIndex: Record<string, number> = { blue: 0, orange: 1, green: 2, yellow: 3 };
      const teamIndex = buttonToTeamIndex[event.button];
      const targetTeamByIndex = game.teams[teamIndex];

      console.log(`[STEAL] Button ${event.button} -> teamIndex ${teamIndex}`);
      console.log(`[STEAL] Target team: ${targetTeamByIndex ? targetTeamByIndex.name : 'NOT FOUND'} (id: ${targetTeamByIndex?.id})`);
      console.log(`[STEAL] Buzzer team: ${game.stealPointsState.buzzerTeamId}`);
      console.log(`[STEAL] Is valid target? ${targetTeamByIndex && targetTeamByIndex.id !== game.stealPointsState.buzzerTeamId}`);

      if (targetTeamByIndex && targetTeamByIndex.id !== game.stealPointsState.buzzerTeamId) {
        console.log(`[STEAL] Executing steal from ${targetTeamByIndex.name}!`);
        const stealResult = gameEngine.executeSteal(game.id, targetTeamByIndex.id);
        if (stealResult) {
          console.log(`[STEAL] Steal successful!`, stealResult);
          emitSound(game.id, 'steal');
          io.to(game.id).emit('stealExecuted', stealResult);
          io.to(game.id).emit('gameState', game);
          buzzController.allLightsOff();

          // Respect auto settings
          if (game.settings.autoShowPoints) {
            scheduleAutoShowPoints(game.id);
          } else if (game.settings.autoNextQuestion) {
            scheduleAutoNext(game.id);
          }
        }
      } else {
        console.log(`[STEAL] Target selection failed - no valid target team for button ${event.button}`);
        if (!targetTeamByIndex) {
          console.log(`[STEAL] Reason: No team at index ${teamIndex}`);
        } else if (targetTeamByIndex.id === game.stealPointsState.buzzerTeamId) {
          console.log(`[STEAL] Reason: Can't steal from own team`);
        }
      }
    } else if (game.currentQuestion && !game.answerRevealed) {
      // ANSWER with colored button

      // Block answers when timer has expired
      if (game.timerExpired) {
        console.log(`[PRESS] Answer rejected - timer expired`);
        continue;
      }

      // For fastest-finger mode, silently ignore button presses during buzzing phase or from non-current-turn players
      if (round.config.type === 'fastest-finger' && game.fastestFingerState) {
        // During buzzing phase, no answers allowed
        if (game.fastestFingerState.phase === 'buzzing') {
          continue; // Completely ignore - still waiting for all teams to buzz
        }

        // Block answers when the fastest-finger answer timer has expired
        if (game.fastestFingerState.answerTimeLeft <= 0) {
          console.log(`[PRESS] Answer rejected - fastest finger answer timer expired`);
          continue;
        }

        const currentBuzzer = game.buzzedPlayers[game.fastestFingerState.currentTurnIndex];
        // Find player by controller index
        const pressedPlayer = game.teams
          .flatMap(t => t.players)
          .find(p => p.controllerIndex === event.player);

        // If it's not the current turn player, silently ignore
        if (!currentBuzzer || !pressedPlayer || currentBuzzer.playerId !== pressedPlayer.id) {
          continue; // Completely ignore - no sound, no light, no feedback
        }

        // Also check if this player has been eliminated
        if (game.fastestFingerState.eliminatedPlayers.includes(pressedPlayer.id)) {
          continue; // Eliminated players are also ignored
        }
      }

      // For steal-points mode, only allow the buzzer to answer during answering phase
      if (round.config.type === 'steal-points' && game.stealPointsState) {
        // During buzzing phase, no answers allowed (only red button buzzes)
        if (game.stealPointsState.phase === 'buzzing') {
          continue; // Completely ignore - waiting for someone to buzz
        }

        // During answering phase, only the buzzer can answer
        const pressedPlayer = game.teams
          .flatMap(t => t.players)
          .find(p => p.controllerIndex === event.player);

        if (!pressedPlayer || pressedPlayer.id !== game.stealPointsState.buzzerPlayerId) {
          continue; // Only the buzzer can answer
        }
      }

      // For final round, require buzzing first - only the first buzzer can answer
      if (round.config.type === 'final') {
        // Must have buzzed first
        if (game.buzzedPlayers.length === 0) {
          console.log(`[PRESS] Answer rejected for final round - no one has buzzed yet`);
          continue; // No one has buzzed yet - ignore colored button presses
        }

        // Only the first buzzer can answer
        const firstBuzzer = game.buzzedPlayers[0];
        const pressedPlayer = game.teams
          .flatMap(t => t.players)
          .find(p => p.controllerIndex === event.player);

        if (!pressedPlayer || pressedPlayer.id !== firstBuzzer.playerId) {
          console.log(`[PRESS] Answer rejected for final round - not the first buzzer`);
          continue; // Only the first buzzer can answer
        }
      }

      // For hot-potato mode, only the bomb holder can answer during playing phase
      if (round.config.type === 'hot-potato' && game.hotPotatoState) {
        // During passing phase, colored buttons select target (handled separately)
        if (game.hotPotatoState.phase === 'passing') {
          console.log(`[HOT-POTATO] Passing phase - button ${event.button} pressed by controller ${event.player}`);
          const pressedPlayer = game.teams
            .flatMap(t => t.players)
            .find(p => p.controllerIndex === event.player);

          // Only the player who just answered correctly can pass
          if (pressedPlayer && pressedPlayer.id === game.hotPotatoState.lastCorrectAnswerId) {
            // Map button to target player (by controller index)
            const buttonToController: Record<string, number> = { blue: 1, orange: 2, green: 3, yellow: 4 };
            const targetControllerIndex = buttonToController[event.button];

            // Find player with that controller
            const targetPlayer = game.teams
              .flatMap(t => t.players)
              .find(p => p.controllerIndex === targetControllerIndex);

            if (targetPlayer && targetPlayer.id !== pressedPlayer.id) {
              // Pass the bomb
              const passResult = gameEngine.passHotPotatoTo(game.id, targetPlayer.id);
              if (passResult) {
                // Award points for correct answer NOW (after passing, so scoreboard doesn't give it away)
                const passerTeam = game.teams.find(t => t.players.some(p => p.id === pressedPlayer.id));
                if (passerTeam) {
                  passerTeam.score += 250; // Correct answer reward
                }

                console.log(`[HOT-POTATO] Bomb passed to ${passResult.newHolderName}`);
                emitSound(game.id, 'buzz');
                io.to(game.id).emit('hotPotatoUpdate', game.hotPotatoState);
                io.to(game.id).emit('gameState', game);

                // Light up new holder's buzzer
                const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
                lights[targetControllerIndex - 1] = true;
                buzzController.setLights(lights);

                // Move to next question (use hot potato quick next since answerRevealed is false)
                scheduleHotPotatoQuickNext(game.id);
              }
            }
          }
          continue;
        }

        // During playing phase, only bomb holder can answer
        if (game.hotPotatoState.phase === 'playing') {
          const pressedPlayer = game.teams
            .flatMap(t => t.players)
            .find(p => p.controllerIndex === event.player);

          if (!pressedPlayer || pressedPlayer.id !== game.hotPotatoState.currentHolderId) {
            console.log(`[HOT-POTATO] Rejected: ${pressedPlayer?.id} is not bomb holder ${game.hotPotatoState.currentHolderId}`);
            continue; // Only bomb holder can answer
          }
        }
      }

      const answer = gameEngine.handleAnswer(game.id, event.player, event.button);

      if (answer) {
        // Play player's custom buzzer sound first
        emitPlayerBuzzerSound(game.id, event.player);
        // Then play correct/wrong sound
        emitSound(game.id, answer.isCorrect ? 'correct' : 'wrong');
        io.to(game.id).emit('gameState', game);

        // For multiple-choice/true-false/picture-sound/speed-race rounds: only turn off the answering player's light
        // For other rounds: turn off all lights on wrong answer
        if (round.config.type === 'multiple-choice' || round.config.type === 'true-false' || round.config.type === 'picture-sound' || round.config.type === 'speed-race') {
          // Turn off only this player's light (they've answered, can't change)
          buzzController.setLight(event.player as 1 | 2 | 3 | 4, false);
        } else if (answer.isCorrect) {
          buzzController.blinkLight(event.player as 1 | 2 | 3 | 4, 3, 150);
        } else {
          const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
          buzzController.setLights(lights);
        }

        // Handle fastest-finger answer - only first buzzer gets one chance
        if (round.config.type === 'fastest-finger' && game.fastestFingerState) {
          clearFastestFingerTimer(game.id);
          // Whether correct or wrong, question ends - reveal answer and move on
          // Scoring already handled above (+500 correct, -250 wrong)
          scheduleAutoReveal(game.id);
          continue;
        }

        // Handle steal-points answer
        if (round.config.type === 'steal-points' && game.stealPointsState) {
          // For both correct and wrong answers, turn off lights and schedule reveal
          // The steal phase (for correct answers) will be triggered AFTER reveal
          clearStealPointsTimer(game.id);
          buzzController.allLightsOff();
          scheduleAutoReveal(game.id);
          continue;
        }

        // Handle hot-potato answer
        if (round.config.type === 'hot-potato' && game.hotPotatoState) {
          // Record this question in history
          const correctChoice = game.currentQuestion?.choices.find(c => c.isCorrect);
          const playerChoice = game.currentQuestion?.choices.find(c => c.id === answer.choiceId);
          const playerTeam = game.teams.find(t => t.id === answer.teamId);
          const playerObj = playerTeam?.players.find(p => p.id === answer.playerId);

          gameEngine.recordHotPotatoQuestion(
            game.id,
            game.currentQuestion?.text || '',
            correctChoice?.text || '',
            playerChoice?.text || null,
            answer.isCorrect,
            playerObj?.name || 'Unknown',
            playerTeam?.color || '#888'
          );

          if (answer.isCorrect) {
            // Correct answer! Player can pass the bomb to someone else
            // NOTE: Points are awarded AFTER passing the bomb (in passHotPotatoTo handler)
            // This prevents the scoreboard from revealing the answer before the passing phase

            // Start passing phase
            gameEngine.startHotPotatoPassing(game.id, answer.playerId);
            io.to(game.id).emit('hotPotatoUpdate', game.hotPotatoState);
            io.to(game.id).emit('gameState', game);

            // Light up all OTHER controllers so the passer can choose who to pass to
            // (exclude the passer's own controller since they can't pass to themselves)
            const passer = game.teams
              .flatMap(t => t.players)
              .find(p => p.id === answer.playerId);
            if (passer) {
              const lights: [boolean, boolean, boolean, boolean] = [true, true, true, true];
              lights[passer.controllerIndex - 1] = false; // Turn off passer's controller (can't pass to self)
              buzzController.setLights(lights);
            }

            console.log(`[HOT-POTATO] Correct! ${answer.playerId} can now pass the bomb`);
          } else {
            // Wrong answer - bomb stays, next question (timer keeps running)
            console.log(`[HOT-POTATO] Wrong! Bomb stays with current holder`);
            emitSound(game.id, 'wrong');
            io.to(game.id).emit('hotPotatoUpdate', game.hotPotatoState);

            // Move to next question FAST so they get another chance
            scheduleHotPotatoQuickNext(game.id);
          }
          continue;
        }

        // Schedule auto-reveal after answer
        scheduleAutoReveal(game.id);
      }
    }
  }
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('📱 Client connected:', socket.id);

  // Send current controller status to newly connected client
  if (buzzController.connected) {
    socket.emit('controllerConnected');
  }

  // Auto-join to active game if one exists
  if (activeGameId) {
    const game = gameEngine.getGame(activeGameId);
    if (game) {
      socket.data.gameId = activeGameId;
      socket.join(activeGameId);
      socket.emit('gameState', game);
      console.log(`📱 Client ${socket.id} auto-joined active game: ${game.name}`);
    }
  }

  // Client can request the active game state
  socket.on('requestActiveGame', () => {
    if (activeGameId) {
      const game = gameEngine.getGame(activeGameId);
      if (game) {
        socket.data.gameId = activeGameId;
        socket.join(activeGameId);
        socket.emit('gameState', game);
      }
    } else {
      socket.emit('noActiveGame');
    }
  });

  // =====================================
  // GAME MANAGEMENT
  // =====================================

  socket.on('createGame', async (name) => {
    const game = gameEngine.createGame(name);
    socket.data.gameId = game.id;
    socket.data.isHost = true;
    socket.join(game.id);
    socket.emit('gameState', game);
    console.log('🎮 Game created:', game.id, '-', name);

    // Set as active game - all clients will be notified
    setActiveGame(game.id);

    // Save to MongoDB
    try {
      await Game.create({
        gameId: game.id,
        name: game.name,
        status: game.status,
        teams: game.teams,
        rounds: game.rounds,
        settings: game.settings,
        roundResults: []
      });
    } catch (e) {
      // MongoDB not available
    }
  });

  socket.on('joinGame', (gameId) => {
    const game = gameEngine.getGame(gameId);
    if (game) {
      socket.data.gameId = gameId;
      socket.join(gameId);
      socket.emit('gameState', game);
      // Set as active game when someone joins
      setActiveGame(gameId);
    } else {
      socket.emit('error', 'Game not found');
    }
  });

  socket.on('loadGame', async (gameId) => {
    try {
      // First check if game is already in memory
      let game = gameEngine.getGame(gameId);

      if (!game) {
        // Try to load from MongoDB
        const savedGame = await Game.findOne({ gameId }).lean();
        if (savedGame) {
          // Restore game from DB (use .lean() to get plain objects)
          // The rounds array contains currentQuestionIndex for each round
          game = gameEngine.restoreGame({
            id: savedGame.gameId,
            name: savedGame.name,
            status: savedGame.status,
            teams: savedGame.teams as any,
            rounds: savedGame.rounds as any,
            currentRoundIndex: savedGame.currentRoundIndex,
            settings: savedGame.settings as any,
            roundResults: (savedGame.roundResults || []) as any,
            currentQuestion: null,
            buzzedPlayers: [],
            playerAnswers: [],
            answerRevealed: false,
            timerExpired: false,
            questionStartTime: null
          });
        }
      }

      if (game) {
        socket.data.gameId = game.id;
        socket.data.isHost = true;
        socket.join(game.id);
        socket.emit('gameState', game);
        // Set as active game - all clients will be notified
        setActiveGame(game.id);
        console.log('🎮 Game loaded:', game.id, '-', game.name);

        // Save any fixes (e.g., corrected indexes, migrated team colors) back to MongoDB
        Game.findOneAndUpdate({ gameId: game.id }, {
          rounds: game.rounds,
          teams: game.teams
        }).catch(() => { });
      } else {
        socket.emit('error', 'Game not found');
      }
    } catch (e) {
      console.error('Failed to load game:', e);
      socket.emit('error', 'Failed to load game');
    }
  });

  socket.on('listGames', async () => {
    try {
      const games = await Game.find({}).sort({ updatedAt: -1 }).limit(20);
      const gamesList = games.map(g => ({
        gameId: g.gameId,
        name: g.name,
        status: g.status,
        teamCount: g.teams?.length || 0,
        questionCount: g.rounds?.reduce((sum, r) => sum + (r.questions?.length || 0), 0) || 0,
        createdAt: g.createdAt?.toISOString() || '',
        updatedAt: g.updatedAt?.toISOString() || ''
      }));
      socket.emit('gamesList', gamesList);
    } catch (e) {
      // MongoDB not available
      socket.emit('gamesList', []);
    }
  });

  // =====================================
  // TEAM MANAGEMENT
  // =====================================

  socket.on('addTeam', async (teamData) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const team = gameEngine.addTeam(gameId, teamData);
    if (team) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { teams: game.teams }
        );
      } catch (e) {
        // MongoDB not available
      }
    }
  });

  socket.on('removeTeam', async (teamId) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    if (gameEngine.removeTeam(gameId, teamId)) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { teams: game.teams }
        );
      } catch (e) {
        // MongoDB not available
      }
    }
  });

  socket.on('updateTeam', async (team) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    if (gameEngine.updateTeam(gameId, team)) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { teams: game.teams }
        );
      } catch (e) {
        // MongoDB not available
      }
    }
  });

  socket.on('adjustScore', (teamId, points) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const team = gameEngine.adjustScore(gameId, teamId, points);
    if (team) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);
    }
  });

  // =====================================
  // SETTINGS
  // =====================================

  socket.on('updateSettings', async (settings) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const game = gameEngine.getGame(gameId);
    if (!game) return;

    // Update settings
    game.settings = { ...game.settings, ...settings };
    io.to(gameId).emit('gameState', game);

    // Save to MongoDB
    try {
      await Game.findOneAndUpdate(
        { gameId },
        { settings: game.settings }
      );
    } catch (e) {
      // MongoDB not available
    }
  });

  // =====================================
  // ROUND CONFIGURATION
  // =====================================

  socket.on('setRounds', async (configs) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    if (gameEngine.setRounds(gameId, configs)) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { rounds: game.rounds }
        );
      } catch (e) {
        // MongoDB not available
      }
    }
  });

  socket.on('updateRoundConfig', async (roundId, configUpdates) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const game = gameEngine.getGame(gameId);
    if (!game) return;

    const round = game.rounds.find(r => r.id === roundId);
    if (!round) return;

    // Update the round config with the provided values
    Object.assign(round.config, configUpdates);

    io.to(gameId).emit('gameState', game);

    // Save to MongoDB
    try {
      await Game.findOneAndUpdate(
        { gameId },
        { rounds: game.rounds }
      );
    } catch (e) {
      // MongoDB not available
    }
  });

  // =====================================
  // QUESTION MANAGEMENT
  // =====================================

  socket.on('addQuestion', async (roundId, questionData) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const question = gameEngine.addQuestion(gameId, roundId, questionData);
    if (question) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { rounds: game.rounds }
        );
      } catch (e) {
        // MongoDB not available
      }
    }
  });

  socket.on('removeQuestion', async (roundId, questionId) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    if (gameEngine.removeQuestion(gameId, roundId, questionId)) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { rounds: game.rounds }
        );
      } catch (e) {
        // MongoDB not available
      }
    }
  });

  socket.on('updateQuestion', async (roundId, question) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    if (gameEngine.updateQuestion(gameId, roundId, question)) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { rounds: game.rounds }
        );
      } catch (e) {
        // MongoDB not available
      }
    }
  });

  socket.on('importQuestions', async (roundId, questions) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    gameEngine.importQuestions(gameId, roundId, questions);
    const game = gameEngine.getGame(gameId)!;
    io.to(gameId).emit('gameState', game);

    // Save to MongoDB
    try {
      await Game.findOneAndUpdate(
        { gameId },
        { rounds: game.rounds }
      );
    } catch (e) {
      // MongoDB not available
    }
  });

  // =====================================
  // GAME FLOW
  // =====================================

  socket.on('startGame', async () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    if (gameEngine.startGame(gameId)) {
      const game = gameEngine.getGame(gameId)!;
      emitSound(gameId, 'round-start');
      io.to(gameId).emit('gameState', game);
      buzzController.allLightsOn();

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { status: game.status, currentRoundIndex: game.currentRoundIndex, teams: game.teams }
        );
      } catch (e) { }
    }
  });

  socket.on('startRound', async (roundIndex) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const round = gameEngine.startRound(gameId, roundIndex);
    if (round) {
      const game = gameEngine.getGame(gameId)!;
      emitSound(gameId, 'round-start');
      io.to(gameId).emit('roundStart', round);
      io.to(gameId).emit('gameState', game);
      buzzController.allLightsOn();

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { currentRoundIndex: game.currentRoundIndex, rounds: game.rounds }
        );
      } catch (e) { }
    }
  });

  socket.on('retryRound', async (keepScores: boolean = false) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    // Clear any pending timers
    clearAutoAdvanceTimer(gameId);
    clearQuestionTimerInterval(gameId);
    clearFastestFingerTimer(gameId);

    const round = gameEngine.retryRound(gameId, keepScores);
    if (round) {
      const game = gameEngine.getGame(gameId)!;
      emitSound(gameId, 'round-start');
      io.to(gameId).emit('roundRetry', round);
      io.to(gameId).emit('gameState', game);
      buzzController.allLightsOn();

      // Save to MongoDB with restored scores
      try {
        await Game.findOneAndUpdate(
          { gameId },
          {
            teams: game.teams,
            rounds: game.rounds,
            currentQuestion: null,
            buzzedPlayers: [],
            playerAnswers: [],
            answerRevealed: false
          }
        );
      } catch (e) { }
    }
  });

  // Start a new bomb cycle in Hot Potato (after explosion summary)
  socket.on('startNewBombCycle', () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const game = gameEngine.getGame(gameId);
    if (!game) return;

    const round = gameEngine.getCurrentRound(gameId);
    if (!round || round.config.type !== 'hot-potato') return;

    // Reset the bomb for a new cycle
    gameEngine.resetHotPotatoBomb(gameId);

    // Start the first question of the new cycle
    const result = gameEngine.startQuestion(gameId);
    if (result && game.hotPotatoState) {
      io.to(gameId).emit('questionStart', result.question, result.roundConfig);
      io.to(gameId).emit('gameState', game);
      io.to(gameId).emit('hotPotatoUpdate', game.hotPotatoState);

      // Light up only the bomb holder's buzzer
      const holder = gameEngine.getHotPotatoHolder(gameId);
      if (holder) {
        const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
        lights[holder.controllerIndex - 1] = true;
        buzzController.setLights(lights);
      }

      // Start bomb timer
      startHotPotatoBombTimer(gameId);
      console.log(`[HOT-POTATO] New bomb cycle started`);
    } else {
      // No more questions - end round
      const roundResult = gameEngine.endRound(gameId);
      if (roundResult) {
        clearHotPotatoTimer(gameId);
        emitSound(gameId, 'round-end');
        io.to(gameId).emit('roundEnd', roundResult);
        io.to(gameId).emit('gameState', game);
      }
    }
  });

  // Reset bomb timer (for when the timer bugs out during hot potato)
  socket.on('resetBombTimer', () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const game = gameEngine.getGame(gameId);
    if (!game) return;

    const round = gameEngine.getCurrentRound(gameId);
    if (!round || round.config.type !== 'hot-potato') return;

    // Only reset if we have hot potato state and it's in playing phase
    if (!game.hotPotatoState || game.hotPotatoState.phase !== 'playing') return;

    // Reset the bomb timer to full
    game.hotPotatoState.bombTimeLeft = game.hotPotatoState.bombTotalTime;

    // Clear and restart the timer
    clearHotPotatoTimer(gameId);
    startHotPotatoBombTimer(gameId);

    // Emit updated state
    io.to(gameId).emit('hotPotatoUpdate', game.hotPotatoState);
    io.to(gameId).emit('gameState', game);
    console.log(`[HOT-POTATO] Bomb timer reset to ${game.hotPotatoState.bombTotalTime}s`);
  });

  socket.on('startQuestion', () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    // Clear any pending timers
    clearAutoAdvanceTimer(gameId);
    clearQuestionTimerInterval(gameId);
    clearFastestFingerTimer(gameId);
    clearHotPotatoTimer(gameId);

    const result = gameEngine.startQuestion(gameId);
    if (result) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('questionStart', result.question, result.roundConfig);
      io.to(gameId).emit('gameState', game);

      // Save current question index to MongoDB
      Game.findOneAndUpdate({ gameId }, {
        rounds: game.rounds,
        currentRoundIndex: game.currentRoundIndex
      }).catch(() => { });

      // Hot Potato mode - special handling
      if (result.roundConfig.type === 'hot-potato' && game.hotPotatoState) {
        // Light up only the bomb holder's buzzer
        const holder = gameEngine.getHotPotatoHolder(gameId);
        if (holder) {
          const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
          lights[holder.controllerIndex - 1] = true;
          buzzController.setLights(lights);
        }
        // Emit hot potato state
        io.to(gameId).emit('hotPotatoUpdate', game.hotPotatoState);
        // Start bomb timer
        startHotPotatoBombTimer(gameId);
        return; // Don't use normal question timer for hot potato
      }

      // Normal mode - all lights on
      buzzController.allLightsOn();

      // Start timer with auto-reveal at end
      let timeLeft = result.roundConfig.timePerQuestion;
      const timerInterval = setInterval(() => {
        timeLeft--;
        io.to(gameId).emit('timerUpdate', timeLeft);

        if (timeLeft <= 5 && timeLeft > 0) {
          emitSound(gameId, 'tick');
        }

        if (timeLeft <= 0) {
          clearQuestionTimerInterval(gameId);

          // Set timer expired to block new answers
          gameEngine.setTimerExpired(gameId, true);
          emitSound(gameId, 'countdown');

          // Turn off all buzzer lights when time expires
          buzzController.allLightsOff();

          // Emit timeUp event first, then gameState
          io.to(gameId).emit('timeUp');
          io.to(gameId).emit('gameState', game);
          // Auto-reveal when time runs out
          scheduleAutoReveal(gameId);
        }
      }, 1000);

      // Store the interval so we can clear it when someone buzzes in fastest finger
      questionTimerIntervals.set(gameId, timerInterval);
    }
  });

  socket.on('revealAnswer', () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    // Clear any pending auto-reveal timer
    clearAutoAdvanceTimer(gameId);

    const game = gameEngine.getGame(gameId);
    if (!game) return;

    const round = game.rounds[game.currentRoundIndex];

    const result = gameEngine.revealAnswer(gameId);
    if (result) {
      emitSound(gameId, 'dramatic');
      io.to(gameId).emit('answerRevealed', result.correctChoiceId, result.scores, result.pointChanges);
      io.to(gameId).emit('gameState', game);

      // Check if this is steal-points round with a correct answer - start announcing phase
      if (round?.config.type === 'steal-points' && game.stealPointsState) {
        const correctAnswer = game.playerAnswers.find(a => a.isCorrect);
        if (correctAnswer) {
          // Start announcing phase - show who will steal before target selection
          gameEngine.startAnnouncingPhase(gameId);
          // Only light up the winner's buzzer (the one who answered correctly)
          const winnerControllerIndex = game.stealPointsState.buzzerControllerIndex;
          if (winnerControllerIndex) {
            const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
            lights[winnerControllerIndex - 1] = true;
            buzzController.setLights(lights);
          }
          io.to(gameId).emit('stealPointsUpdate', game.stealPointsState);
          io.to(gameId).emit('gameState', game);

          // After 4 seconds, transition to stealing phase
          setTimeout(() => {
            const currentGame = gameEngine.getGame(gameId);
            if (currentGame && currentGame.stealPointsState?.phase === 'announcing') {
              gameEngine.startStealPhase(gameId);
              io.to(gameId).emit('stealPointsUpdate', currentGame.stealPointsState);
              io.to(gameId).emit('gameState', currentGame);
              emitSound(gameId, 'buzz'); // Alert sound for steal selection
            }
          }, 4000);

          // Don't schedule next - wait for steal target selection
          return;
        }
      }

      // Schedule auto-show points if enabled, otherwise schedule auto-next
      if (game.settings.autoShowPoints) {
        scheduleAutoShowPoints(gameId);
      } else {
        scheduleAutoNext(gameId);
      }
    }
  });

  socket.on('nextQuestion', () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    // Clear any pending timers
    clearAutoAdvanceTimer(gameId);
    clearQuestionTimerInterval(gameId);
    clearFastestFingerTimer(gameId);

    const game = gameEngine.getGame(gameId);
    if (!game) return;

    // If round is already completed, immediately start next round
    const currentRound = gameEngine.getCurrentRound(gameId);
    if (currentRound?.status === 'completed') {
      // Find the next round with questions
      let nextRoundIndex = game.currentRoundIndex + 1;
      while (nextRoundIndex < game.rounds.length) {
        if (game.rounds[nextRoundIndex].questions.length > 0) {
          break;
        }
        nextRoundIndex++;
      }

      if (nextRoundIndex < game.rounds.length) {
        // Start the next round immediately
        const round = gameEngine.startRound(gameId, nextRoundIndex);
        if (round) {
          emitSound(gameId, 'round-start');
          io.to(gameId).emit('roundStart', round);
          io.to(gameId).emit('gameState', game);
          buzzController.allLightsOn();
        }
      } else {
        // No more rounds - end the game
        const finalScores = gameEngine.endGame(gameId);
        if (finalScores) {
          emitSound(gameId, 'game-over');
          io.to(gameId).emit('gameOver', finalScores);
          io.to(gameId).emit('gameState', game);
          buzzController.allLightsOff();
        }
      }
      return;
    }

    const result = gameEngine.startQuestion(gameId);
    if (result) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('questionStart', result.question, result.roundConfig);
      io.to(gameId).emit('gameState', game);
      buzzController.allLightsOn();

      // Save current question index to MongoDB so game can resume at correct question
      try {
        Game.findOneAndUpdate({ gameId }, {
          rounds: game.rounds,
          currentRoundIndex: game.currentRoundIndex
        }).catch(() => { });
      } catch (e) { }

      // Start timer for this question with auto-reveal at end
      let timeLeft = result.roundConfig.timePerQuestion;
      const timerInterval = setInterval(() => {
        timeLeft--;
        io.to(gameId).emit('timerUpdate', timeLeft);
        if (timeLeft <= 5 && timeLeft > 0) {
          emitSound(gameId, 'tick');
        }
        if (timeLeft <= 0) {
          clearQuestionTimerInterval(gameId);

          // Set timer expired to block new answers
          gameEngine.setTimerExpired(gameId, true);
          emitSound(gameId, 'countdown');

          // Turn off all buzzer lights when time expires
          buzzController.allLightsOff();

          // Emit timeUp event first, then gameState
          io.to(gameId).emit('timeUp');
          io.to(gameId).emit('gameState', game);
          // Auto-reveal when time runs out
          scheduleAutoReveal(gameId);
        }
      }, 1000);

      // Store the interval so we can clear it when someone buzzes in fastest finger
      questionTimerIntervals.set(gameId, timerInterval);
    } else {
      // No more questions - end round and auto-advance to next round
      const roundResult = gameEngine.endRound(gameId);
      if (roundResult) {
        emitSound(gameId, 'round-end');
        io.to(gameId).emit('roundEnd', roundResult);
        const game = gameEngine.getGame(gameId)!;
        io.to(gameId).emit('gameState', game);

        // Schedule auto-advance to next round
        scheduleAutoNextRound(gameId);
      }
    }
  });

  socket.on('pauseGame', async () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    // Clear any pending timers
    clearAutoAdvanceTimer(gameId);
    clearFastestFingerTimer(gameId);
    clearQuestionTimerInterval(gameId);

    if (gameEngine.pauseGame(gameId)) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);
      buzzController.allLightsOff();

      // Save to MongoDB - include rounds (with currentQuestionIndex) and currentRoundIndex
      // This ensures the game can resume at the exact same question
      try {
        await Game.findOneAndUpdate({ gameId }, {
          status: 'paused',
          teams: game.teams,
          rounds: game.rounds,
          currentRoundIndex: game.currentRoundIndex
        });
      } catch (e) { }
    }
  });

  socket.on('resumeGame', async () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    if (gameEngine.resumeGame(gameId)) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);
      buzzController.allLightsOn();

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate({ gameId }, { status: 'playing' });
      } catch (e) { }
    }
  });

  socket.on('endRound', async () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    // Clear any pending timers
    clearAutoAdvanceTimer(gameId);
    clearFastestFingerTimer(gameId);
    clearQuestionTimerInterval(gameId);

    const result = gameEngine.endRound(gameId);
    if (result) {
      emitSound(gameId, 'round-end');
      io.to(gameId).emit('roundEnd', result);
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);

      // Save to MongoDB
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { rounds: game.rounds, teams: game.teams, roundResults: game.roundResults }
        );
      } catch (e) { }
    }
  });

  socket.on('endGame', () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    // Clear any pending timers
    clearAutoAdvanceTimer(gameId);
    clearFastestFingerTimer(gameId);
    clearQuestionTimerInterval(gameId);

    const finalScores = gameEngine.endGame(gameId);
    if (finalScores) {
      emitSound(gameId, 'game-over');
      io.to(gameId).emit('gameOver', finalScores);
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);
      buzzController.allLightsOff();

      // Clear active game when game ends
      if (activeGameId === gameId) {
        setActiveGame(null);
      }

      // Save final state to MongoDB
      Game.findOneAndUpdate(
        { gameId },
        {
          status: 'finished',
          teams: game.teams,
          roundResults: game.roundResults
        }
      ).catch(() => { });
    }
  });

  // =====================================
  // ANIMATIONS
  // =====================================

  socket.on('triggerPointsAnimation', () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const game = gameEngine.getGame(gameId);
    if (!game || !game.answerRevealed) return;

    // Build a map of point changes from answers
    const answerMap = new Map<string, number>();
    game.playerAnswers.forEach(answer => {
      const current = answerMap.get(answer.teamId) || 0;
      answerMap.set(answer.teamId, current + answer.pointsEarned);
    });

    // Include ALL teams so we can show current scores even if no points earned
    const pointChanges = game.teams.map(team => {
      const change = answerMap.get(team.id) || 0;
      const newScore = team.score;
      const oldScore = newScore - change;
      return {
        teamId: team.id,
        teamName: team.players[0]?.name || team.name,
        teamColor: team.color || '#888',
        change,
        oldScore: Math.max(0, oldScore),
        newScore
      };
    });

    // Check if anyone actually earned points
    const hasPointChanges = pointChanges.some(pc => pc.change !== 0);

    if (hasPointChanges) {
      emitSound(gameId, 'correct');
    }

    // Always emit - even if no points, so we show "no points" message with current scores
    io.to(gameId).emit('showPointsAnimation', pointChanges);
  });

  // =====================================
  // GAME MANAGEMENT (DELETE/RENAME)
  // =====================================

  socket.on('deleteGame', async (gameId: string) => {
    try {
      // Delete from MongoDB
      await Game.deleteOne({ gameId });
      // Delete from memory
      gameEngine.deleteGame(gameId);
      // Clear socket's game reference if it was this game
      if (socket.data.gameId === gameId) {
        socket.data.gameId = undefined;
      }
      // Refresh games list for all clients
      const games = await Game.find({}).sort({ updatedAt: -1 }).limit(20);
      const gamesList = games.map(g => ({
        gameId: g.gameId,
        name: g.name,
        status: g.status,
        teamCount: g.teams?.length || 0,
        questionCount: g.rounds?.reduce((sum, r) => sum + (r.questions?.length || 0), 0) || 0,
        createdAt: g.createdAt?.toISOString() || '',
        updatedAt: g.updatedAt?.toISOString() || ''
      }));
      io.emit('gamesList', gamesList);
      console.log('🗑️ Game deleted:', gameId);
    } catch (e) {
      socket.emit('error', 'Failed to delete game');
    }
  });

  socket.on('updateGameName', async (gameId: string, newName: string) => {
    try {
      // Update in MongoDB
      await Game.findOneAndUpdate({ gameId }, { name: newName });
      // Update in memory if loaded
      const game = gameEngine.getGame(gameId);
      if (game) {
        game.name = newName;
        io.to(gameId).emit('gameState', game);
      }
      // Refresh games list
      const games = await Game.find({}).sort({ updatedAt: -1 }).limit(20);
      const gamesList = games.map(g => ({
        gameId: g.gameId,
        name: g.name,
        status: g.status,
        teamCount: g.teams?.length || 0,
        questionCount: g.rounds?.reduce((sum, r) => sum + (r.questions?.length || 0), 0) || 0,
        createdAt: g.createdAt?.toISOString() || '',
        updatedAt: g.updatedAt?.toISOString() || ''
      }));
      io.emit('gamesList', gamesList);
      console.log('✏️ Game renamed:', gameId, '->', newName);
    } catch (e) {
      socket.emit('error', 'Failed to update game name');
    }
  });

  // =====================================
  // SPECIAL ROUND ACTIONS
  // =====================================

  socket.on('playerBank', (playerId) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    const banked = gameEngine.bankPoints(gameId, playerId);
    if (banked > 0) {
      const game = gameEngine.getGame(gameId)!;
      emitSound(gameId, 'bank');
      if (game.ladderState) {
        io.to(gameId).emit('ladderUpdate', game.ladderState);
      }
      io.to(gameId).emit('gameState', game);
    }
  });

  socket.on('selectStealTarget', (targetTeamId) => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    if (gameEngine.setStealTarget(gameId, targetTeamId)) {
      emitSound(gameId, 'steal');
      io.to(gameId).emit('stealTargetSelect', targetTeamId);
    }
  });

  // =====================================
  // CONTROLLER MANAGEMENT
  // =====================================

  socket.on('resetBuzz', () => {
    const gameId = socket.data.gameId;
    if (!gameId) return;

    if (gameEngine.resetBuzz(gameId)) {
      const game = gameEngine.getGame(gameId)!;
      io.to(gameId).emit('gameState', game);
      buzzController.allLightsOn();
    }
  });

  socket.on('testLights', () => {
    buzzController.allLightsOn();
    setTimeout(() => {
      buzzController.setLights([true, false, false, false]);
      setTimeout(() => {
        buzzController.setLights([false, true, false, false]);
        setTimeout(() => {
          buzzController.setLights([false, false, true, false]);
          setTimeout(() => {
            buzzController.setLights([false, false, false, true]);
            setTimeout(() => {
              buzzController.allLightsOff();
            }, 300);
          }, 300);
        }, 300);
      }, 300);
    }, 500);
  });

  socket.on('setLights', (lights) => {
    buzzController.setLights(lights);
  });

  socket.on('disconnect', () => {
    console.log('📱 Client disconnected:', socket.id);
  });
});

// =====================================
// REST API
// =====================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    controllerConnected: buzzController.connected,
    mongoConnected: mongoose.connection.readyState === 1
  });
});

app.get('/api/devices', (req, res) => {
  const devices = BuzzController.listDevices();
  res.json(devices);
});

app.get('/api/games', (req, res) => {
  res.json(gameEngine.getAllGames());
});

app.get('/api/games/:id', (req, res) => {
  const game = gameEngine.getGame(req.params.id);
  if (game) {
    res.json(game);
  } else {
    res.status(404).json({ error: 'Game not found' });
  }
});

// Saved games from MongoDB
app.get('/api/saved-games', async (req, res) => {
  try {
    const games = await Game.find().sort({ updatedAt: -1 }).limit(20);
    res.json(games);
  } catch (e) {
    res.json([]);
  }
});

const PORT = process.env.PORT || 3005;

httpServer.listen({ port: Number(PORT), host: '0.0.0.0' }, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🎮  BUZZ! QUIZ GAME SHOW SERVER                           ║
║                                                              ║
║   Server:     http://0.0.0.0:${PORT} (LAN accessible)          ║
║   WebSocket:  Ready                                          ║
║   Controller: ${buzzController.connected ? '✅ Connected' : '⏳ Waiting...'}                              ║
║   MongoDB:    ${mongoose.connection.readyState === 1 ? '✅ Connected' : '⚠️  Not connected'}                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  buzzController.destroy();
  mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  buzzController.destroy();
  mongoose.disconnect();
  process.exit(0);
});

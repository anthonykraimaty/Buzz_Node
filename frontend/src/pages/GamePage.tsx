import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, PointsAnimationData } from '../store/gameStore';
import { Team, ROUND_ICONS, PlayerAnswer, HotPotatoExplosionResult } from '../types';

interface ScoreChange {
  id: string;
  teamId: string;
  points: number;
  timestamp: number;
}

interface ConfettiParticle {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
}

export default function GamePage() {
  const navigate = useNavigate();
  const { gameState, timeLeft, pointsAnimation, clearPointsAnimation, hotPotatoExplosion } = useGameStore();

  // Animation states
  const [scoreChanges, setScoreChanges] = useState<ScoreChange[]>([]);
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const [questionKey, setQuestionKey] = useState(0);
  const [screenShake, setScreenShake] = useState(false);
  const prevScoresRef = useRef<Record<string, number>>({});
  const prevQuestionRef = useRef<string | null>(null);
  const prevAnswerRevealedRef = useRef(false);

  // Don't redirect away - show a waiting message instead so we stay on this page on refresh
  // The game state will be restored from the server

  // Track score changes for floating animation
  useEffect(() => {
    if (!gameState) return;

    const newChanges: ScoreChange[] = [];
    gameState.teams.forEach(team => {
      const prevScore = prevScoresRef.current[team.id] ?? team.score;
      const diff = team.score - prevScore;
      if (diff !== 0) {
        newChanges.push({
          id: `${team.id}-${Date.now()}`,
          teamId: team.id,
          points: diff,
          timestamp: Date.now()
        });
      }
      prevScoresRef.current[team.id] = team.score;
    });

    if (newChanges.length > 0) {
      setScoreChanges(prev => [...prev, ...newChanges]);
      // Clean up old score changes after animation
      setTimeout(() => {
        setScoreChanges(prev => prev.filter(sc => Date.now() - sc.timestamp < 1500));
      }, 1600);
    }
  }, [gameState?.teams]);

  // Trigger question animation when question changes
  useEffect(() => {
    if (!gameState?.currentQuestion) return;
    if (prevQuestionRef.current !== gameState.currentQuestion.id) {
      setQuestionKey(prev => prev + 1);
      prevQuestionRef.current = gameState.currentQuestion.id;
    }
  }, [gameState?.currentQuestion?.id]);

  // Trigger answer reveal animation and confetti
  useEffect(() => {
    if (!gameState) return;

    if (gameState.answerRevealed && !prevAnswerRevealedRef.current) {
      // Check if there's a correct answer to celebrate
      const correctAnswer = gameState.playerAnswers.find(a => a.isCorrect);
      if (correctAnswer) {
        spawnConfetti(correctAnswer.teamId);
      } else if (gameState.playerAnswers.length > 0) {
        // Wrong answer - screen shake
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 400);
      }
    }
    prevAnswerRevealedRef.current = gameState.answerRevealed;
  }, [gameState?.answerRevealed]);

  const spawnConfetti = useCallback((teamId: string) => {
    const team = gameState?.teams.find(t => t.id === teamId);
    const particles: ConfettiParticle[] = [];
    const colors = team ? [team.color, '#fff', '#ffd700'] : ['#22c55e', '#fff', '#ffd700'];

    for (let i = 0; i < 30; i++) {
      particles.push({
        id: `confetti-${i}-${Date.now()}`,
        x: (Math.random() - 0.5) * 400,
        y: -Math.random() * 300 - 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4
      });
    }
    setConfetti(particles);
    setTimeout(() => setConfetti([]), 1500);
  }, [gameState?.teams]);

  // Show loading state while waiting for game state
  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-6xl mb-8 animate-bounce">🎮</div>
        <h2 className="text-3xl font-bold mb-4">Loading Game...</h2>
        <p className="text-gray-400">Connecting to server...</p>
        <button
          onClick={() => navigate('/')}
          className="mt-8 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // If game is in lobby/setup, show a message
  if (gameState.status === 'lobby') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-6xl mb-8">⏳</div>
        <h2 className="text-3xl font-bold mb-4">Game Not Started</h2>
        <p className="text-gray-400 mb-8">The game hasn't started yet. Please use Host Controls to start.</p>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/host')}
            className="bg-buzz-green hover:bg-green-600 px-6 py-3 rounded-lg font-bold"
          >
            Host Controls
          </button>
          <button
            onClick={() => navigate('/setup')}
            className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg"
          >
            Setup
          </button>
        </div>
      </div>
    );
  }

  const currentRound = gameState.currentRoundIndex >= 0
    ? gameState.rounds[gameState.currentRoundIndex]
    : null;

  // For fastest finger, show the current turn player
  const ffState = gameState.fastestFingerState;
  const isFastestFinger = currentRound?.config.type === 'fastest-finger';

  // For steal points (Point Heist)
  const stealState = gameState.stealPointsState;
  const isStealPoints = currentRound?.config.type === 'steal-points';

  // Get the current turn player for fastest finger, or first buzzer for other modes
  const currentTurnBuzzer = isFastestFinger && ffState
    ? gameState.buzzedPlayers[ffState.currentTurnIndex]
    : gameState.buzzedPlayers[0];

  const buzzedTeam = currentTurnBuzzer
    ? gameState.teams.find((t) => t.id === currentTurnBuzzer.teamId)
    : null;
  const buzzedPlayerInfo = buzzedTeam?.players.find(
    (p) => p.id === currentTurnBuzzer?.playerId
  );

  // Get player answers for display
  const playerAnswersByChoice: Record<string, PlayerAnswer[]> = {};
  gameState.playerAnswers.forEach(answer => {
    if (!playerAnswersByChoice[answer.choiceId]) {
      playerAnswersByChoice[answer.choiceId] = [];
    }
    playerAnswersByChoice[answer.choiceId].push(answer);
  });

  return (
    <div className={`min-h-screen flex flex-col ${screenShake ? 'screen-shake' : ''}`}>
      {/* Confetti Layer */}
      {confetti.map(particle => (
        <div
          key={particle.id}
          className="celebration-particle"
          style={{
            left: '50%',
            top: '50%',
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            borderRadius: '50%',
            '--x': `${particle.x}px`,
            '--y': `${particle.y}px`
          } as React.CSSProperties}
        />
      ))}

      {/* Scoreboard Header */}
      <div className="bg-gray-900/90 backdrop-blur-md border-b border-gray-700/50 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Team Scores */}
          <div className="flex gap-4">
            {gameState.teams.map((team) => {
              const teamScoreChanges = scoreChanges.filter(sc => sc.teamId === team.id);
              const isScoring = teamScoreChanges.length > 0;

              return (
                <div
                  key={team.id}
                  className={`team-score-card px-6 py-3 relative ${
                    buzzedTeam?.id === team.id ? 'active ring-2 ring-white' : ''
                  } ${isScoring ? 'team-scoring' : ''}`}
                  style={{
                    borderLeft: `4px solid ${team.color}`,
                    color: buzzedTeam?.id === team.id ? team.color : undefined
                  }}
                >
                  <div className="text-sm text-gray-400">{team.funName || team.name}</div>
                  <div className="text-3xl font-black" style={{ color: team.color }}>
                    {team.score.toLocaleString()}
                  </div>

                  {/* Floating score changes */}
                  {teamScoreChanges.map(sc => (
                    <div
                      key={sc.id}
                      className={`absolute left-1/2 -translate-x-1/2 top-0 text-2xl font-black score-change ${
                        sc.points > 0 ? 'positive' : 'negative'
                      }`}
                    >
                      {sc.points > 0 ? '+' : ''}{sc.points}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Round & Timer Info */}
          <div className="flex items-center gap-6">
            {currentRound && (
              <div className="text-center">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <span className="text-xl">{ROUND_ICONS[currentRound.config.type]}</span>
                  <span>{currentRound.config.name}</span>
                </div>
                <div className="text-lg font-bold">
                  Q{currentRound.currentQuestionIndex + 1} / {currentRound.questions.length}
                </div>
              </div>
            )}

{/* Timer moved to above the question for better visibility */}
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className={`flex-1 flex flex-col items-center justify-center p-8 relative ${
        currentRound?.config.type === 'hot-potato' && gameState.hotPotatoState ? 'pl-48' : ''
      }`}>
        {gameState.status === 'finished' ? (
          <GameOverScreen teams={gameState.teams} />
        ) : !currentRound ? (
          <RoundIntroScreen />
        ) : gameState.currentQuestion ? (
          <div key={questionKey} className="w-full flex flex-col items-center">
            {/* Fastest Finger Buzzing Phase - first to buzz wins! */}
            {isFastestFinger && ffState && ffState.phase === 'buzzing' && !gameState.answerRevealed && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 buzz-indicator z-10">
                <div className="text-center px-12 py-4 rounded-2xl shadow-2xl bg-purple-600"
                  style={{ boxShadow: '0 0 60px rgba(147, 51, 234, 0.4)' }}>
                  <div className="text-lg font-bold text-white/80">FASTEST FINGER!</div>
                  <div className="text-2xl font-black text-white mb-2">
                    First to buzz gets to answer!
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white font-bold">Press RED to buzz in</span>
                  </div>
                </div>
              </div>
            )}

            {/* Steal Points Buzzing Phase - first to buzz gets to answer */}
            {isStealPoints && stealState && stealState.phase === 'buzzing' && !gameState.answerRevealed && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 buzz-indicator z-10">
                <div className="text-center px-12 py-4 rounded-2xl shadow-2xl bg-yellow-600"
                  style={{ boxShadow: '0 0 60px rgba(234, 179, 8, 0.4)' }}>
                  <div className="text-lg font-bold text-white/80">POINT HEIST!</div>
                  <div className="text-2xl font-black text-white mb-2">
                    First to buzz gets to answer!
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white font-bold">Press RED to buzz in</span>
                  </div>
                </div>
              </div>
            )}

            {/* Buzz Indicator - Shows current turn player (only during answering phase) */}
            {((!isFastestFinger && !isStealPoints) ||
              (isFastestFinger && ffState && ffState.phase === 'answering') ||
              (isStealPoints && stealState && stealState.phase === 'answering')) &&
             currentTurnBuzzer && buzzedTeam && buzzedPlayerInfo && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 buzz-indicator z-10">
                <div
                  className="text-center px-12 py-4 rounded-2xl shadow-2xl relative"
                  style={{
                    backgroundColor: buzzedTeam.color,
                    boxShadow: `0 0 60px ${buzzedTeam.color}60`
                  }}
                >
                  {/* Fastest Finger answer countdown */}
                  {isFastestFinger && ffState && ffState.phase === 'answering' && !gameState.answerRevealed && (
                    <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black ${
                      ffState.answerTimeLeft <= 3
                        ? 'bg-red-500 countdown-urgent'
                        : ffState.answerTimeLeft <= 5
                        ? 'bg-yellow-500 animate-pulse'
                        : 'bg-gray-800'
                    }`}>
                      {ffState.answerTimeLeft}
                    </div>
                  )}

                  <div className="text-lg font-bold text-white/80">
                    {isFastestFinger ? 'FASTEST FINGER!' : 'FIRST BUZZ!'}
                  </div>
                  <div className="text-3xl font-black text-white">{buzzedPlayerInfo.name}</div>
                  <div className="text-sm text-white/80">{buzzedTeam.funName || buzzedTeam.name}</div>
                  <div className="text-xs text-white/60 mt-1">Buzzer {currentTurnBuzzer.controllerIndex}</div>

                  {/* Show eliminated players indicator */}
                  {isFastestFinger && ffState && ffState.eliminatedPlayers.length > 0 && (
                    <div className="text-xs text-red-300 mt-2">
                      {ffState.eliminatedPlayers.length} player{ffState.eliminatedPlayers.length > 1 ? 's' : ''} eliminated
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional buzz queue - show during answering phase for fastest finger */}
            {gameState.buzzedPlayers.length > 1 && (!isFastestFinger || (ffState && ffState.phase === 'answering')) && (
              <div className="absolute top-4 right-8 flex flex-col gap-2">
                <div className="text-xs text-gray-400 uppercase tracking-wider">
                  {isFastestFinger ? 'Answer Queue' : 'Buzz Order'}
                </div>
                {gameState.buzzedPlayers.slice(0, 4).map((bp, idx) => {
                  const team = gameState.teams.find(t => t.id === bp.teamId);
                  const isEliminated = ffState?.eliminatedPlayers.includes(bp.playerId);
                  const isCurrentTurn = isFastestFinger && ffState?.currentTurnIndex === idx;

                  return (
                    <div
                      key={bp.playerId}
                      className={`buzz-queue-item flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-all ${
                        isEliminated ? 'opacity-40 line-through' : ''
                      } ${isCurrentTurn ? 'ring-2 ring-white scale-105' : ''}`}
                      style={{
                        backgroundColor: isEliminated ? '#333' : `${team?.color}40`,
                        animationDelay: `${idx * 0.1}s`
                      }}
                    >
                      <span className="font-bold text-white">{idx + 1}.</span>
                      <span style={{ color: isEliminated ? '#666' : team?.color }}>
                        Buzzer {bp.controllerIndex}
                      </span>
                      {isEliminated && <span className="text-red-400 text-xs">✗</span>}
                      {isCurrentTurn && !gameState.answerRevealed && (
                        <span className="text-yellow-400 text-xs animate-pulse">◀</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Timer - prominent display above question */}
            {gameState.status === 'playing' && !gameState.answerRevealed && (
              <div className="mb-6">
                {/* Fastest Finger Answer Phase Timer */}
                {isFastestFinger && ffState && ffState.phase === 'answering' ? (
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Answer Time</div>
                    <div
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-black transition-all shadow-lg ${
                        ffState.answerTimeLeft <= 3
                          ? 'bg-red-500/30 text-red-400 countdown-urgent'
                          : ffState.answerTimeLeft <= 5
                          ? 'bg-yellow-500/30 text-yellow-400 animate-pulse'
                          : 'bg-blue-500/30 text-blue-400'
                      }`}
                    >
                      {ffState.answerTimeLeft}
                    </div>
                  </div>
                ) : isFastestFinger && ffState && ffState.phase === 'buzzing' ? (
                  /* Fastest Finger Buzzing Phase Timer */
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-purple-400 uppercase tracking-wider mb-2">Buzz In!</div>
                    <div
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-black transition-all shadow-lg ${
                        timeLeft <= 5
                          ? 'bg-red-500/30 text-red-400 countdown-urgent'
                          : timeLeft <= 10
                          ? 'bg-yellow-500/30 text-yellow-400 animate-pulse'
                          : 'bg-purple-500/30 text-purple-400'
                      }`}
                    >
                      {timeLeft}
                    </div>
                    <div className="text-sm text-purple-400 mt-2">
                      {ffState.teamsNotBuzzed.length} team{ffState.teamsNotBuzzed.length !== 1 ? 's' : ''} left
                    </div>
                  </div>
                ) : gameState.timerExpired ? (
                  /* Time's Up Display */
                  <div className="flex flex-col items-center">
                    <div
                      className="w-32 h-32 rounded-full flex items-center justify-center bg-red-500/30 shadow-lg border-4 border-red-500/50"
                    >
                      <span className="text-2xl font-black text-red-400 text-center leading-tight">TIME'S<br/>UP!</span>
                    </div>
                  </div>
                ) : (
                  /* Normal Timer */
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-black transition-all shadow-lg ${
                        timeLeft <= 5
                          ? 'bg-red-500/30 text-red-400 countdown-urgent'
                          : timeLeft <= 10
                          ? 'bg-yellow-500/30 text-yellow-400 animate-pulse'
                          : 'bg-blue-500/30 text-blue-400'
                      }`}
                    >
                      {timeLeft}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Large Media Display for Picture/Sound rounds - ABOVE question */}
            {gameState.currentQuestion.mediaUrl && currentRound?.config.type === 'picture-sound' && (() => {
              const totalTime = currentRound?.config.timePerQuestion || 15;
              const blurAmount = gameState.answerRevealed ? 0 : Math.max(0, (timeLeft / totalTime) * 20);
              const mediaUrl = gameState.currentQuestion.mediaUrl.startsWith('/')
                ? `http://localhost:3005${gameState.currentQuestion.mediaUrl}`
                : gameState.currentQuestion.mediaUrl;

              return (
                <div className="mb-8 flex justify-center">
                  {gameState.currentQuestion.mediaType === 'image' && (
                    <div className="relative overflow-hidden rounded-2xl shadow-2xl">
                      <img
                        src={mediaUrl}
                        alt="Guess this!"
                        className="w-auto max-w-4xl max-h-[50vh] object-contain transition-all duration-300"
                        style={{
                          filter: `blur(${blurAmount}px)`,
                          transform: !gameState.answerRevealed ? 'scale(1.15)' : 'scale(1)'
                        }}
                      />
                      {!gameState.answerRevealed && blurAmount > 3 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-white/40 text-3xl font-bold animate-pulse drop-shadow-lg">
                            Image clearing...
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {gameState.currentQuestion.mediaType === 'audio' && (
                    <div className="bg-gray-800/50 rounded-2xl p-8 flex flex-col items-center gap-4">
                      <div className="text-8xl">🔊</div>
                      <audio
                        src={mediaUrl}
                        controls
                        autoPlay
                        className="w-96"
                      />
                      <p className="text-gray-400">Listen carefully!</p>
                    </div>
                  )}
                  {gameState.currentQuestion.mediaType === 'video' && (
                    <video
                      src={mediaUrl}
                      controls
                      autoPlay
                      className="max-w-4xl max-h-[50vh] rounded-2xl shadow-2xl"
                    />
                  )}
                </div>
              );
            })()}

            {/* Question */}
            <div className="text-center mb-8 max-w-5xl">
              {gameState.currentQuestion.category && (
                <div className="text-blue-400 text-lg mb-3 font-medium question-text">
                  {gameState.currentQuestion.category}
                </div>
              )}
              <h2 className="text-4xl md:text-5xl font-bold leading-tight question-text">
                {gameState.currentQuestion.text}
              </h2>
            </div>

            {/* Answer Choices */}
            <div className="grid grid-cols-2 gap-5 max-w-5xl w-full">
              {gameState.currentQuestion.choices.map((choice, idx) => {
                const isCorrect = choice.isCorrect;
                const showCorrect = gameState.answerRevealed && isCorrect;
                const showWrong = gameState.answerRevealed && !isCorrect;
                const answersForChoice = playerAnswersByChoice[choice.id] || [];
                const hasAnswers = answersForChoice.length > 0;

                return (
                  <div
                    key={choice.id}
                    className={`answer-card answer-card-enter animate ${choice.color}
                      ${showCorrect ? 'correct' : ''}
                      ${showWrong ? 'wrong' : ''}
                      ${hasAnswers && !gameState.answerRevealed ? 'ring-2 ring-white/50' : ''}
                    `}
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black flex-shrink-0 ${
                          choice.color === 'yellow' ? 'bg-yellow-600/50' : 'bg-white/20'
                        }`}
                      >
                        {choice.color[0].toUpperCase()}
                      </div>
                      <span className="text-xl flex-1">{choice.text}</span>

                      {/* Show who answered this choice */}
                      {hasAnswers && (
                        <div className="flex -space-x-2">
                          {answersForChoice.map(answer => {
                            const team = gameState.teams.find(t => t.id === answer.teamId);
                            return (
                              <div
                                key={answer.playerId}
                                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold"
                                style={{ backgroundColor: team?.color }}
                                title={team?.name}
                              >
                                {/* Only show ✓/✗ after answer is revealed */}
                                {gameState.answerRevealed ? (answer.isCorrect ? '✓' : '✗') : ''}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Show correct answer checkmark ONLY after reveal */}
                      {showCorrect && (
                        <span className="text-3xl ml-2 text-white drop-shadow-lg">✓</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Instructions */}
            {/* Fastest Finger Buzzing Phase - prompt all players to buzz */}
            {isFastestFinger && ffState && ffState.phase === 'buzzing' && !gameState.answerRevealed && (
              <div className="mt-10 text-center">
                <div className="inline-flex items-center gap-3 px-8 py-4 bg-purple-500/20 rounded-xl border border-purple-500/30">
                  <div className="w-8 h-8 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xl text-purple-300 font-medium">
                    All teams buzz in to set the order! ({ffState.teamsNotBuzzed.length} remaining)
                  </span>
                </div>
              </div>
            )}

            {/* Direct answer prompt - for multiple-choice, true-false, and picture-sound rounds (no buzzing required) */}
            {!gameState.answerRevealed && !gameState.timerExpired && currentRound &&
             (currentRound.config.type === 'multiple-choice' || currentRound.config.type === 'true-false') && (
              <div className="mt-10 text-center">
                <div className="inline-flex items-center gap-4 px-8 py-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500" />
                    <div className="w-6 h-6 rounded-full bg-orange-500" />
                    <div className="w-6 h-6 rounded-full bg-green-500" />
                    <div className="w-6 h-6 rounded-full bg-yellow-500" />
                  </div>
                  <span className="text-xl text-gray-300 font-medium">
                    Press the colored button for your answer!
                  </span>
                </div>
              </div>
            )}

            {/* Picture This prompt - guess the image as it clears */}
            {!gameState.answerRevealed && !gameState.timerExpired && currentRound &&
             currentRound.config.type === 'picture-sound' && (
              <div className="mt-10 text-center">
                <div className="inline-flex items-center gap-4 px-8 py-4 bg-purple-500/20 rounded-xl border border-purple-500/30">
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500" />
                    <div className="w-6 h-6 rounded-full bg-orange-500" />
                    <div className="w-6 h-6 rounded-full bg-green-500" />
                    <div className="w-6 h-6 rounded-full bg-yellow-500" />
                  </div>
                  <span className="text-xl text-purple-300 font-medium">
                    Guess the picture! The sooner you answer, the more points!
                  </span>
                </div>
              </div>
            )}

            {/* Standard "buzz in" prompt - for rounds that require buzzing first */}
            {!gameState.answerRevealed && !currentTurnBuzzer && currentRound &&
             currentRound.config.type !== 'multiple-choice' && currentRound.config.type !== 'true-false' &&
             currentRound.config.type !== 'picture-sound' &&
             !(isFastestFinger && ffState && ffState.phase === 'buzzing') && (
              <div className="mt-10 text-center">
                <div className="inline-flex items-center gap-3 px-8 py-4 bg-red-500/20 rounded-xl border border-red-500/30">
                  <div className="w-8 h-8 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xl text-red-300 font-medium">
                    Press the RED button to buzz in!
                  </span>
                </div>
              </div>
            )}

            {/* Answer prompt - during answering phase */}
            {!gameState.answerRevealed && currentTurnBuzzer && (!isFastestFinger || (ffState && ffState.phase === 'answering')) && (
              <div className="mt-10 text-center">
                <div className="inline-flex items-center gap-4 px-8 py-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500" />
                    <div className="w-6 h-6 rounded-full bg-orange-500" />
                    <div className="w-6 h-6 rounded-full bg-green-500" />
                    <div className="w-6 h-6 rounded-full bg-yellow-500" />
                  </div>
                  <span className="text-xl text-gray-300 font-medium">
                    {isFastestFinger && ffState
                      ? `${buzzedPlayerInfo?.name || 'Player'}, press a colored button to answer!`
                      : 'Press a colored button to answer!'}
                  </span>
                </div>
              </div>
            )}

            {/* Points earned summary after answer reveal */}
            {gameState.answerRevealed && gameState.playerAnswers.length > 0 && (
              <div className="mt-8 flex gap-4 flex-wrap justify-center">
                {gameState.playerAnswers.map(answer => {
                  const team = gameState.teams.find(t => t.id === answer.teamId);
                  return (
                    <div
                      key={answer.playerId}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        answer.isCorrect ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: team?.color }}
                      />
                      <span className="font-medium" style={{ color: team?.color }}>
                        {team?.name}
                      </span>
                      <span className={`font-bold ${answer.pointsEarned >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {answer.pointsEarned > 0 ? '+' : ''}{answer.pointsEarned}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ladder Display */}
            {currentRound.config.type === 'ladder' && gameState.ladderState && (
              <LadderDisplay
                values={currentRound.config.ladderValues || []}
                currentStep={gameState.ladderState.currentStep}
                unbankedPoints={gameState.ladderState.unbankedPoints}
                bankedPoints={gameState.ladderState.bankedPoints}
              />
            )}

            {/* Hot Potato Display */}
            {currentRound.config.type === 'hot-potato' && gameState.hotPotatoState && (
              <HotPotatoDisplay
                state={gameState.hotPotatoState}
                teams={gameState.teams}
                explosionResult={hotPotatoExplosion}
              />
            )}
          </div>
        ) : currentRound.status === 'completed' ? (
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-4xl font-bold mb-4">Round Complete!</h2>
            <p className="text-xl text-gray-400 mb-2">{currentRound.config.name} finished</p>
            <p className="text-gray-500 mt-6 animate-pulse">Moving to next round...</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">{ROUND_ICONS[currentRound.config.type]}</div>
            <h2 className="text-4xl font-bold mb-4">{currentRound.config.name}</h2>
            <p className="text-xl text-gray-400 mb-2">{currentRound.config.description}</p>
            <div className="flex gap-4 justify-center mt-6 text-sm text-gray-500">
              <span>+{currentRound.config.pointsCorrect} correct</span>
              {currentRound.config.pointsWrong !== 0 && (
                <span>{currentRound.config.pointsWrong} wrong</span>
              )}
              <span>{currentRound.config.timePerQuestion}s per question</span>
            </div>
            <p className="text-gray-500 mt-6 animate-pulse">Waiting for host to start question...</p>
          </div>
        )}
      </div>

      {/* Pause Overlay */}
      {gameState.status === 'paused' && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-40">
          <div className="text-center">
            <div className="text-8xl font-black text-white mb-4 animate-pulse">PAUSED</div>
            <p className="text-xl text-gray-400">Game is paused. Use host controls to resume.</p>
          </div>
        </div>
      )}

      {/* Steal Points Announcement Overlay - shows correct answer and who will steal */}
      {isStealPoints && stealState?.phase === 'announcing' && gameState.answerRevealed && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50">
          <div className="text-center max-w-4xl mx-auto p-8">
            {/* Correct Answer */}
            <div className="mb-12">
              <div className="text-2xl text-green-400 font-bold mb-4">CORRECT ANSWER</div>
              <div className="text-6xl font-black text-white mb-8 p-8 bg-green-500/20 rounded-3xl border-4 border-green-500">
                {gameState.currentQuestion?.choices.find(c => c.isCorrect)?.text}
              </div>
            </div>

            {/* Winner Announcement */}
            <div className="relative">
              <div className="text-3xl text-yellow-400 font-bold mb-6 animate-pulse">
                POINT HEIST!
              </div>
              <div
                className="inline-block p-8 rounded-3xl border-4 transform animate-bounce"
                style={{
                  backgroundColor: `${buzzedTeam?.color}30`,
                  borderColor: buzzedTeam?.color,
                  boxShadow: `0 0 60px ${buzzedTeam?.color}60`
                }}
              >
                <div className="text-7xl mb-4">💰</div>
                <div className="text-5xl font-black text-white mb-2">
                  {buzzedTeam?.funName || buzzedTeam?.name}
                </div>
                <div className="text-3xl font-bold" style={{ color: buzzedTeam?.color }}>
                  {buzzedPlayerInfo?.name}
                </div>
                <div className="text-2xl text-yellow-400 mt-4 font-bold">
                  GETS TO STEAL {stealState.stealAmount} POINTS!
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Steal Points Target Selection Overlay */}
      {isStealPoints && stealState?.phase === 'stealing' && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50">
          <div className="text-center max-w-6xl mx-auto p-8">
            {/* Title */}
            <div className="mb-8">
              <div className="text-6xl mb-4">💰</div>
              <h2 className="text-5xl font-black text-yellow-400 mb-2 animate-pulse">
                SELECT YOUR VICTIM!
              </h2>
              <p className="text-2xl text-gray-400">
                {buzzedTeam?.name || 'Winner'}: Press a colored button to steal from that team
              </p>
            </div>

            {/* Teams Grid - excluding the winning team */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {gameState.teams.map((team, index) => {
                const isWinner = team.id === stealState.buzzerTeamId;
                const buttonColors = ['blue', 'orange', 'green', 'yellow'];
                const buttonColor = buttonColors[index] || 'gray';

                return (
                  <div
                    key={team.id}
                    className={`relative p-6 rounded-2xl border-4 transition-all ${
                      isWinner
                        ? 'opacity-40 border-gray-600 bg-gray-900/50'
                        : 'border-white/50 bg-gray-800/80 hover:scale-105 hover:border-white'
                    }`}
                    style={{
                      borderColor: isWinner ? undefined : team.color,
                      boxShadow: isWinner ? undefined : `0 0 30px ${team.color}40`
                    }}
                  >
                    {isWinner && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl z-10">
                        <span className="text-2xl font-bold text-green-400">WINNER!</span>
                      </div>
                    )}

                    <div className="text-center">
                      <div
                        className="text-3xl font-bold mb-2"
                        style={{ color: team.color }}
                      >
                        {team.name}
                      </div>
                      <div className="text-5xl font-black text-white mb-4">
                        {team.score.toLocaleString()}
                      </div>
                      <div className="text-gray-400 text-sm mb-4">points</div>

                      {!isWinner && (
                        <div className="flex justify-center">
                          <div
                            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg ${
                              buttonColor === 'blue' ? 'bg-blue-500' :
                              buttonColor === 'orange' ? 'bg-orange-500' :
                              buttonColor === 'green' ? 'bg-green-500' :
                              'bg-yellow-400 text-black'
                            }`}
                          >
                            {buttonColor[0].toUpperCase()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Steal Amount */}
            <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded-xl p-6 inline-block">
              <div className="text-yellow-400 text-xl mb-1">STEAL AMOUNT</div>
              <div className="text-5xl font-black text-white">
                {stealState.stealAmount.toLocaleString()} pts
              </div>
              <div className="text-gray-400 text-sm mt-2">
                (or all their points if they have less)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Points Animation */}
      {pointsAnimation && pointsAnimation.length > 0 && (
        <PointsAnimationOverlay
          pointChanges={pointsAnimation}
          onComplete={clearPointsAnimation}
        />
      )}
    </div>
  );
}

function RoundIntroScreen() {
  return (
    <div className="text-center">
      <div className="text-6xl mb-8 animate-bounce">🎮</div>
      <h2 className="text-4xl font-bold mb-4">Get Ready!</h2>
      <p className="text-xl text-gray-400">Waiting for round to start...</p>
    </div>
  );
}

function LadderDisplay({
  values,
  currentStep,
  unbankedPoints,
  bankedPoints
}: {
  values: number[];
  currentStep: number;
  unbankedPoints: number;
  bankedPoints: number;
}) {
  const [prevStep, setPrevStep] = useState(currentStep);
  const [animatingStep, setAnimatingStep] = useState<number | null>(null);

  useEffect(() => {
    if (currentStep !== prevStep) {
      setAnimatingStep(currentStep);
      setTimeout(() => setAnimatingStep(null), 500);
      setPrevStep(currentStep);
    }
  }, [currentStep, prevStep]);

  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 bg-gray-900/90 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50">
      <div className="text-center mb-4">
        <div className="text-sm text-gray-400">BANKED</div>
        <div className="text-3xl font-black text-green-400">{bankedPoints.toLocaleString()}</div>
      </div>
      <div className="flex flex-col-reverse gap-2">
        {values.map((value, index) => (
          <div
            key={index}
            className={`ladder-step px-6 py-3 rounded-lg text-center font-bold transition-all duration-300 ${
              index === currentStep
                ? 'active bg-yellow-500 text-black scale-110'
                : index < currentStep
                ? 'bg-green-600 text-white'
                : 'bg-gray-700'
            } ${animatingStep === index ? 'ladder-climb' : ''}`}
          >
            {value.toLocaleString()}
          </div>
        ))}
      </div>
      {unbankedPoints > 0 && (
        <div className="mt-4 text-center">
          <div className="text-sm text-gray-400">UNBANKED</div>
          <div className="text-2xl font-black text-yellow-400 animate-pulse">
            {unbankedPoints.toLocaleString()}
          </div>
          <div className="text-xs text-red-400 mt-1 font-medium animate-pulse">Press RED to bank!</div>
        </div>
      )}
    </div>
  );
}

function HotPotatoDisplay({
  state,
  teams,
  explosionResult
}: {
  state: { phase: string; currentHolderId: string; currentHolderTeamId: string; bombTimeLeft: number; bombTotalTime: number; lastCorrectAnswerId?: string };
  teams: Team[];
  explosionResult: HotPotatoExplosionResult | null;
}) {
  const [prevHolderId, setPrevHolderId] = useState(state.currentHolderId);
  const [isPassing, setIsPassing] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (state.currentHolderId !== prevHolderId) {
      setIsPassing(true);
      setTimeout(() => setIsPassing(false), 400);
      setPrevHolderId(state.currentHolderId);
    }
  }, [state.currentHolderId, prevHolderId]);

  useEffect(() => {
    if (state.phase === 'exploded' && explosionResult) {
      setShowExplosion(true);
      // Show explosion for 3 seconds, then show summary
      setTimeout(() => {
        setShowExplosion(false);
        setShowSummary(true);
      }, 3000);
    } else if (state.phase !== 'exploded') {
      // Reset when starting a new cycle
      setShowExplosion(false);
      setShowSummary(false);
    }
  }, [state.phase, explosionResult]);

  // Find the current holder
  let holderName = 'Unknown';
  let holderTeam: Team | null = null;

  for (const team of teams) {
    const player = team.players.find(p => p.id === state.currentHolderId);
    if (player) {
      holderName = player.name;
      holderTeam = team;
      break;
    }
  }

  const bombTimer = state.bombTimeLeft;

  // Summary screen after explosion
  if (showSummary && explosionResult) {
    return (
      <div className="fixed inset-0 bg-gray-900/98 backdrop-blur-lg flex flex-col items-center z-50 overflow-auto py-8">
        <div className="text-6xl mb-4">💥</div>
        <div className="text-4xl font-black text-red-500 mb-2">BOOM!</div>
        <div className="text-2xl text-gray-300 mb-6">
          <span className="font-bold" style={{ color: teams.find(t => t.id === explosionResult.teamId)?.color }}>
            {explosionResult.playerName}
          </span> lost <span className="text-red-400 font-bold">500</span> points!
        </div>

        {/* Question History */}
        <div className="w-full max-w-3xl px-4">
          <div className="text-xl font-bold text-gray-400 mb-4 text-center">
            Questions in this round ({explosionResult.questionHistory.length})
          </div>
          <div className="space-y-3">
            {explosionResult.questionHistory.map((q, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border-2 ${
                  q.wasCorrect === true ? 'border-green-500/50 bg-green-900/20' :
                  q.wasCorrect === false ? 'border-red-500/50 bg-red-900/20' :
                  'border-gray-500/50 bg-gray-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">
                    {q.wasCorrect === true ? '✅' : q.wasCorrect === false ? '❌' : '⏱️'}
                  </div>
                  <div className="flex-1">
                    <div className="text-lg text-white font-medium mb-2">{q.questionText}</div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Correct: </span>
                        <span className="text-green-400 font-bold">{q.correctAnswer}</span>
                      </div>
                      {q.playerAnswer && (
                        <div>
                          <span className="text-gray-400">Answered: </span>
                          <span className={q.wasCorrect ? 'text-green-400' : 'text-red-400'} style={{ fontWeight: 'bold' }}>
                            {q.playerAnswer}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">By: </span>
                        <span style={{ color: q.teamColor, fontWeight: 'bold' }}>{q.playerName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-gray-500 text-lg">
          Waiting for host to start next round...
        </div>
      </div>
    );
  }

  // Explosion overlay (brief animation)
  if (showExplosion) {
    return (
      <div className="fixed inset-0 bg-red-900/95 backdrop-blur-lg flex flex-col items-center justify-center z-50 animate-pulse">
        <div className="text-[200px] animate-bounce">💥</div>
        <div className="text-6xl font-black text-white mt-8">BOOM!</div>
        <div className="text-3xl text-red-300 mt-4">
          <span style={{ color: holderTeam?.color }}>{holderName}</span> loses 500 points!
        </div>
      </div>
    );
  }

  // Passing phase overlay
  if (state.phase === 'passing') {
    // Find the team that answered correctly (the passer)
    const passerTeam = teams.find(t => t.players.some(p => p.id === state.lastCorrectAnswerId));
    const passerTeamName = passerTeam?.funName || passerTeam?.name || holderName;

    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center z-50">
        <div className="text-8xl mb-6 animate-bounce">💣</div>
        <div className="text-4xl font-black text-green-400 mb-4">CORRECT! +250</div>
        <div className="text-3xl text-white mb-8">
          <span style={{ color: passerTeam?.color }}>{passerTeamName}</span>, pass the bomb!
        </div>
        <div className="text-xl text-gray-400 mb-6">Press a colored button to pass to that team:</div>
        <div className="flex gap-6">
          {teams.map((team) => {
            const player = team.players[0];
            if (!player || player.id === state.lastCorrectAnswerId) return null;
            return (
              <div
                key={team.id}
                className="flex flex-col items-center p-4 rounded-xl border-2"
                style={{ borderColor: team.color, backgroundColor: `${team.color}20` }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black mb-2"
                  style={{ backgroundColor: team.color }}
                >
                  {player.controllerIndex}
                </div>
                <div className="text-lg font-bold" style={{ color: team.color }}>
                  {team.funName || team.name}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-8 text-2xl font-bold text-yellow-400">
          Timer paused: {bombTimer}s remaining
        </div>
      </div>
    );
  }

  // Normal playing state - side panel
  return (
    <div className="fixed left-8 top-1/2 -translate-y-1/2 bg-gray-900/90 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 text-center">
      <div className={`text-8xl mb-4 ${bombTimer <= 3 ? 'bomb' : ''} ${isPassing ? 'potato-pass' : ''}`}>
        💣
      </div>
      <div className="text-sm text-gray-400">HELD BY</div>
      <div className="text-2xl font-bold transition-all" style={{ color: holderTeam?.color }}>
        {holderName}
      </div>
      <div className={`mt-4 text-5xl font-black transition-all ${
        bombTimer <= 3 ? 'text-red-500 countdown-urgent' :
        bombTimer <= 5 ? 'text-yellow-500 animate-pulse' :
        'text-white'
      }`}>
        {bombTimer}
      </div>
      {bombTimer <= 3 && (
        <div className="text-red-400 text-sm mt-2 font-bold animate-pulse">
          ANSWER NOW!
        </div>
      )}
    </div>
  );
}

function GameOverScreen({ teams }: { teams: Team[] }) {
  const navigate = useNavigate();
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const winner = sortedTeams[0];
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="text-center relative">
      {/* Confetti effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#ff0', '#f0f', '#0ff', '#f00', '#0f0', '#00f'][Math.floor(Math.random() * 6)],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}

      <h1 className="text-8xl font-black mb-8 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent animate-pulse">
        GAME OVER!
      </h1>

      <div className="mb-12">
        <div className="text-2xl text-gray-400 mb-4">WINNER</div>
        <div className="text-6xl mb-2 animate-bounce">🏆</div>
        <div
          className="text-6xl font-black mb-2"
          style={{ color: winner.color }}
        >
          {winner.funName || winner.name}
        </div>
        <div className="text-4xl text-gray-300">{winner.score.toLocaleString()} points</div>
      </div>

      <div className="flex gap-12 justify-center mb-12">
        {sortedTeams.map((team, index) => (
          <div key={team.id} className="leaderboard-row flex-col items-center">
            <div className="text-5xl font-bold mb-2">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
            </div>
            <div className="text-xl font-bold" style={{ color: team.color }}>
              {team.funName || team.name}
            </div>
            <div className="text-2xl text-gray-300">{team.score.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/')}
        className="btn-primary text-2xl py-4 px-12"
      >
        Play Again
      </button>
    </div>
  );
}

function PointsAnimationOverlay({
  pointChanges,
  onComplete
}: {
  pointChanges: PointsAnimationData[];
  onComplete: () => void;
}) {
  // Check if anyone earned points
  const hasPointChanges = pointChanges.some(pc => pc.change !== 0);

  // Phases: enter -> showPoints -> showScores -> exit
  // If no points earned, skip showPoints phase
  const [phase, setPhase] = useState<'enter' | 'showPoints' | 'showScores' | 'exit'>('enter');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animatedScores, setAnimatedScores] = useState<Record<string, number>>({});

  // Initialize animated scores to current values (same as old since no change)
  useEffect(() => {
    const initial: Record<string, number> = {};
    pointChanges.forEach(pc => {
      initial[pc.teamId] = pc.oldScore;
    });
    setAnimatedScores(initial);
  }, [pointChanges]);

  useEffect(() => {
    // Animation sequence - enter phase
    // If no points earned, go straight to showScores after a brief pause
    const nextPhase = hasPointChanges ? 'showPoints' : 'showScores';
    const delay = hasPointChanges ? 100 : 800; // Longer pause to read "no points" message
    const enterTimer = setTimeout(() => setPhase(nextPhase), delay);
    return () => clearTimeout(enterTimer);
  }, [hasPointChanges]);

  useEffect(() => {
    if (phase === 'showPoints' && hasPointChanges) {
      // Show each team's points one by one (only teams with changes)
      const teamsWithChanges = pointChanges.filter(pc => pc.change !== 0);
      if (currentIndex < teamsWithChanges.length) {
        const nextTimer = setTimeout(() => {
          setCurrentIndex(prev => prev + 1);
        }, 600);
        return () => clearTimeout(nextTimer);
      } else {
        // All points shown, transition to score animation
        const scoreTimer = setTimeout(() => {
          setPhase('showScores');
        }, 800);
        return () => clearTimeout(scoreTimer);
      }
    }
  }, [phase, currentIndex, pointChanges, hasPointChanges]);

  useEffect(() => {
    if (phase === 'showScores') {
      // Animate scores from old to new (or just show current if no changes)
      const duration = hasPointChanges ? 1500 : 800; // Shorter if no animation needed
      const steps = hasPointChanges ? 30 : 1;
      const stepDuration = duration / steps;
      let step = 0;

      const interval = setInterval(() => {
        step++;
        const progress = step / steps;
        // Ease out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        const newScores: Record<string, number> = {};
        pointChanges.forEach(pc => {
          newScores[pc.teamId] = Math.round(pc.oldScore + (pc.newScore - pc.oldScore) * eased);
        });
        setAnimatedScores(newScores);

        if (step >= steps) {
          clearInterval(interval);
          // Wait a moment then exit
          setTimeout(() => setPhase('exit'), hasPointChanges ? 1000 : 1500);
        }
      }, stepDuration);

      return () => clearInterval(interval);
    }
  }, [phase, pointChanges, hasPointChanges]);

  useEffect(() => {
    if (phase === 'exit') {
      const closeTimer = setTimeout(onComplete, 500);
      return () => clearTimeout(closeTimer);
    }
  }, [phase, onComplete]);

  // Get teams to display based on phase
  const teamsWithChanges = pointChanges.filter(pc => pc.change !== 0);

  return (
    <div
      className={`fixed inset-0 bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center z-50 transition-all duration-500 ${
        phase === 'enter' ? 'opacity-0 scale-95' :
        phase === 'exit' ? 'opacity-0 scale-105' :
        'opacity-100 scale-100'
      }`}
    >
      {/* Header */}
      <div className="text-4xl text-gray-400 mb-8 font-bold tracking-wider">
        {!hasPointChanges ? 'NO POINTS THIS ROUND' :
          phase === 'showScores' ? 'LEADERBOARD' : 'POINTS EARNED'}
      </div>

      {/* Show teams with point changes during showPoints phase */}
      {phase === 'showPoints' && hasPointChanges && (
        <div className="flex flex-col gap-6 items-center mb-8">
          {teamsWithChanges.slice(0, currentIndex + 1).map((pc, idx) => (
            <div
              key={pc.teamId}
              className={`flex items-center gap-6 transition-all duration-500 ${
                idx === currentIndex ? 'scale-110' : 'scale-100'
              }`}
              style={{
                opacity: idx <= currentIndex ? 1 : 0,
                transform: `translateY(${idx <= currentIndex ? 0 : 20}px)`
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black"
                style={{ backgroundColor: pc.teamColor }}
              >
                {pc.teamName.charAt(0)}
              </div>
              <div className="text-3xl font-bold text-white min-w-[200px]">
                {pc.teamName}
              </div>
              <div
                className={`text-5xl font-black min-w-[150px] text-right ${
                  pc.change > 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {pc.change > 0 ? '+' : ''}{pc.change.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show all teams with current scores during showScores phase or when no points earned */}
      {(phase === 'showScores' || (!hasPointChanges && phase !== 'exit')) && (
        <div className="flex flex-col gap-4 items-center">
          {/* Sort by animated score (descending) for leaderboard */}
          {[...pointChanges]
            .sort((a, b) => (animatedScores[b.teamId] ?? b.newScore) - (animatedScores[a.teamId] ?? a.newScore))
            .map((pc, index) => {
              const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
              const isFirst = index === 0;
              return (
                <div
                  key={pc.teamId}
                  className={`flex items-center gap-6 transition-all duration-500 ${
                    isFirst ? 'scale-110' : ''
                  }`}
                >
                  {/* Rank */}
                  <div className={`text-4xl min-w-[60px] text-center ${isFirst ? 'animate-bounce' : ''}`}>
                    {rankEmoji}
                  </div>
                  <div
                    className={`${isFirst ? 'w-16 h-16' : 'w-12 h-12'} rounded-full flex items-center justify-center text-2xl font-black transition-all`}
                    style={{ backgroundColor: pc.teamColor }}
                  >
                    {pc.teamName.charAt(0)}
                  </div>
                  <div className={`${isFirst ? 'text-4xl' : 'text-3xl'} font-bold text-white min-w-[200px]`}>
                    {pc.teamName}
                  </div>
                  <div
                    className={`${isFirst ? 'text-7xl' : 'text-5xl'} font-black min-w-[180px] text-right transition-all`}
                    style={{ color: pc.teamColor }}
                  >
                    {(animatedScores[pc.teamId] ?? pc.newScore).toLocaleString()}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Sparkle effects - only when points were earned */}
      {(phase === 'showPoints' || phase === 'showScores') && hasPointChanges && pointChanges.some(pc => pc.change > 0) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

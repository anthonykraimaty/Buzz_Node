import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { ROUND_ICONS } from '../types';

export default function HostPage() {
  const navigate = useNavigate();
  const [showRetryModal, setShowRetryModal] = useState(false);
  const {
    gameState,
    timeLeft,
    controllerConnected,
    hotPotatoExplosion,
    startGame,
    startRound,
    retryRound,
    startQuestion,
    nextQuestion,
    revealAnswer,
    pauseGame,
    resumeGame,
    endRound,
    endGame,
    resetBuzz,
    testLights,
    setLights,
    adjustScore,
    triggerPointsAnimation,
    updateSettings,
    startNewBombCycle,
    resetBombTimer,
  } = useGameStore();

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-400 mb-4">No active game</p>
          <button
            onClick={() => navigate('/')}
            className="bg-buzz-blue hover:bg-blue-600 px-6 py-3 rounded-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Count total questions across all rounds
  const totalQuestions = gameState.rounds?.reduce((sum, r) => sum + (r.questions?.length || 0), 0) || 0;
  const canStart = gameState.teams.length >= 1 && totalQuestions >= 1;

  const isLobby = gameState.status === 'lobby';
  const isSetup = gameState.status === 'setup';
  const isPlaying = gameState.status === 'playing';
  const isPaused = gameState.status === 'paused';
  const isFinished = gameState.status === 'finished';

  // Get current round info
  const currentRound = gameState.rounds?.[gameState.currentRoundIndex];
  const currentQuestion = gameState.currentQuestion;
  const questionIndex = currentRound?.currentQuestionIndex ?? 0;
  const totalRoundQuestions = currentRound?.questions?.length ?? 0;

  // Get next question preview
  const nextQuestionIndex = questionIndex + 1;
  const upcomingQuestion = currentRound?.questions?.[nextQuestionIndex];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Host Controls</h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/game')}
              className="bg-buzz-blue hover:bg-blue-600 px-4 py-2 rounded-lg"
            >
              View Game Screen
            </button>
            <button
              onClick={() => navigate('/setup')}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              Setup
            </button>
          </div>
        </div>

        {/* Game Status */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-gray-400 text-sm">Game Status</div>
              <div
                className={`text-2xl font-bold capitalize ${
                  isPlaying
                    ? 'text-green-400'
                    : isPaused
                    ? 'text-yellow-400'
                    : isFinished
                    ? 'text-blue-400'
                    : 'text-gray-400'
                }`}
              >
                {gameState.status}
              </div>
            </div>
            {currentRound && (
              <div className="text-center">
                <div className="text-gray-400 text-sm">Current Round</div>
                <div className="text-xl font-bold flex items-center gap-2">
                  <span>{ROUND_ICONS[currentRound.config.type]}</span>
                  <span>{currentRound.config.name}</span>
                </div>
              </div>
            )}
            <div className="text-right">
              <div className="text-gray-400 text-sm">Question</div>
              <div className="text-2xl font-bold">
                {questionIndex + 1} / {totalRoundQuestions}
              </div>
            </div>
          </div>
          {timeLeft > 0 && (
            <div className="mt-4 text-center">
              <div className="text-gray-400 text-sm">Time Remaining</div>
              <div className={`text-4xl font-black ${timeLeft <= 5 ? 'text-red-500' : timeLeft <= 10 ? 'text-yellow-400' : 'text-white'}`}>
                {timeLeft}s
              </div>
            </div>
          )}

          {/* Round Info for Host to explain */}
          {currentRound && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              {/* NO BUZZER indicator for direct answer rounds */}
              {(currentRound.config.type === 'multiple-choice' || currentRound.config.type === 'true-false' ||
                currentRound.config.type === 'picture-sound' || currentRound.config.type === 'speed-race') && (
                <div className="text-center mb-3">
                  <span className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-black text-lg animate-pulse">
                    NO BUZZER - ANSWER DIRECTLY!
                  </span>
                </div>
              )}
              <div className="text-center mb-3">
                <div className="text-lg text-gray-300 italic">"{currentRound.config.description}"</div>
              </div>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                {currentRound.config.type === 'steal-points' ? (
                  <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg">
                    Steal: <span className="font-bold">500</span> pts
                  </div>
                ) : currentRound.config.type === 'hot-potato' ? (
                  <>
                    <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg">
                      Correct: <span className="font-bold">+250</span>
                    </div>
                    <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg">
                      Explode: <span className="font-bold">-500</span>
                    </div>
                  </>
                ) : (
                  <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg">
                    Correct: <span className="font-bold">+{currentRound.config.pointsCorrect}</span>
                  </div>
                )}
                {currentRound.config.pointsWrong !== 0 && currentRound.config.type !== 'hot-potato' && (
                  <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg">
                    Wrong: <span className="font-bold">{currentRound.config.type === 'steal-points' ? '-500' : currentRound.config.pointsWrong}</span>
                  </div>
                )}
                {currentRound.config.pointsFast && (
                  <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg">
                    Fast Bonus: <span className="font-bold">+{currentRound.config.pointsFast}</span>
                  </div>
                )}
                {currentRound.config.pointsSlow && (
                  <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg">
                    Slow: <span className="font-bold">+{currentRound.config.pointsSlow}</span>
                  </div>
                )}
                <div className="bg-gray-700 text-gray-300 px-3 py-1 rounded-lg">
                  Time: <span className="font-bold">{currentRound.config.timePerQuestion}s</span>
                </div>
              </div>
              {currentRound.config.type === 'fastest-finger' && (
                <div className="text-center mt-2 text-xs text-gray-500">
                  All teams buzz first to set their order. Then each team answers in order - wrong = next buzzer's chance!
                </div>
              )}
              {currentRound.config.type === 'multiple-choice' && (
                <div className="text-center mt-2 text-xs text-gray-500">
                  Everyone answers! Faster answers earn more points.
                </div>
              )}
              {currentRound.config.type === 'steal-points' && (
                <div className="text-center mt-2 text-xs text-gray-500">
                  Buzz in, answer correctly, then steal 500 points from a rival! Wrong answer = -500 points.
                </div>
              )}
              {currentRound.config.type === 'ladder' && currentRound.config.ladderValues && (
                <div className="text-center mt-2 text-xs text-gray-500">
                  Ladder values: {currentRound.config.ladderValues.join(' → ')} - Bank before you fall!
                </div>
              )}
              {currentRound.config.type === 'hot-potato' && (
                <div className="text-center mt-2 text-xs text-gray-500">
                  Bomb holder answers! Correct = +250 & pass bomb. Wrong = bomb stays. Timer hits 0 = -500 points!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Controls */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Lobby/Setup - Start Game */}
          {(isLobby || isSetup) && (
            <button
              onClick={() => {
                startGame();
              }}
              disabled={!canStart}
              className={`col-span-2 py-6 rounded-xl text-2xl font-bold ${
                canStart
                  ? 'bg-buzz-green hover:bg-green-600'
                  : 'bg-gray-600 cursor-not-allowed opacity-50'
              }`}
            >
              Start Game
            </button>
          )}

          {/* Playing - Show question controls */}
          {isPlaying && (
            <>
              {/* Round completed - show next round button */}
              {currentRound?.status === 'completed' && (
                <div className="col-span-2 text-center py-4">
                  <div className="text-xl text-gray-400 mb-2">Round Complete!</div>
                  <button
                    onClick={nextQuestion}
                    className="bg-buzz-green hover:bg-green-600 px-8 py-3 rounded-xl text-xl font-bold mt-2"
                  >
                    Start Next Round
                  </button>
                  <div className="text-sm text-gray-500 animate-pulse mt-2">or wait for auto-advance...</div>
                </div>
              )}

              {/* Hot Potato: Start New Bomb Cycle button - shown after explosion */}
              {currentRound?.config.type === 'hot-potato' &&
               gameState.hotPotatoState?.phase === 'exploded' &&
               hotPotatoExplosion && (
                <button
                  onClick={startNewBombCycle}
                  className="col-span-2 bg-red-600 hover:bg-red-500 py-6 rounded-xl text-2xl font-bold animate-pulse"
                >
                  💣 Start New Bomb Cycle
                </button>
              )}

              {/* Hot Potato: Reset Bomb Timer button - always visible during hot potato gameplay */}
              {currentRound?.config.type === 'hot-potato' &&
               gameState.hotPotatoState &&
               gameState.hotPotatoState.phase === 'playing' && (
                <button
                  onClick={resetBombTimer}
                  className="col-span-2 bg-orange-600 hover:bg-orange-500 py-4 rounded-xl text-xl font-bold"
                >
                  🔄 Reset Bomb Timer ({gameState.hotPotatoState.bombTotalTime}s)
                </button>
              )}

              {/* Start Question button - shown when no question is active and round is not completed */}
              {!currentQuestion && currentRound?.status !== 'completed' &&
               !(currentRound?.config.type === 'hot-potato' && gameState.hotPotatoState?.phase === 'exploded') && (
                <button
                  onClick={startQuestion}
                  className="col-span-2 bg-buzz-green hover:bg-green-600 py-6 rounded-xl text-2xl font-bold"
                >
                  Start Question
                </button>
              )}

              {/* Question active controls */}
              {currentQuestion && currentRound?.status !== 'completed' && (
                <>
                  {!gameState.answerRevealed ? (
                    <button
                      onClick={revealAnswer}
                      className="col-span-2 bg-buzz-orange hover:bg-orange-600 py-4 rounded-xl text-xl font-bold"
                    >
                      Reveal Answer
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={triggerPointsAnimation}
                        className="bg-purple-600 hover:bg-purple-500 py-4 rounded-xl text-xl font-bold"
                      >
                        Show Points
                      </button>
                      <button
                        onClick={nextQuestion}
                        className="bg-buzz-blue hover:bg-blue-600 py-4 rounded-xl text-xl font-bold"
                      >
                        Next Question
                      </button>
                    </>
                  )}
                </>
              )}

              <button
                onClick={resetBuzz}
                className="bg-gray-700 hover:bg-gray-600 py-4 rounded-xl text-xl font-bold"
              >
                Reset Buzzers
              </button>
              <button
                onClick={() => {
                  pauseGame();
                }}
                className="bg-yellow-600 hover:bg-yellow-500 py-4 rounded-xl text-xl font-bold"
              >
                Pause & Save
              </button>

              <button
                onClick={() => setShowRetryModal(true)}
                className="bg-orange-600 hover:bg-orange-500 py-4 rounded-xl text-xl font-bold"
              >
                Retry Round
              </button>
              <button
                onClick={endRound}
                className="bg-purple-600 hover:bg-purple-500 py-4 rounded-xl text-xl font-bold"
              >
                End Round
              </button>
              <button
                onClick={endGame}
                className="bg-red-600 hover:bg-red-500 py-4 rounded-xl text-xl font-bold"
              >
                End Game
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={resumeGame}
                className="col-span-2 bg-buzz-green hover:bg-green-600 py-6 rounded-xl text-2xl font-bold"
              >
                Resume Game
              </button>
              <button
                onClick={() => navigate('/')}
                className="col-span-2 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl text-xl font-bold"
              >
                Exit (Resume Later)
              </button>
              <button
                onClick={endGame}
                className="col-span-2 bg-red-600 hover:bg-red-500 py-4 rounded-xl text-xl font-bold"
              >
                End Game Permanently
              </button>
            </>
          )}

          {isFinished && (
            <button
              onClick={() => navigate('/')}
              className="col-span-2 bg-buzz-blue hover:bg-blue-600 py-6 rounded-xl text-2xl font-bold"
            >
              New Game
            </button>
          )}
        </div>

        {/* Round Selection (when in lobby/setup) */}
        {(isLobby || isSetup) && gameState.rounds && gameState.rounds.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
            <div className="text-gray-400 text-sm mb-4">Select Starting Round</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {gameState.rounds.map((round, index) => (
                <button
                  key={round.id}
                  onClick={() => startRound(index)}
                  className={`p-4 rounded-xl text-center transition-all ${
                    gameState.currentRoundIndex === index
                      ? 'bg-buzz-blue ring-2 ring-blue-400'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{ROUND_ICONS[round.config.type]}</div>
                  <div className="text-sm font-medium">{round.config.name}</div>
                  <div className="text-xs text-gray-400">{round.questions?.length || 0} Q</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Question Preview */}
        {currentQuestion && (
          <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
            <div className="text-gray-400 text-sm mb-2">Current Question ({questionIndex + 1}/{totalRoundQuestions})</div>
            <div className="text-xl font-semibold mb-4">{currentQuestion.text}</div>
            <div className="grid grid-cols-2 gap-2">
              {currentQuestion.choices.map((choice) => (
                <div
                  key={choice.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                    choice.isCorrect
                      ? 'bg-green-500/30 ring-1 ring-green-500'
                      : 'bg-gray-700'
                  }`}
                >
                  <span
                    className="w-6 h-6 rounded-full"
                    style={{
                      backgroundColor:
                        choice.color === 'blue'
                          ? '#1e88e5'
                          : choice.color === 'orange'
                          ? '#fb8c00'
                          : choice.color === 'green'
                          ? '#43a047'
                          : '#fdd835',
                    }}
                  />
                  <span>{choice.text}</span>
                  {choice.isCorrect && (
                    <span className="text-green-400 ml-auto">✓ Correct</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Question Preview */}
        {upcomingQuestion && (
          <div className="bg-gray-700/30 rounded-xl p-4 mb-6 border border-gray-600/50">
            <div className="text-gray-500 text-sm mb-2">Next Question ({nextQuestionIndex + 1}/{totalRoundQuestions})</div>
            <div className="text-lg text-gray-300 mb-3">{upcomingQuestion.text}</div>
            <div className="grid grid-cols-2 gap-2">
              {upcomingQuestion.choices.map((choice) => (
                <div
                  key={choice.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                    choice.isCorrect
                      ? 'bg-green-500/20 ring-1 ring-green-500/50'
                      : 'bg-gray-700/50'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{
                      backgroundColor:
                        choice.color === 'blue'
                          ? '#1e88e5'
                          : choice.color === 'orange'
                          ? '#fb8c00'
                          : choice.color === 'green'
                          ? '#43a047'
                          : '#fdd835',
                    }}
                  />
                  <span className="text-gray-300">{choice.text}</span>
                  {choice.isCorrect && (
                    <span className="text-green-400/70 ml-auto text-xs">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buzz Status */}
        {gameState.buzzedPlayers && gameState.buzzedPlayers.length > 0 && (
          <div className="bg-buzz-red/20 border border-buzz-red rounded-xl p-6 mb-6">
            <div className="text-center">
              <div className="text-lg text-gray-300">First Buzz</div>
              <div className="text-3xl font-bold text-buzz-red">
                Controller {gameState.buzzedPlayers[0].controllerIndex}
              </div>
              <div className="text-gray-400">
                {(() => {
                  const team = gameState.teams.find((t) => t.id === gameState.buzzedPlayers[0]?.teamId);
                  return team?.players[0]?.name || team?.name || 'Unknown Team';
                })()}
              </div>
              {gameState.buzzedPlayers.length > 1 && (
                <div className="mt-2 text-sm text-gray-500">
                  +{gameState.buzzedPlayers.length - 1} more buzzed
                </div>
              )}
            </div>
          </div>
        )}

        {/* Score Adjustment with Controller Info */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
          <div className="text-gray-400 text-sm mb-4">Teams & Score Adjustment</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gameState.teams.map((team) => {
              const assignedBuzzers = team.players.map(p => p.controllerIndex);
              return (
                <div
                  key={team.id}
                  className="bg-gray-900/50 rounded-lg p-4"
                  style={{ borderLeft: `4px solid ${team.color}` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-lg">{team.players[0]?.name || team.name}</div>
                      <div className="text-3xl font-black" style={{ color: team.color }}>
                        {team.score}
                      </div>
                    </div>
                    {/* Show assigned buzzers */}
                    <div className="flex gap-2">
                      {assignedBuzzers.length > 0 ? (
                        assignedBuzzers.map(buzzer => (
                          <div
                            key={buzzer}
                            className="w-10 h-10 rounded-full bg-buzz-red flex items-center justify-center font-bold text-lg"
                            title={`Buzzer ${buzzer}`}
                          >
                            {buzzer}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                          No buzzer
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => adjustScore(team.id, -100)}
                      className="bg-red-900/50 hover:bg-red-800 px-3 py-1 rounded flex-1"
                    >
                      -100
                    </button>
                    <button
                      onClick={() => adjustScore(team.id, -50)}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded flex-1"
                    >
                      -50
                    </button>
                    <button
                      onClick={() => adjustScore(team.id, 50)}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded flex-1"
                    >
                      +50
                    </button>
                    <button
                      onClick={() => adjustScore(team.id, 100)}
                      className="bg-green-900/50 hover:bg-green-800 px-3 py-1 rounded flex-1"
                    >
                      +100
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Flow Settings - Quick toggles for auto behaviors */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
          <div className="text-gray-400 text-sm mb-4">Game Flow Settings</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => updateSettings({ autoRevealAnswer: !(gameState.settings?.autoRevealAnswer ?? true) })}
              className={`flex items-center gap-3 cursor-pointer rounded-lg p-4 transition-all duration-200 border-2 ${
                (gameState.settings?.autoRevealAnswer ?? true)
                  ? 'bg-blue-500/20 border-blue-500'
                  : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                (gameState.settings?.autoRevealAnswer ?? true)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {(gameState.settings?.autoRevealAnswer ?? true) ? '✓' : ''}
              </div>
              <div className="flex-1">
                <div className="font-medium">Auto Reveal Answer</div>
                <div className="text-xs text-gray-400">5s after all answers or timeout</div>
              </div>
            </div>
            <div
              onClick={() => updateSettings({ autoShowPoints: !(gameState.settings?.autoShowPoints ?? true) })}
              className={`flex items-center gap-3 cursor-pointer rounded-lg p-4 transition-all duration-200 border-2 ${
                (gameState.settings?.autoShowPoints ?? true)
                  ? 'bg-purple-500/20 border-purple-500'
                  : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                (gameState.settings?.autoShowPoints ?? true)
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {(gameState.settings?.autoShowPoints ?? true) ? '✓' : ''}
              </div>
              <div className="flex-1">
                <div className="font-medium">Auto Show Points</div>
                <div className="text-xs text-gray-400">3s after answer reveal</div>
              </div>
            </div>
            <div
              onClick={() => updateSettings({ autoNextQuestion: !(gameState.settings?.autoNextQuestion ?? true) })}
              className={`flex items-center gap-3 cursor-pointer rounded-lg p-4 transition-all duration-200 border-2 ${
                (gameState.settings?.autoNextQuestion ?? true)
                  ? 'bg-green-500/20 border-green-500'
                  : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                (gameState.settings?.autoNextQuestion ?? true)
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {(gameState.settings?.autoNextQuestion ?? true) ? '✓' : ''}
              </div>
              <div className="flex-1">
                <div className="font-medium">Auto Next Question</div>
                <div className="text-xs text-gray-400">Advance after points shown</div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-500 text-center">
            Click to toggle • Turn all OFF for full manual control
          </div>
        </div>

        {/* Controller Controls - Only show assigned buzzers */}
        <div className="bg-gray-800/50 rounded-xl p-6">
          <div className="text-gray-400 text-sm mb-4">
            Controller Lights {controllerConnected ? '(Connected)' : '(Disconnected)'}
          </div>
          {(() => {
            // Get all assigned controller indices
            const assignedControllers = gameState.teams
              .flatMap(t => t.players.map(p => p.controllerIndex))
              .sort();

            return (
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={testLights}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
                >
                  Test All Lights
                </button>
                {assignedControllers.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
                        assignedControllers.forEach(c => lights[c - 1] = true);
                        setLights(lights);
                      }}
                      className="bg-buzz-red hover:bg-red-600 px-4 py-2 rounded-lg"
                    >
                      All On
                    </button>
                    <button
                      onClick={() => setLights([false, false, false, false])}
                      className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
                    >
                      All Off
                    </button>
                  </>
                )}
                {assignedControllers.map((controllerIndex) => {
                  const team = gameState.teams.find(t =>
                    t.players.some(p => p.controllerIndex === controllerIndex)
                  );
                  return (
                    <button
                      key={controllerIndex}
                      onClick={() => {
                        const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
                        lights[controllerIndex - 1] = true;
                        setLights(lights);
                      }}
                      className="px-4 py-2 rounded-lg flex items-center gap-2"
                      style={{
                        backgroundColor: team?.color || '#374151',
                        opacity: 0.9
                      }}
                    >
                      <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
                        {controllerIndex}
                      </span>
                      <span className="text-sm">{team?.players[0]?.name || team?.name || `P${controllerIndex}`}</span>
                    </button>
                  );
                })}
                {assignedControllers.length === 0 && (
                  <div className="text-gray-500 text-sm">
                    No buzzers assigned to teams yet
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Retry Round Modal */}
      {showRetryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-center">Retry Round</h2>
            <p className="text-gray-400 text-center mb-6">
              Choose how to handle scores when retrying this round:
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  retryRound(false);
                  setShowRetryModal(false);
                }}
                className="w-full bg-orange-600 hover:bg-orange-500 py-4 rounded-xl text-lg font-bold flex flex-col items-center"
              >
                <span>Reset Scores</span>
                <span className="text-sm font-normal text-orange-200">
                  Restore scores to what they were before this round started
                </span>
              </button>
              <button
                onClick={() => {
                  retryRound(true);
                  setShowRetryModal(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl text-lg font-bold flex flex-col items-center"
              >
                <span>Keep Scores</span>
                <span className="text-sm font-normal text-blue-200">
                  Keep current scores and just restart the questions
                </span>
              </button>
              <button
                onClick={() => setShowRetryModal(false)}
                className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-xl text-lg font-medium mt-4"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

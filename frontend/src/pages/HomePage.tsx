import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { ROUND_ICONS } from '../types';

export default function HomePage() {
  const navigate = useNavigate();
  const { gameState, savedGames, loadGame, clearGame, testLights, controllerConnected, connected, forceReconnect } = useGameStore();
  const [showGameList, setShowGameList] = useState(false);

  const handleSelectGame = (gameId: string) => {
    loadGame(gameId);
    setShowGameList(false);
    // Find the game to check its status
    const game = savedGames.find(g => g.gameId === gameId);
    if (game?.status === 'paused' || game?.status === 'playing') {
      navigate('/host');  // Go directly to host controls for resumable games
    } else {
      navigate('/setup');
    }
  };

  const handleContinueGame = () => {
    // If game is playing, go to host controls, otherwise setup
    if (gameState?.status === 'playing' || gameState?.status === 'paused') {
      navigate('/host');
    } else {
      navigate('/setup');
    }
  };

  const handleNewGame = () => {
    clearGame();
    navigate('/admin');
  };

  // Check if there's an active game to resume
  const hasActiveGame = gameState && gameState.status !== 'finished';
  const isGameInProgress = gameState?.status === 'playing' || gameState?.status === 'paused';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Connection status - clickable to reconnect */}
      <button
        onClick={forceReconnect}
        className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
          connected
            ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 animate-pulse'
        }`}
        title="Click to reconnect"
      >
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        {connected ? 'Online' : 'Offline - Click to reconnect'}
      </button>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center mb-12">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-4 mb-4">
            <div className="buzz-button red w-20 h-20 text-4xl">B</div>
            <div className="buzz-button yellow w-20 h-20 text-4xl">U</div>
            <div className="buzz-button green w-20 h-20 text-4xl">Z</div>
            <div className="buzz-button orange w-20 h-20 text-4xl">Z</div>
            <div className="buzz-button blue w-20 h-20 text-4xl">!</div>
          </div>
        </div>

        <h1 className="text-6xl md:text-8xl font-black mb-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-lg">
          QUIZ GAME SHOW
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 mb-2">
          The Ultimate Party Quiz Experience
        </p>
        <p className="text-gray-500">
          With PlayStation 2 Buzz Controller Support
        </p>
      </div>

      {/* Game selection */}
      <div className="relative z-10 flex flex-col gap-4 w-full max-w-lg">
        {/* Active game banner */}
        {hasActiveGame && (
          <div className={`card p-4 border-2 ${
            gameState.status === 'paused'
              ? 'border-yellow-500/50 bg-yellow-500/10'
              : gameState.status === 'playing'
              ? 'border-green-500/50 bg-green-500/10'
              : 'border-blue-500/50 bg-blue-500/10'
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${
                    gameState.status === 'paused' ? 'text-yellow-400' :
                    gameState.status === 'playing' ? 'text-green-400' : 'text-blue-400'
                  }`}>
                    {gameState.name}
                  </span>
                  {gameState.status === 'paused' && (
                    <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded font-bold">
                      PAUSED
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {gameState.status === 'paused' ? 'Game paused - ready to resume' :
                   gameState.status === 'playing' ? 'Game in progress' :
                   `Status: ${gameState.status}`}
                  {' • '}{gameState.teams.length} team{gameState.teams.length !== 1 ? 's' : ''}
                  {gameState.currentRoundIndex >= 0 && (
                    <> • Round {gameState.currentRoundIndex + 1}</>
                  )}
                </p>
                {/* Show current scores */}
                {isGameInProgress && gameState.teams.length > 0 && (
                  <div className="flex gap-3 mt-2">
                    {gameState.teams.slice(0, 4).map(team => (
                      <div key={team.id} className="flex items-center gap-1 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                        <span className="text-gray-300">{team.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleContinueGame}
                  className={gameState.status === 'paused' ? 'btn-success' : 'btn-primary'}
                >
                  {gameState.status === 'paused' ? '▶ Resume' :
                   gameState.status === 'playing' ? 'Go to Game' : 'Continue'}
                </button>
                {isGameInProgress && (
                  <button
                    onClick={() => navigate('/game')}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Game Screen
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Show game list modal */}
        {showGameList ? (
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Select a Game</h3>
              <button
                onClick={() => setShowGameList(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {savedGames.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">No saved games found.</p>
                <p className="text-sm">Create a new game in the Admin panel first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Show paused/playing games first */}
                {savedGames
                  .sort((a, b) => {
                    const order: Record<string, number> = { paused: 0, playing: 1, lobby: 2, finished: 3 };
                    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                  })
                  .map((game) => {
                    const isPausedGame = game.status === 'paused';
                    const isPlayingGame = game.status === 'playing';
                    return (
                      <button
                        key={game.gameId}
                        onClick={() => handleSelectGame(game.gameId)}
                        className={`w-full p-4 rounded-lg text-left transition-colors ${
                          isPausedGame
                            ? 'bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30'
                            : isPlayingGame
                            ? 'bg-green-500/10 hover:bg-green-500/20 border border-green-500/30'
                            : 'bg-gray-800/50 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`font-bold ${
                              isPausedGame ? 'text-yellow-400' :
                              isPlayingGame ? 'text-green-400' : 'text-white'
                            }`}>
                              {game.name}
                            </p>
                            <p className="text-sm text-gray-400">
                              {game.questionCount} questions • {game.teamCount} teams
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            game.status === 'lobby' ? 'bg-blue-500/20 text-blue-400' :
                            game.status === 'playing' ? 'bg-green-500/20 text-green-400' :
                            game.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                            game.status === 'finished' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {isPausedGame ? '▶ Resume' : game.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowGameList(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleNewGame}
                className="btn-primary flex-1"
              >
                Create New Game
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowGameList(true)}
              className="btn-success text-2xl py-6 hover:scale-105 transition-transform"
            >
              {savedGames.length > 0 ? 'Select Game' : 'New Game'}
            </button>

            {hasActiveGame && (
              <button
                onClick={() => navigate('/host')}
                className="btn-primary text-xl py-4"
              >
                Host Controls
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/test')}
                className="btn-secondary flex-1"
              >
                Test Buzzers
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="btn-secondary flex-1"
              >
                Admin
              </button>
            </div>

            {controllerConnected && (
              <button
                onClick={testLights}
                className="btn-secondary text-sm"
              >
                Test Controller Lights
              </button>
            )}
          </>
        )}
      </div>

      {/* Controller visualization */}
      <div className="relative z-10 mt-12 flex gap-6">
        {[1, 2, 3, 4].map((player) => (
          <div key={player} className="text-center group">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
                controllerConnected
                  ? 'buzz-button red cursor-pointer group-hover:scale-110'
                  : 'bg-gray-800 border-2 border-gray-700'
              }`}
            >
              <span className="text-3xl font-black">{player}</span>
            </div>
            <span className={`text-sm font-medium ${controllerConnected ? 'text-white' : 'text-gray-500'}`}>
              Player {player}
            </span>
          </div>
        ))}
      </div>

      {/* Round types preview */}
      <div className="relative z-10 mt-16 max-w-4xl">
        <h3 className="text-center text-gray-400 mb-6 text-lg">8 Exciting Round Types</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {Object.entries(ROUND_ICONS).map(([type, icon]) => (
            <div
              key={type}
              className="px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50 flex items-center gap-2"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-sm capitalize text-gray-300">
                {type.replace(/-/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Setup instructions */}
      <div className="relative z-10 mt-12 text-center text-gray-500 text-sm max-w-lg p-6 bg-gray-800/30 rounded-xl border border-gray-700/30">
        <p className="mb-3 font-medium text-gray-400">PS2 Buzz Controller Setup:</p>
        <ol className="text-left space-y-2 list-decimal list-inside">
          <li>Connect your USB Buzz controllers</li>
          <li>Open Device Manager</li>
          <li>Find the Buzz controller under "Human Interface Devices"</li>
          <li>Update driver to "USB Input Device"</li>
          <li>Controllers will appear as "Logitech Buzz(tm) Controller"</li>
        </ol>
      </div>
    </div>
  );
}

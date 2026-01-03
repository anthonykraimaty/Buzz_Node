import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import TeamManager from '../components/TeamManager';
import QuestionManager from '../components/QuestionManager';

type Tab = 'teams' | 'questions' | 'settings';

export default function SetupPage() {
  const navigate = useNavigate();
  const { gameState, startGame } = useGameStore();
  const [activeTab, setActiveTab] = useState<Tab>('teams');

  // Count total questions across all rounds
  const totalQuestions = gameState?.rounds?.reduce((sum, round) => sum + (round.questions?.length || 0), 0) || 0;

  const canStart = gameState && gameState.teams.length >= 1 && totalQuestions >= 1;

  const handleStart = () => {
    startGame();
    navigate('/game');
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Game Setup</h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/')}
              className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg"
            >
              Back
            </button>
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`px-8 py-2 rounded-lg font-bold ${
                canStart
                  ? 'bg-buzz-green hover:bg-green-600'
                  : 'bg-gray-600 cursor-not-allowed opacity-50'
              }`}
            >
              Start Game
            </button>
          </div>
        </div>

        {/* Status Summary */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6 flex gap-8">
          <div>
            <span className="text-gray-400">Teams:</span>{' '}
            <span className={gameState?.teams.length ? 'text-green-400' : 'text-red-400'}>
              {gameState?.teams.length || 0}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Questions:</span>{' '}
            <span className={totalQuestions ? 'text-green-400' : 'text-red-400'}>
              {totalQuestions}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Rounds:</span>{' '}
            <span className="text-blue-400">
              {gameState?.rounds?.length || 0}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Game ID:</span>{' '}
            <span className="text-blue-400 font-mono">{gameState?.id?.slice(0, 8) || 'N/A'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['teams', 'questions', 'settings'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-buzz-blue text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800/30 rounded-2xl p-6">
          {activeTab === 'teams' && <TeamManager />}
          {activeTab === 'questions' && <QuestionManager />}
          {activeTab === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const { gameState } = useGameStore();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4">Game Settings</h2>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900/50 rounded-xl p-4">
          <label className="block text-gray-400 mb-2">Default Time Limit (seconds)</label>
          <input
            type="number"
            defaultValue={gameState?.settings?.defaultTimeLimit || 30}
            className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
          />
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4">
          <label className="block text-gray-400 mb-2">Max Players</label>
          <input
            type="number"
            defaultValue={gameState?.settings?.maxPlayers || 4}
            className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
          />
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={gameState?.settings?.playBuzzerSounds ?? true}
              className="w-5 h-5 rounded"
            />
            <span>Play Buzzer Sounds</span>
          </label>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={gameState?.settings?.playSoundEffects ?? true}
              className="w-5 h-5 rounded"
            />
            <span>Play Sound Effects</span>
          </label>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={gameState?.settings?.showLeaderboardBetweenRounds ?? true}
              className="w-5 h-5 rounded"
            />
            <span>Show Leaderboard Between Rounds</span>
          </label>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={gameState?.settings?.allowLateBuzz ?? false}
              className="w-5 h-5 rounded"
            />
            <span>Allow Late Buzz</span>
          </label>
        </div>
      </div>
    </div>
  );
}

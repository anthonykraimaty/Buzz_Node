import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import TeamManager from '../components/TeamManager';
import QuestionManager from '../components/QuestionManager';
import { RoundConfig, Round } from '../types';

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
  const { gameState, updateRoundConfig } = useGameStore();
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  const handleRoundConfigChange = (roundId: string, field: keyof RoundConfig, value: number | string) => {
    updateRoundConfig(roundId, { [field]: value });
  };

  const getRoundIcon = (type: string) => {
    const icons: Record<string, string> = {
      'fastest-finger': '⚡',
      'multiple-choice': '🎯',
      'true-false': '⚖️',
      'picture-sound': '🖼️',
      'steal-points': '💰',
      'hot-potato': '🥔',
      'ladder': '📈',
      'final': '🏆',
    };
    return icons[type] || '❓';
  };

  return (
    <div className="space-y-6">
      {/* Round Configuration */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Round Settings</h2>
        <p className="text-gray-400 mb-4">Configure time limits, points, and other settings for each round type.</p>

        <div className="space-y-3">
          {gameState?.rounds?.map((round: Round) => (
            <div key={round.id} className="bg-gray-900/50 rounded-xl overflow-hidden">
              {/* Round Header */}
              <button
                onClick={() => setExpandedRound(expandedRound === round.id ? null : round.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getRoundIcon(round.config.type)}</span>
                  <div className="text-left">
                    <div className="font-semibold">{round.config.name}</div>
                    <div className="text-sm text-gray-400">
                      {round.questions.length} questions • {round.config.timePerQuestion}s per question
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-400">
                    <span className="text-green-400">+{round.config.pointsCorrect}</span>
                    {round.config.pointsWrong !== 0 && (
                      <span className="text-red-400 ml-2">{round.config.pointsWrong}</span>
                    )}
                  </div>
                  <span className={`transition-transform ${expandedRound === round.id ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </button>

              {/* Expanded Config Panel */}
              {expandedRound === round.id && (
                <div className="border-t border-gray-700 p-4 bg-gray-800/30">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Time Per Question */}
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Time (seconds)</label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={round.config.timePerQuestion}
                        onChange={(e) => handleRoundConfigChange(round.id, 'timePerQuestion', parseInt(e.target.value) || 1)}
                        className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    {/* Points Correct */}
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Points (Correct)</label>
                      <input
                        type="number"
                        value={round.config.pointsCorrect}
                        onChange={(e) => handleRoundConfigChange(round.id, 'pointsCorrect', parseInt(e.target.value) || 0)}
                        className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    {/* Points Wrong */}
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Points (Wrong)</label>
                      <input
                        type="number"
                        value={round.config.pointsWrong}
                        onChange={(e) => handleRoundConfigChange(round.id, 'pointsWrong', parseInt(e.target.value) || 0)}
                        className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    {/* Question Count (info only) */}
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Questions</label>
                      <div className="bg-gray-700/50 rounded-lg px-3 py-2 text-gray-300">
                        {round.questions.length}
                      </div>
                    </div>

                    {/* Speed Bonus Points (for multiple-choice) */}
                    {round.config.type === 'multiple-choice' && (
                      <>
                        <div>
                          <label className="block text-gray-400 text-sm mb-1">Fast Bonus (0-2s)</label>
                          <input
                            type="number"
                            value={round.config.pointsFast || 0}
                            onChange={(e) => handleRoundConfigChange(round.id, 'pointsFast' as keyof RoundConfig, parseInt(e.target.value) || 0)}
                            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-1">Medium Bonus (2-4s)</label>
                          <input
                            type="number"
                            value={round.config.pointsSlow || 0}
                            onChange={(e) => handleRoundConfigChange(round.id, 'pointsSlow' as keyof RoundConfig, parseInt(e.target.value) || 0)}
                            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
                          />
                        </div>
                      </>
                    )}

                    {/* Ladder Values (for ladder round) */}
                    {round.config.type === 'ladder' && round.config.ladderValues && (
                      <div className="col-span-2 md:col-span-4">
                        <label className="block text-gray-400 text-sm mb-1">Ladder Values (comma-separated)</label>
                        <input
                          type="text"
                          value={round.config.ladderValues.join(', ')}
                          onChange={(e) => {
                            const values = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                            if (values.length > 0) {
                              handleRoundConfigChange(round.id, 'ladderValues' as keyof RoundConfig, values as unknown as number);
                            }
                          }}
                          className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white font-mono"
                        />
                      </div>
                    )}
                  </div>

                  {/* Round Description */}
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="text-sm text-gray-500">{round.config.description}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* General Settings */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">General Settings</h2>

        <div className="grid grid-cols-2 gap-4">
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
    </div>
  );
}

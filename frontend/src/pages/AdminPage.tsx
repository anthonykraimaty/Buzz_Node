import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { Question, Choice, RoundType, RoundConfig, ROUND_ICONS, DEFAULT_ROUNDS, Difficulty } from '../types';

// Fisher-Yates shuffle for randomizing answer colors
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// Parse CSV for a specific round type
function parseCSVForRound(csvText: string, isTrueFalse: boolean): Omit<Question, 'id'>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  const questions: Omit<Question, 'id'>[] = [];

  // Skip header row if it looks like one
  const startIndex = lines[0]?.toLowerCase().includes('question') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const columns = parseCSVLine(lines[i]);

    // CSV format: Question, Correct Answer, Wrong1, Wrong2, Wrong3
    if (columns.length < 3) continue;

    const [questionText, correctAnswer, wrong1, wrong2, wrong3] = columns;

    if (!questionText?.trim() || !correctAnswer?.trim()) continue;

    // Build answers array
    const answers: { text: string; isCorrect: boolean }[] = [
      { text: correctAnswer.trim(), isCorrect: true }
    ];

    if (isTrueFalse) {
      if (wrong1?.trim()) {
        answers.push({ text: wrong1.trim(), isCorrect: false });
      }
    } else {
      if (wrong1?.trim()) answers.push({ text: wrong1.trim(), isCorrect: false });
      if (wrong2?.trim()) answers.push({ text: wrong2.trim(), isCorrect: false });
      if (wrong3?.trim()) answers.push({ text: wrong3.trim(), isCorrect: false });
    }

    // Shuffle answers to randomize color assignment
    const shuffledAnswers = shuffleArray(answers);

    // Assign colors to shuffled answers
    const choices: Choice[] = shuffledAnswers.map((answer, index) => ({
      id: String.fromCharCode(97 + index),
      text: answer.text,
      color: CHOICE_COLORS[index],
      isCorrect: answer.isCorrect,
    }));

    questions.push({
      text: questionText.trim(),
      choices,
    });
  }

  return questions;
}

// Map CSV round type names to RoundType
// Valid names for CSV import:
// - fastest-finger, fastestfinger, fastest finger, ff, speed
// - multiple-choice, multiplechoice, multiple choice, mc, quiz
// - true-false, truefalse, true false, true/false, tf, boolean
// - picture-sound, picturesound, picture sound, ps, media, picture, sound
// - steal-points, stealpoints, steal points, point heist, steal, heist
// - hot-potato, hotpotato, hot potato, hp, potato, bomb
// - ladder, the ladder, climb
// - final, final showdown, showdown, finale
const ROUND_TYPE_MAP: Record<string, RoundType> = {
  // Fastest Finger
  'fastest-finger': 'fastest-finger',
  'fastestfinger': 'fastest-finger',
  'fastest finger': 'fastest-finger',
  'ff': 'fastest-finger',
  'speed': 'fastest-finger',
  // Multiple Choice
  'multiple-choice': 'multiple-choice',
  'multiplechoice': 'multiple-choice',
  'multiple choice': 'multiple-choice',
  'mc': 'multiple-choice',
  'quiz': 'multiple-choice',
  // True/False
  'true-false': 'true-false',
  'truefalse': 'true-false',
  'true false': 'true-false',
  'true/false': 'true-false',
  'tf': 'true-false',
  'boolean': 'true-false',
  // Picture/Sound
  'picture-sound': 'picture-sound',
  'picturesound': 'picture-sound',
  'picture sound': 'picture-sound',
  'ps': 'picture-sound',
  'media': 'picture-sound',
  'picture': 'picture-sound',
  'sound': 'picture-sound',
  // Steal Points (Point Heist)
  'steal-points': 'steal-points',
  'stealpoints': 'steal-points',
  'steal points': 'steal-points',
  'point heist': 'steal-points',
  'steal': 'steal-points',
  'heist': 'steal-points',
  // Hot Potato
  'hot-potato': 'hot-potato',
  'hotpotato': 'hot-potato',
  'hot potato': 'hot-potato',
  'hp': 'hot-potato',
  'potato': 'hot-potato',
  'bomb': 'hot-potato',
  // Ladder
  'ladder': 'ladder',
  'the ladder': 'ladder',
  'climb': 'ladder',
  // Final
  'final': 'final',
  'final showdown': 'final',
  'showdown': 'final',
  'finale': 'final',
};

// Round types that can be randomly assigned
// Excludes: picture-sound (requires media file), true-false (requires specific TRUE/FALSE format), final (special round)
const RANDOM_ASSIGNABLE_TYPES: RoundType[] = [
  'fastest-finger', 'multiple-choice',
  'steal-points', 'hot-potato', 'ladder'
];

// Parse CSV and group questions by round type
// CSV Format: Game Mode, Question, Correct Answer, Wrong1, Wrong2, Wrong3, [Media Filename]
// - If Game Mode is empty, assigns randomly to an available round (excludes picture-sound, true-false, final)
// - For true-false, answers are capitalized to TRUE/FALSE
// - For picture-sound, column 7 can have media filename (looked up in /media/ folder)
function parseGlobalCSV(csvText: string, availableRoundTypes?: RoundType[]): { roundType: RoundType; question: Omit<Question, 'id'> }[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  const questions: { roundType: RoundType; question: Omit<Question, 'id'> }[] = [];

  // Filter available rounds for random assignment - exclude picture-sound, true-false, and final
  const roundsForRandom = availableRoundTypes && availableRoundTypes.length > 0
    ? availableRoundTypes.filter(t => t !== 'picture-sound' && t !== 'true-false' && t !== 'final')
    : RANDOM_ASSIGNABLE_TYPES;

  // Build weighted selection array - hot-potato gets 2x weight (questions cycle faster)
  const weightedRounds: RoundType[] = [];
  for (const roundType of roundsForRandom) {
    if (roundType === 'hot-potato') {
      // Add hot-potato twice for 2x weight
      weightedRounds.push(roundType, roundType);
    } else {
      weightedRounds.push(roundType);
    }
  }

  // Skip header row if it looks like one
  const startIndex = lines[0]?.toLowerCase().includes('game mode') ||
                     lines[0]?.toLowerCase().includes('round') ||
                     lines[0]?.toLowerCase().includes('question') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const columns = parseCSVLine(lines[i]);

    // CSV format: Game Mode, Question, Correct Answer, Wrong1, Wrong2, Wrong3, [Media]
    if (columns.length < 4) continue;

    const [roundTypeStr, questionText, correctAnswer, wrong1, wrong2, wrong3, mediaFilename] = columns;

    if (!questionText?.trim() || !correctAnswer?.trim()) continue;

    // Parse round type - if empty or not found, assign randomly (weighted)
    const normalizedType = roundTypeStr?.toLowerCase().trim();
    let roundType: RoundType;

    if (!normalizedType || !ROUND_TYPE_MAP[normalizedType]) {
      // Weighted random assignment - hot-potato has 2x chance
      roundType = weightedRounds[Math.floor(Math.random() * weightedRounds.length)];
    } else {
      roundType = ROUND_TYPE_MAP[normalizedType];
    }

    const isTrueFalse = roundType === 'true-false';
    const isPictureSound = roundType === 'picture-sound';

    // Build answers array with proper formatting
    const formatAnswer = (text: string): string => {
      if (isTrueFalse) {
        // Capitalize TRUE/FALSE for true-false questions
        const lower = text.toLowerCase().trim();
        if (lower === 'true' || lower === 't' || lower === 'yes' || lower === '1') {
          return 'TRUE';
        } else if (lower === 'false' || lower === 'f' || lower === 'no' || lower === '0') {
          return 'FALSE';
        }
      }
      return text.trim();
    };

    const answers: { text: string; isCorrect: boolean }[] = [
      { text: formatAnswer(correctAnswer), isCorrect: true }
    ];

    if (isTrueFalse) {
      // True/False only needs 2 options
      if (wrong1?.trim()) {
        answers.push({ text: formatAnswer(wrong1), isCorrect: false });
      } else {
        // Auto-add opposite answer if not provided
        const correctLower = correctAnswer.toLowerCase().trim();
        if (correctLower === 'true' || correctLower === 't') {
          answers.push({ text: 'FALSE', isCorrect: false });
        } else {
          answers.push({ text: 'TRUE', isCorrect: false });
        }
      }
    } else {
      if (wrong1?.trim()) answers.push({ text: wrong1.trim(), isCorrect: false });
      if (wrong2?.trim()) answers.push({ text: wrong2.trim(), isCorrect: false });
      if (wrong3?.trim()) answers.push({ text: wrong3.trim(), isCorrect: false });
    }

    // Shuffle answers to randomize color assignment
    const shuffledAnswers = shuffleArray(answers);

    // Assign colors to shuffled answers
    const choices: Choice[] = shuffledAnswers.map((answer, index) => ({
      id: String.fromCharCode(97 + index),
      text: answer.text,
      color: CHOICE_COLORS[index],
      isCorrect: answer.isCorrect,
    }));

    // Build question object
    const question: Omit<Question, 'id'> = {
      text: questionText.trim(),
      choices,
    };

    // Handle media for picture-sound questions
    if (isPictureSound && mediaFilename?.trim()) {
      const filename = mediaFilename.trim();
      // Set media URL - assumes files are in /media/ folder on backend
      question.mediaUrl = `/media/${filename}`;
      // Detect media type from extension
      const ext = filename.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
        question.mediaType = 'image';
      } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext || '')) {
        question.mediaType = 'audio';
      } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) {
        question.mediaType = 'video';
      }
    }

    questions.push({ roundType, question });
  }

  return questions;
}

type AdminView = 'game-flow' | 'questions';

const CHOICE_COLORS: Choice['color'][] = ['blue', 'orange', 'green', 'yellow'];

interface RoundTypeConfig {
  type: RoundType;
  name: string;
  description: string;
  questionHint: string;
  supportsMedia: boolean;
  isTrueFalse: boolean;
}

const ROUND_CONFIGS: RoundTypeConfig[] = [
  {
    type: 'fastest-finger',
    name: 'Fastest Finger',
    description: 'Race to buzz first! Wrong answers penalized.',
    questionHint: 'Ask questions that require quick recall',
    supportsMedia: false,
    isTrueFalse: false,
  },
  {
    type: 'multiple-choice',
    name: 'Multiple Choice',
    description: 'Everyone answers simultaneously. Faster = more points.',
    questionHint: 'Standard 4-option multiple choice questions',
    supportsMedia: false,
    isTrueFalse: false,
  },
  {
    type: 'true-false',
    name: 'True or False',
    description: 'Quick decisions with risk! Wrong answers hurt.',
    questionHint: 'Statement-based questions with True/False answers',
    supportsMedia: false,
    isTrueFalse: true,
  },
  {
    type: 'picture-sound',
    name: 'Picture / Sound',
    description: 'Identify images, sounds, or clips.',
    questionHint: 'Add media URL for image, audio, or video identification',
    supportsMedia: true,
    isTrueFalse: false,
  },
  {
    type: 'steal-points',
    name: 'Point Heist',
    description: 'Steal points from rivals on correct answer.',
    questionHint: 'Questions where stealing adds drama!',
    supportsMedia: false,
    isTrueFalse: false,
  },
  {
    type: 'hot-potato',
    name: 'Hot Potato',
    description: "Pass the bomb - don't hold it when it explodes!",
    questionHint: 'Quick-fire questions for rapid passing',
    supportsMedia: false,
    isTrueFalse: false,
  },
  {
    type: 'ladder',
    name: 'The Ladder',
    description: 'Climb for big points, but bank before you fall!',
    questionHint: 'Progressively harder questions for ladder climbing',
    supportsMedia: false,
    isTrueFalse: false,
  },
  {
    type: 'final',
    name: 'Final Showdown',
    description: 'All or nothing! High stakes finale.',
    questionHint: 'Challenging final round questions',
    supportsMedia: false,
    isTrueFalse: false,
  },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const { gameState, savedGames, createGame, loadGame, clearGame, deleteGame, updateGameName, setRounds, updateRoundConfig, addQuestion, removeQuestion, importQuestions, connected } = useGameStore();
  const [adminView, setAdminView] = useState<AdminView>('game-flow');
  const [selectedRound, setSelectedRound] = useState<RoundType | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showGlobalImportModal, setShowGlobalImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGame, setEditingGame] = useState<{ gameId: string; name: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingRoundSettings, setEditingRoundSettings] = useState<string | null>(null); // roundId

  // Game flow state - which rounds are enabled and their order
  const [enabledRounds, setEnabledRounds] = useState<RoundType[]>([]);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Initialize enabled rounds from game state
  useEffect(() => {
    if (gameState?.rounds) {
      const activeRounds = gameState.rounds
        .filter(r => r.config)
        .map(r => r.config.type);
      setEnabledRounds(activeRounds);
      // Select first enabled round if none selected
      if (!selectedRound && activeRounds.length > 0) {
        setSelectedRound(activeRounds[0]);
      }
    }
  }, [gameState?.rounds]);

  const currentRoundConfig = ROUND_CONFIGS.find(r => r.type === selectedRound)!;
  const roundQuestions = gameState?.rounds
    ?.find(r => r.config.type === selectedRound)?.questions || [];

  const getQuestionCountByRound = (roundType: RoundType) => {
    return gameState?.rounds?.find(r => r.config.type === roundType)?.questions?.length || 0;
  };

  const totalQuestions = gameState?.rounds?.reduce((sum, r) => sum + (r.questions?.length || 0), 0) || 0;

  // Show game selection screen if no game loaded
  if (!gameState) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Question Admin</h1>
              <p className="text-gray-400">Create and manage questions for your quiz game</p>
            </div>
            <button onClick={() => navigate('/')} className="btn-secondary">
              Back to Home
            </button>
          </div>

          <div className="card mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-400">
                {connected ? 'Connected to server' : 'Not connected to server'}
              </span>
            </div>
          </div>

          {/* Existing Games List */}
          {savedGames.length > 0 && (
            <div className="card mb-6">
              <h2 className="text-xl font-bold mb-4">Existing Games</h2>
              <p className="text-gray-400 mb-4">Select a game to edit its questions, or manage the game</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedGames.map((game) => (
                  <div
                    key={game.gameId}
                    className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-buzz-blue transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      {editingGame?.gameId === game.gameId ? (
                        <input
                          type="text"
                          value={editingGame.name}
                          onChange={(e) => setEditingGame({ ...editingGame, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateGameName(game.gameId, editingGame.name);
                              setEditingGame(null);
                            } else if (e.key === 'Escape') {
                              setEditingGame(null);
                            }
                          }}
                          onBlur={() => {
                            updateGameName(game.gameId, editingGame.name);
                            setEditingGame(null);
                          }}
                          className="bg-gray-700 rounded px-2 py-1 text-white font-bold text-lg flex-1 mr-2"
                          autoFocus
                        />
                      ) : (
                        <h3 className="font-bold text-lg text-white">{game.name}</h3>
                      )}
                      <span className={`text-xs px-2 py-1 rounded ${
                        game.status === 'lobby' ? 'bg-blue-500/20 text-blue-400' :
                        game.status === 'playing' ? 'bg-green-500/20 text-green-400' :
                        game.status === 'finished' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {game.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 flex gap-4 mb-3">
                      <span>{game.questionCount} questions</span>
                      <span>{game.teamCount} teams</span>
                    </div>
                    {game.updatedAt && (
                      <div className="text-xs text-gray-500 mb-3">
                        Last modified: {new Date(game.updatedAt).toLocaleDateString()}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadGame(game.gameId)}
                        className="flex-1 bg-buzz-blue hover:bg-buzz-blue/80 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                      >
                        Edit Questions
                      </button>
                      <button
                        onClick={() => setEditingGame({ gameId: game.gameId, name: game.name })}
                        className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg text-sm transition-colors"
                        title="Rename game"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(game.gameId)}
                        className="bg-red-500/20 hover:bg-red-500/40 text-red-400 py-2 px-3 rounded-lg text-sm transition-colors"
                        title="Delete game"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
              <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-2 text-red-400">Delete Game?</h2>
                <p className="text-gray-400 mb-6">
                  Are you sure you want to delete "{savedGames.find(g => g.gameId === showDeleteConfirm)?.name}"?
                  This will permanently remove all questions and cannot be undone.
                </p>
                <div className="flex justify-end gap-4">
                  <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      deleteGame(showDeleteConfirm);
                      setShowDeleteConfirm(null);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium"
                  >
                    Delete Game
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create New Game */}
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">🎮</div>
            <h2 className="text-2xl font-bold mb-2">
              {savedGames.length > 0 ? 'Or Create a New Game' : 'No Games Yet'}
            </h2>
            <p className="text-gray-400 mb-6">
              Create a new game to start adding questions. Questions will be saved to the database.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!connected}
              className="btn-primary text-xl px-8 py-4 disabled:opacity-50"
            >
              Create New Game
            </button>
            {!connected && (
              <p className="text-red-400 text-sm mt-4">
                Please wait for server connection...
              </p>
            )}
          </div>

          {showCreateModal && (
            <CreateGameModal
              onClose={() => setShowCreateModal(false)}
              onCreate={(name) => {
                createGame(name);
                setShowCreateModal(false);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // Functions to manage game flow
  const toggleRound = (roundType: RoundType) => {
    if (enabledRounds.includes(roundType)) {
      // Remove round
      const newRounds = enabledRounds.filter(r => r !== roundType);
      setEnabledRounds(newRounds);
      applyRoundsToGame(newRounds);
    } else {
      // Add round at the end
      const newRounds = [...enabledRounds, roundType];
      setEnabledRounds(newRounds);
      applyRoundsToGame(newRounds);
    }
  };

  const moveRound = (index: number, direction: 'up' | 'down') => {
    const newRounds = [...enabledRounds];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newRounds.length) return;

    [newRounds[index], newRounds[newIndex]] = [newRounds[newIndex], newRounds[index]];
    setEnabledRounds(newRounds);
    applyRoundsToGame(newRounds);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newRounds = [...enabledRounds];
    const [draggedItem] = newRounds.splice(draggedIndex, 1);
    newRounds.splice(dropIndex, 0, draggedItem);

    setEnabledRounds(newRounds);
    applyRoundsToGame(newRounds);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const applyRoundsToGame = (roundTypes: RoundType[]) => {
    // Build RoundConfig array from enabled round types
    const roundConfigs: RoundConfig[] = roundTypes.map(type => {
      const defaultRound = DEFAULT_ROUNDS.find(r => r.type === type);
      return defaultRound || {
        type,
        name: ROUND_CONFIGS.find(r => r.type === type)?.name || type,
        description: '',
        questionCount: 5,
        timePerQuestion: 20,
        pointsCorrect: 100,
        pointsWrong: 0
      };
    });
    setRounds(roundConfigs);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Game Setup</h1>
            <p className="text-gray-400">Configure game flow and add questions</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-400">Current Game</div>
              <div className="font-bold text-buzz-blue">{gameState.name}</div>
            </div>
            <button onClick={() => clearGame()} className="btn-secondary">
              Switch Game
            </button>
            <button onClick={() => navigate('/')} className="btn-secondary">
              Back to Home
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setAdminView('game-flow')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              adminView === 'game-flow'
                ? 'bg-buzz-blue text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            1. Game Flow
          </button>
          <button
            onClick={() => setAdminView('questions')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              adminView === 'questions'
                ? 'bg-buzz-blue text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            2. Questions ({totalQuestions})
          </button>
        </div>

        {/* Game Flow View */}
        {adminView === 'game-flow' && (
          <div className="grid grid-cols-2 gap-8">
            {/* Available Rounds */}
            <div className="card">
              <h3 className="text-xl font-bold mb-4">Available Game Modes</h3>
              <p className="text-gray-400 text-sm mb-4">Click to add/remove rounds from your game</p>
              <div className="space-y-3">
                {ROUND_CONFIGS.map(config => {
                  const isEnabled = enabledRounds.includes(config.type);
                  const defaultRound = DEFAULT_ROUNDS.find(r => r.type === config.type);
                  return (
                    <button
                      key={config.type}
                      onClick={() => toggleRound(config.type)}
                      className={`w-full text-left px-4 py-4 rounded-lg transition-all ${
                        isEnabled
                          ? 'bg-green-500/20 border-2 border-green-500 text-white'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-3xl mt-1">{ROUND_ICONS[config.type]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">{config.name}</div>
                            {isEnabled && <span className="text-green-400 text-xl">✓</span>}
                          </div>
                          <div className="text-sm opacity-80 mt-1">{config.description}</div>
                          {defaultRound && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="text-xs bg-gray-700/50 px-2 py-1 rounded">
                                {defaultRound.questionCount} questions
                              </span>
                              <span className="text-xs bg-gray-700/50 px-2 py-1 rounded">
                                {defaultRound.timePerQuestion}s per question
                              </span>
                              {defaultRound.pointsCorrect !== 0 && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                                  +{defaultRound.pointsCorrect} correct
                                </span>
                              )}
                              {defaultRound.pointsWrong !== 0 && (
                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                                  {defaultRound.pointsWrong} wrong
                                </span>
                              )}
                              {defaultRound.pointsFast && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                                  +{defaultRound.pointsFast} fast bonus
                                </span>
                              )}
                              {defaultRound.ladderValues && (
                                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                                  Ladder: {defaultRound.ladderValues.join(' → ')}
                                </span>
                              )}
                              {defaultRound.allowSteal && (
                                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">
                                  Steal enabled
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Game Flow Order */}
            <div className="card">
              <h3 className="text-xl font-bold mb-4">Your Game Flow</h3>
              <p className="text-gray-400 text-sm mb-4">Drag or use arrows to reorder rounds</p>

              {enabledRounds.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-4">📋</div>
                  <p>No rounds selected yet</p>
                  <p className="text-sm mt-2">Click on game modes to add them</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {enabledRounds.map((roundType, index) => {
                    const config = ROUND_CONFIGS.find(r => r.type === roundType)!;
                    const questionCount = getQuestionCountByRound(roundType);
                    const isDragging = draggedIndex === index;
                    const isDragOver = dragOverIndex === index;
                    return (
                      <div
                        key={roundType}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 bg-gray-800 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all ${
                          isDragging ? 'opacity-50 scale-95' : ''
                        } ${isDragOver ? 'ring-2 ring-buzz-blue ring-offset-2 ring-offset-gray-900' : ''}`}
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => moveRound(index, 'up')}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveRound(index, 'down')}
                            disabled={index === enabledRounds.length - 1}
                            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ▼
                          </button>
                        </div>
                        <div className="text-gray-500 cursor-grab" title="Drag to reorder">
                          ⋮⋮
                        </div>
                        <span className="bg-buzz-blue text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </span>
                        <span className="text-2xl">{ROUND_ICONS[roundType]}</span>
                        <div className="flex-1">
                          <div className="font-semibold">{config.name}</div>
                          <div className="text-xs text-gray-400">
                            {questionCount} questions • {gameState?.rounds?.find(r => r.config.type === roundType)?.config.timePerQuestion || DEFAULT_ROUNDS.find(r => r.type === roundType)?.timePerQuestion}s per question
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const round = gameState?.rounds?.find(r => r.config.type === roundType);
                            if (round) setEditingRoundSettings(round.id);
                          }}
                          className="text-gray-400 hover:text-white px-2"
                          title="Round settings"
                        >
                          ⚙️
                        </button>
                        <button
                          onClick={() => toggleRound(roundType)}
                          className="text-red-400 hover:text-red-300 px-2"
                          title="Remove round"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {enabledRounds.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setAdminView('questions')}
                    className="w-full btn-primary text-lg py-3"
                  >
                    Next: Add Questions →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Questions View */}
        {adminView === 'questions' && (
          <>
            {/* Game Info Banner */}
            <div className="bg-gray-800/50 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400">Rounds:</span>{' '}
                  <span className="font-bold">{enabledRounds.length}</span>
                </div>
                <div>
                  <span className="text-gray-400">Total Questions:</span>{' '}
                  <span className={totalQuestions > 0 ? 'text-green-400 font-bold' : 'text-red-400'}>
                    {totalQuestions}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowGlobalImportModal(true)}
                  className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-semibold text-sm"
                >
                  Import CSV (All Rounds)
                </button>
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-gray-400">
                    {connected ? 'Auto-saving to MongoDB' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
              {/* Round Type Sidebar - Only show enabled rounds */}
              <div className="col-span-3">
                <div className="card">
                  <h3 className="text-lg font-bold mb-4">Game Flow</h3>
                  <div className="space-y-2">
                    {enabledRounds.map((roundType, index) => {
                      const config = ROUND_CONFIGS.find(r => r.type === roundType)!;
                      const count = getQuestionCountByRound(roundType);
                      return (
                        <button
                          key={roundType}
                          onClick={() => setSelectedRound(roundType)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                            selectedRound === roundType
                              ? 'bg-buzz-blue text-white'
                              : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                          }`}
                        >
                          <span className="bg-gray-700 text-gray-400 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="text-xl">{ROUND_ICONS[roundType]}</span>
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{config.name}</div>
                            <div className="text-xs opacity-70">{count} questions</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <button
                      onClick={() => setAdminView('game-flow')}
                      className="w-full btn-secondary text-sm"
                    >
                      ← Edit Game Flow
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="col-span-9">
                {selectedRound && currentRoundConfig ? (
                  <>
                    {/* Round Info Header */}
                    <div className="card mb-6">
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{ROUND_ICONS[selectedRound]}</div>
                        <div className="flex-1">
                          <h2 className="text-2xl font-bold">{currentRoundConfig.name}</h2>
                          <p className="text-gray-400">{currentRoundConfig.description}</p>
                          <p className="text-sm text-buzz-blue mt-2">{currentRoundConfig.questionHint}</p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowBulkModal(true)}
                            className="btn-secondary"
                          >
                            Bulk Import
                          </button>
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="btn-primary"
                          >
                            + Add Question
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Questions List */}
                    <div className="card">
                      <h3 className="text-xl font-bold mb-4">
                        Questions ({roundQuestions.length})
                      </h3>

                      {roundQuestions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <div className="text-4xl mb-4">{ROUND_ICONS[selectedRound]}</div>
                          <p className="text-lg">No questions for {currentRoundConfig.name} yet</p>
                          <p className="text-sm mt-2">Click "Add Question" to create one</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {roundQuestions.map((question, index) => (
                            <QuestionCard
                              key={question.id}
                              question={question}
                              index={index}
                              roundType={selectedRound}
                              onDelete={() => {
                                const round = gameState?.rounds.find(r => r.config.type === selectedRound);
                                if (round) {
                                  removeQuestion(round.id, question.id);
                                }
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="card text-center py-12">
                    <div className="text-4xl mb-4">👈</div>
                    <p className="text-gray-400">Select a round from the sidebar to add questions</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Question Modal */}
      {showAddModal && currentRoundConfig && (
        <QuestionModal
          roundConfig={currentRoundConfig}
          onClose={() => setShowAddModal(false)}
          onSave={(question) => {
            const round = gameState?.rounds.find(r => r.config.type === selectedRound);
            if (round) {
              addQuestion(round.id, question);
            }
            setShowAddModal(false);
          }}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && currentRoundConfig && (
        <BulkImportModal
          roundConfig={currentRoundConfig}
          onClose={() => setShowBulkModal(false)}
          onImport={(questions) => {
            const round = gameState?.rounds.find(r => r.config.type === selectedRound);
            if (round) {
              importQuestions(round.id, questions);
            }
            setShowBulkModal(false);
          }}
        />
      )}

      {/* Global CSV Import Modal */}
      {showGlobalImportModal && gameState?.rounds && (
        <GlobalCSVImportModal
          rounds={gameState.rounds.filter(r => enabledRounds.includes(r.config.type))}
          onClose={() => setShowGlobalImportModal(false)}
          onImport={(roundId, questions) => {
            importQuestions(roundId, questions);
          }}
        />
      )}

      {/* Round Settings Modal */}
      {editingRoundSettings && gameState?.rounds && (() => {
        const round = gameState.rounds.find(r => r.id === editingRoundSettings);
        if (!round) return null;
        return (
          <RoundSettingsModal
            round={round}
            onClose={() => setEditingRoundSettings(null)}
            onSave={(config) => updateRoundConfig(editingRoundSettings, config)}
          />
        );
      })()}
    </div>
  );
}

// Helper to get full media URL
const getMediaUrl = (url: string) => {
  if (url.startsWith('/')) {
    return `http://localhost:3005${url}`;
  }
  return url;
};

// Media Preview Component with loading/error states
function MediaPreview({ mediaUrl, mediaType }: { mediaUrl: string; mediaType: 'image' | 'audio' | 'video' }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const fullUrl = getMediaUrl(mediaUrl);

  // Reset status when URL changes
  useEffect(() => {
    setStatus('loading');
  }, [mediaUrl]);

  return (
    <div className="mt-4 p-3 bg-gray-800 rounded-lg">
      <p className="text-gray-400 text-sm mb-2">Preview:</p>

      {status === 'loading' && (
        <div className="text-gray-500 text-sm animate-pulse">Loading...</div>
      )}

      {status === 'error' && (
        <div className="text-red-400 text-sm">
          Failed to load media. Check the URL or file path.
          <br />
          <span className="text-gray-500 text-xs">Trying: {fullUrl}</span>
        </div>
      )}

      {mediaType === 'image' && (
        <img
          src={fullUrl}
          alt="Preview"
          className={`max-h-32 rounded ${status !== 'loaded' ? 'hidden' : ''}`}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
      {mediaType === 'audio' && (
        <audio
          src={fullUrl}
          controls
          className={`w-full ${status === 'error' ? 'hidden' : ''}`}
          onCanPlay={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
      {mediaType === 'video' && (
        <video
          src={fullUrl}
          controls
          className={`max-h-32 rounded ${status === 'error' ? 'hidden' : ''}`}
          onCanPlay={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
    </div>
  );
}

// Game Preview Modal - simulates how media appears during gameplay
function GamePreviewModal({
  question,
  onClose,
}: {
  question: Question;
  onClose: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 0.5x speed
  const totalTime = 15;

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          setIsPlaying(false);
          return 0;
        }
        return prev - (0.1 * speed);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  const blurAmount = Math.max(0, (timeLeft / totalTime) * 20);
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  const reset = () => {
    setTimeLeft(15);
    setIsPlaying(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-4xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">🎮</span> Game Preview
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        {/* Timer Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Time: {timeLeft.toFixed(1)}s</span>
            <span>Blur: {blurAmount.toFixed(1)}px</span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Media Preview */}
        <div className="bg-gray-900 rounded-xl p-8 mb-6 flex items-center justify-center min-h-[300px]">
          {question.mediaType === 'image' && (
            <div className="relative">
              <img
                src={getMediaUrl(question.mediaUrl!)}
                alt="Preview"
                className="max-w-full max-h-64 rounded-xl shadow-2xl transition-all duration-100"
                style={{
                  filter: `blur(${blurAmount}px)`,
                  transform: blurAmount > 0 ? 'scale(1.1)' : 'scale(1)'
                }}
              />
              {blurAmount > 5 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-white/50 text-2xl font-bold animate-pulse">
                    Image clearing...
                  </div>
                </div>
              )}
            </div>
          )}
          {question.mediaType === 'audio' && (
            <div className="text-center">
              <div className="text-6xl mb-4">🔊</div>
              <audio
                src={getMediaUrl(question.mediaUrl!)}
                controls
                autoPlay={isPlaying}
                className="w-full max-w-md"
              />
              <p className="text-gray-400 mt-4">Audio plays during the question timer</p>
            </div>
          )}
          {question.mediaType === 'video' && (
            <video
              src={getMediaUrl(question.mediaUrl!)}
              controls
              autoPlay={isPlaying}
              className="max-w-full max-h-64 rounded-xl shadow-2xl"
            />
          )}
          {!question.mediaUrl && (
            <div className="text-gray-500 text-xl">No media attached to this question</div>
          )}
        </div>

        {/* Question Text */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <p className="text-xl text-center">{question.text}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-6 py-3 rounded-xl font-bold text-lg flex items-center gap-2 ${
              isPlaying
                ? 'bg-yellow-500 hover:bg-yellow-600'
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>
          <button
            onClick={reset}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-xl font-bold text-lg flex items-center gap-2"
          >
            🔄 Reset
          </button>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-gray-400">Speed:</span>
            {[0.5, 1, 2].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-2 rounded-lg font-medium ${
                  speed === s
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm mt-4">
          {question.mediaType === 'image'
            ? 'This simulates how the image deblurs over 15 seconds during gameplay'
            : question.mediaType === 'audio'
            ? 'Audio will play while players try to identify the sound'
            : 'Video will play while players answer'}
        </p>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  roundType,
  onDelete,
}: {
  question: Question;
  index: number;
  roundType: RoundType;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const getColorBg = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-500';
      case 'orange': return 'bg-orange-500';
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-400 text-gray-900';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-start gap-4">
        <span className="bg-gray-700 text-gray-400 px-3 py-1 rounded-lg font-mono text-sm">
          #{index + 1}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {question.category && (
              <span className="bg-buzz-blue/30 text-buzz-blue px-2 py-0.5 rounded text-xs">
                {question.category}
              </span>
            )}
            {question.difficulty && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                question.difficulty === 'easy' ? 'bg-green-500/30 text-green-400' :
                question.difficulty === 'medium' ? 'bg-yellow-500/30 text-yellow-400' :
                'bg-red-500/30 text-red-400'
              }`}>
                {question.difficulty}
              </span>
            )}
            {question.mediaUrl && (
              <span className="bg-purple-500/30 text-purple-400 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                {question.mediaType === 'image' ? '🖼️' : question.mediaType === 'audio' ? '🔊' : '🎬'}
                {question.mediaType}
              </span>
            )}
          </div>
          <p
            className="text-lg cursor-pointer hover:text-gray-300"
            onClick={() => setExpanded(!expanded)}
          >
            {question.text}
          </p>

          {expanded && (
            <div className="mt-4 space-y-4">
              {/* Media Preview */}
              {question.mediaUrl && (
                <div className="bg-gray-900/50 rounded-lg p-3">
                  {question.mediaType === 'image' && (
                    <img
                      src={getMediaUrl(question.mediaUrl)}
                      alt="Question media"
                      className="max-h-24 rounded"
                    />
                  )}
                  {question.mediaType === 'audio' && (
                    <audio
                      src={getMediaUrl(question.mediaUrl)}
                      controls
                      className="w-full h-8"
                    />
                  )}
                  {question.mediaType === 'video' && (
                    <video
                      src={getMediaUrl(question.mediaUrl)}
                      controls
                      className="max-h-24 rounded"
                    />
                  )}
                  <p className="text-gray-500 text-xs mt-1 truncate">{question.mediaUrl}</p>
                </div>
              )}

              {/* Answer Choices */}
              <div className="grid grid-cols-2 gap-2">
                {question.choices.map(choice => (
                  <div
                    key={choice.id}
                    className={`rounded-lg px-4 py-2 flex items-center gap-2 ${
                      choice.isCorrect
                        ? 'ring-2 ring-green-500 bg-green-500/20'
                        : 'bg-gray-700/50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${getColorBg(choice.color)}`} />
                    <span className={choice.isCorrect ? 'text-green-400' : ''}>
                      {choice.text}
                    </span>
                    {choice.isCorrect && <span className="text-green-400 ml-auto">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {question.mediaUrl && roundType === 'picture-sound' && (
            <button
              onClick={() => setShowPreview(true)}
              className="text-purple-400 hover:text-purple-300 px-2 py-1 text-sm flex items-center gap-1"
            >
              🎮 Preview
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-gray-500 hover:text-red-500 px-2 py-1"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Game Preview Modal */}
      {showPreview && (
        <GamePreviewModal
          question={question}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

function QuestionModal({
  roundConfig,
  onClose,
  onSave,
}: {
  roundConfig: RoundTypeConfig;
  onClose: () => void;
  onSave: (q: Omit<Question, 'id'>) => void;
}) {
  const [text, setText] = useState('');
  const [choices, setChoices] = useState<Choice[]>(
    roundConfig.isTrueFalse
      ? [
          { id: 'true', text: 'True', color: 'green', isCorrect: true },
          { id: 'false', text: 'False', color: 'orange', isCorrect: false },
        ]
      : CHOICE_COLORS.map((color, i) => ({
          id: String.fromCharCode(97 + i),
          text: '',
          color,
          isCorrect: i === 0,
        }))
  );
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'audio' | 'video'>('image');

  const setCorrectAnswer = (id: string) => {
    setChoices(choices.map(c => ({ ...c, isCorrect: c.id === id })));
  };

  const updateChoiceText = (id: string, newText: string) => {
    setChoices(choices.map(c => c.id === id ? { ...c, text: newText } : c));
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    if (!roundConfig.isTrueFalse && choices.some(c => !c.text.trim())) return;

    onSave({
      text: text.trim(),
      choices,
      mediaUrl: roundConfig.supportsMedia && mediaUrl.trim() ? mediaUrl.trim() : undefined,
      mediaType: roundConfig.supportsMedia && mediaUrl.trim() ? mediaType : undefined,
      roundType: roundConfig.type,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">{ROUND_ICONS[roundConfig.type]}</span>
          <div>
            <h2 className="text-2xl font-bold">Add {roundConfig.name} Question</h2>
            <p className="text-gray-400 text-sm">{roundConfig.questionHint}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Question Text */}
          <div>
            <label className="block text-gray-400 mb-2">
              {roundConfig.isTrueFalse ? 'Statement' : 'Question'}
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={
                roundConfig.isTrueFalse
                  ? 'Enter a true or false statement...'
                  : 'Enter your question...'
              }
              rows={3}
              className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white resize-none"
              autoFocus
            />
          </div>

          {/* Media Selection (for picture-sound round) */}
          {roundConfig.supportsMedia && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <label className="block text-purple-300 font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">🖼️</span> Media Content
              </label>

              {/* Media Type Buttons */}
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setMediaType('image')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    mediaType === 'image'
                      ? 'bg-purple-500 text-white ring-2 ring-purple-300'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span className="text-xl">🖼️</span> Image
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('audio')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    mediaType === 'audio'
                      ? 'bg-purple-500 text-white ring-2 ring-purple-300'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span className="text-xl">🔊</span> Audio
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('video')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    mediaType === 'video'
                      ? 'bg-purple-500 text-white ring-2 ring-purple-300'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span className="text-xl">🎬</span> Video
                </button>
              </div>

              {/* Media URL Input */}
              <div>
                <label className="block text-gray-400 mb-2 text-sm">
                  {mediaType === 'image' ? 'Image URL' : mediaType === 'audio' ? 'Audio URL' : 'Video URL'}
                </label>
                <input
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder={
                    mediaType === 'image'
                      ? 'https://example.com/image.jpg or /media/local-image.jpg'
                      : mediaType === 'audio'
                      ? 'https://example.com/sound.mp3 or /media/local-sound.mp3'
                      : 'https://example.com/video.mp4'
                  }
                  className="w-full bg-gray-700 rounded-lg px-4 py-3"
                />
                <p className="text-gray-500 text-xs mt-2">
                  💡 For local files, place them in <code className="bg-gray-700 px-1 rounded">backend/media/</code> and use <code className="bg-gray-700 px-1 rounded">/media/filename.jpg</code>
                </p>
              </div>

              {/* Preview */}
              {mediaUrl && (
                <MediaPreview mediaUrl={mediaUrl} mediaType={mediaType} />
              )}
            </div>
          )}

          {/* Answers */}
          <div>
            <label className="block text-gray-400 mb-2">
              {roundConfig.isTrueFalse ? 'Correct Answer' : 'Answers (click to mark correct)'}
            </label>

            {roundConfig.isTrueFalse ? (
              <div className="flex gap-4">
                {choices.map(choice => (
                  <button
                    key={choice.id}
                    onClick={() => setCorrectAnswer(choice.id)}
                    className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
                      choice.isCorrect
                        ? choice.id === 'true'
                          ? 'bg-green-500 ring-2 ring-green-300'
                          : 'bg-orange-500 ring-2 ring-orange-300'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {choice.text}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {choices.map(choice => (
                  <div
                    key={choice.id}
                    onClick={() => setCorrectAnswer(choice.id)}
                    className={`flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-all ${
                      choice.isCorrect
                        ? 'ring-2 ring-green-500 bg-green-500/20'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${
                        choice.color === 'blue' ? 'bg-blue-500' :
                        choice.color === 'orange' ? 'bg-orange-500' :
                        choice.color === 'green' ? 'bg-green-500' :
                        'bg-yellow-400 text-gray-900'
                      }`}
                    >
                      {choice.color[0].toUpperCase()}
                    </div>
                    <input
                      value={choice.text}
                      onChange={e => updateChoiceText(choice.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      placeholder={`${choice.color.charAt(0).toUpperCase() + choice.color.slice(1)} answer`}
                      className="flex-1 bg-transparent border-none outline-none"
                    />
                    {choice.isCorrect && <span className="text-green-400 text-xl">✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        <div className="flex justify-end gap-4 mt-8">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || (!roundConfig.isTrueFalse && choices.some(c => !c.text.trim()))}
            className="btn-primary disabled:opacity-50"
          >
            Add Question
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkImportModal({
  roundConfig,
  onClose,
  onImport,
}: {
  roundConfig: RoundTypeConfig;
  onClose: () => void;
  onImport: (questions: Omit<Question, 'id'>[]) => void;
}) {
  const [importMode, setImportMode] = useState<'csv' | 'json'>('csv');
  const [jsonText, setJsonText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleJson = roundConfig.isTrueFalse
    ? `[
  {
    "text": "The Earth is flat.",
    "isTrue": false,
    "category": "Science",
    "difficulty": "easy"
  },
  {
    "text": "Water boils at 100°C at sea level.",
    "isTrue": true,
    "category": "Science"
  }
]`
    : `[
  {
    "text": "What is the capital of France?",
    "answers": ["London", "Paris", "Berlin", "Madrid"],
    "correct": 1,
    "category": "Geography",
    "difficulty": "easy"
  },
  {
    "text": "Which planet is closest to the Sun?",
    "answers": ["Venus", "Mercury", "Earth", "Mars"],
    "correct": 1,
    "category": "Science"
  }
]`;

  const sampleCsv = roundConfig.isTrueFalse
    ? `Question,Correct Answer,Wrong Answer
The Earth is flat.,False,True
Water boils at 100 degrees Celsius.,True,False
The Great Wall of China is visible from space.,False,True`
    : `Question,Correct Answer,Wrong Answer 1,Wrong Answer 2,Wrong Answer 3
What is the capital of France?,Paris,London,Berlin,Madrid
Which planet is closest to the Sun?,Mercury,Venus,Earth,Mars
Who painted the Mona Lisa?,Leonardo da Vinci,Pablo Picasso,Vincent van Gogh,Michelangelo`;

  const handleCSVFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      setError('');
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadSampleCSV = () => {
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sample_${roundConfig.type}_questions.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      if (importMode === 'csv') {
        const questions = parseCSVForRound(csvText, roundConfig.isTrueFalse);
        if (questions.length === 0) {
          throw new Error('No valid questions found in CSV');
        }
        onImport(questions);
      } else {
        const data = JSON.parse(jsonText);
        if (!Array.isArray(data)) {
          throw new Error('JSON must be an array of questions');
        }

        const questions: Omit<Question, 'id'>[] = data.map((item: Record<string, unknown>) => {
          if (roundConfig.isTrueFalse) {
            return {
              text: item.text as string,
              choices: [
                { id: 'true', text: 'True', color: 'green' as const, isCorrect: item.isTrue === true },
                { id: 'false', text: 'False', color: 'orange' as const, isCorrect: item.isTrue !== true },
              ],
              category: item.category as string | undefined,
              difficulty: (item.difficulty as Difficulty) || 'medium',
              roundType: roundConfig.type,
            };
          } else {
            const answers = item.answers as string[];
            const correctIndex = (item.correct as number) || 0;
            return {
              text: item.text as string,
              choices: answers.map((text: string, i: number) => ({
                id: String.fromCharCode(97 + i),
                text,
                color: CHOICE_COLORS[i],
                isCorrect: i === correctIndex,
              })),
              category: item.category as string | undefined,
              difficulty: (item.difficulty as Difficulty) || 'medium',
              mediaUrl: item.mediaUrl as string | undefined,
              mediaType: item.mediaType as 'image' | 'audio' | 'video' | undefined,
              roundType: roundConfig.type,
            };
          }
        });

        onImport(questions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid format');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-4xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2">Bulk Import Questions</h2>
        <p className="text-gray-400 mb-4">
          Import multiple {roundConfig.name} questions
        </p>

        {/* Import Mode Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setImportMode('csv'); setError(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              importMode === 'csv'
                ? 'bg-buzz-blue text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            CSV Import
          </button>
          <button
            onClick={() => { setImportMode('json'); setError(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              importMode === 'json'
                ? 'bg-buzz-blue text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            JSON Import
          </button>
        </div>

        {importMode === 'csv' ? (
          <>
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleCSVFileImport}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400">Paste CSV or upload file</label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                  >
                    Upload CSV File
                  </button>
                </div>
                <textarea
                  value={csvText}
                  onChange={e => {
                    setCsvText(e.target.value);
                    setError('');
                  }}
                  placeholder="Paste your CSV here or upload a file..."
                  rows={14}
                  className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm resize-none"
                />
                {error && (
                  <p className="text-red-400 text-sm mt-2">{error}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400">CSV Format (answers will be shuffled)</label>
                  <button
                    onClick={handleDownloadSampleCSV}
                    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                  >
                    Download Sample
                  </button>
                </div>
                <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-auto h-[350px] whitespace-pre-wrap">
                  {sampleCsv}
                </pre>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-400 mb-2">Paste JSON</label>
              <textarea
                value={jsonText}
                onChange={e => {
                  setJsonText(e.target.value);
                  setError('');
                }}
                placeholder="Paste your JSON array here..."
                rows={14}
                className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm resize-none"
              />
              {error && (
                <p className="text-red-400 text-sm mt-2">{error}</p>
              )}
            </div>

            <div>
              <label className="block text-gray-400 mb-2">Example Format</label>
              <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-auto h-[350px]">
                {sampleJson}
              </pre>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importMode === 'csv' ? !csvText.trim() : !jsonText.trim()}
            className="btn-primary disabled:opacity-50"
          >
            Import Questions
          </button>
        </div>
      </div>
    </div>
  );
}

function GlobalCSVImportModal({
  rounds,
  onClose,
  onImport,
}: {
  rounds: { id: string; config: { type: RoundType; name: string } }[];
  onClose: () => void;
  onImport: (roundId: string, questions: Omit<Question, 'id'>[]) => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ roundType: string; count: number }[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get available round types for random assignment
  const availableRoundTypes = rounds.map(r => r.config.type);

  const sampleCsv = `Game Mode,Question,Correct Answer,Wrong Answer 1,Wrong Answer 2,Wrong Answer 3,Media
ff,What is 2 + 2?,4,3,5,6,
speed,What color is the sky?,Blue,Green,Red,Yellow,
mc,What is the capital of France?,Paris,London,Berlin,Madrid,
quiz,Which planet is closest to the Sun?,Mercury,Venus,Earth,Mars,
tf,The Earth is flat.,false,,,
true-false,Water boils at 100 degrees Celsius.,true,,,
hp,What is the largest ocean?,Pacific,Atlantic,Indian,Arctic,
steal,Who wrote Romeo and Juliet?,Shakespeare,Dickens,Austen,Hemingway,
picture,What animal is this?,Dog,Cat,Bird,Fish,dog.jpg
media,Name this famous landmark,Eiffel Tower,Big Ben,Statue of Liberty,Colosseum,eiffel.png
,Random question (no mode),Answer A,Answer B,Answer C,Answer D,`;

  const handleCSVFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      setError('');
      setImportResult(null);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadSampleCSV = () => {
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_all_rounds_questions.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      // Pass available round types for random assignment when game mode is empty
      const parsedQuestions = parseGlobalCSV(csvText, availableRoundTypes);
      if (parsedQuestions.length === 0) {
        throw new Error('No valid questions found in CSV');
      }

      // Group questions by round type
      const questionsByRound = new Map<RoundType, Omit<Question, 'id'>[]>();
      for (const { roundType, question } of parsedQuestions) {
        if (!questionsByRound.has(roundType)) {
          questionsByRound.set(roundType, []);
        }
        questionsByRound.get(roundType)!.push(question);
      }

      // Import to each round
      const results: { roundType: string; count: number }[] = [];
      let totalImported = 0;

      for (const [roundType, questions] of questionsByRound) {
        const round = rounds.find(r => r.config.type === roundType);
        if (round) {
          // Import all questions for this round at once
          for (const q of questions) {
            onImport(round.id, [q]);
          }
          results.push({ roundType: round.config.name, count: questions.length });
          totalImported += questions.length;
        } else {
          results.push({ roundType: `${roundType} (no matching round)`, count: questions.length });
        }
      }

      if (totalImported === 0) {
        throw new Error('No questions imported. Make sure the game modes in your CSV match your enabled rounds.');
      }

      setImportResult(results);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid CSV format');
      setImportResult(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-4xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2">Import Questions (All Rounds)</h2>
        <p className="text-gray-400 mb-4">
          Import questions for all rounds from a single CSV file. Questions are automatically distributed based on the Game Mode column.
        </p>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv"
          onChange={handleCSVFileImport}
          className="hidden"
        />

        {importResult ? (
          <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mb-4">
            <h3 className="text-green-400 font-bold mb-2">Import Successful!</h3>
            <ul className="space-y-1">
              {importResult.map((r, i) => (
                <li key={i} className="text-gray-300">
                  {r.roundType}: <span className="text-green-400 font-bold">{r.count}</span> questions
                </li>
              ))}
            </ul>
            <button
              onClick={onClose}
              className="mt-4 btn-primary"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400">Paste CSV or upload file</label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                  >
                    Upload CSV File
                  </button>
                </div>
                <textarea
                  value={csvText}
                  onChange={e => {
                    setCsvText(e.target.value);
                    setError('');
                  }}
                  placeholder="Paste your CSV here or upload a file..."
                  rows={14}
                  className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm resize-none"
                />
                {error && (
                  <p className="text-red-400 text-sm mt-2">{error}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400">CSV Format (answers shuffled automatically)</label>
                  <button
                    onClick={handleDownloadSampleCSV}
                    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                  >
                    Download Sample
                  </button>
                </div>
                <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-auto h-[280px] whitespace-pre-wrap">
                  {sampleCsv}
                </pre>
                <div className="text-xs text-gray-500 mt-2 space-y-1">
                  <p><strong>Game Mode shortcuts:</strong></p>
                  <p>• Fastest Finger: ff, speed, fastest-finger</p>
                  <p>• Multiple Choice: mc, quiz, multiple-choice</p>
                  <p>• True/False: tf, boolean, true-false (auto-capitalizes TRUE/FALSE)</p>
                  <p>• Picture/Sound: ps, media, picture, sound (add filename in col 7)</p>
                  <p>• Steal Points: steal, heist, point heist</p>
                  <p>• Hot Potato: hp, potato, bomb, hot-potato</p>
                  <p>• Ladder: ladder, climb</p>
                  <p>• Final: final, showdown, finale</p>
                  <p>• <em>Empty = randomly assigned to enabled rounds</em></p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!csvText.trim()}
                className="btn-primary disabled:opacity-50"
              >
                Import Questions
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CreateGameModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2">Create New Game</h2>
        <p className="text-gray-400 mb-6">
          Give your quiz game a name. All questions will be saved to the database.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 mb-2">Game Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g., Friday Night Trivia"
              className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white"
              autoFocus
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-8">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="btn-primary disabled:opacity-50"
          >
            Create Game
          </button>
        </div>
      </div>
    </div>
  );
}

function RoundSettingsModal({
  round,
  onClose,
  onSave,
}: {
  round: { id: string; config: RoundConfig };
  onClose: () => void;
  onSave: (config: Partial<RoundConfig>) => void;
}) {
  const [timePerQuestion, setTimePerQuestion] = useState(round.config.timePerQuestion);
  const [pointsCorrect, setPointsCorrect] = useState(round.config.pointsCorrect);
  const [pointsWrong, setPointsWrong] = useState(round.config.pointsWrong);
  const [pointsFast, setPointsFast] = useState(round.config.pointsFast || 0);
  const [pointsSlow, setPointsSlow] = useState(round.config.pointsSlow || 0);

  const defaultConfig = DEFAULT_ROUNDS.find(r => r.type === round.config.type);

  const handleSave = () => {
    onSave({
      timePerQuestion,
      pointsCorrect,
      pointsWrong,
      ...(round.config.type === 'multiple-choice' || round.config.type === 'picture-sound' ? {
        pointsFast: pointsFast || undefined,
        pointsSlow: pointsSlow || undefined,
      } : {}),
    });
    onClose();
  };

  const resetToDefaults = () => {
    if (defaultConfig) {
      setTimePerQuestion(defaultConfig.timePerQuestion);
      setPointsCorrect(defaultConfig.pointsCorrect);
      setPointsWrong(defaultConfig.pointsWrong);
      setPointsFast(defaultConfig.pointsFast || 0);
      setPointsSlow(defaultConfig.pointsSlow || 0);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">{ROUND_ICONS[round.config.type]}</span>
            {round.config.name} Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        <div className="space-y-6">
          {/* Time per Question */}
          <div>
            <label className="block text-gray-400 mb-2">Time per Question (seconds)</label>
            <input
              type="number"
              value={timePerQuestion}
              onChange={e => setTimePerQuestion(parseInt(e.target.value) || 5)}
              min={1}
              max={120}
              className="w-full bg-gray-700 rounded-lg px-4 py-3 text-xl font-bold"
            />
            {defaultConfig && (
              <p className="text-gray-500 text-sm mt-1">Default: {defaultConfig.timePerQuestion}s</p>
            )}
          </div>

          {/* Points */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-2">Points for Correct</label>
              <input
                type="number"
                value={pointsCorrect}
                onChange={e => setPointsCorrect(parseInt(e.target.value) || 0)}
                className="w-full bg-gray-700 rounded-lg px-4 py-3 text-green-400 font-bold"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">Points for Wrong</label>
              <input
                type="number"
                value={pointsWrong}
                onChange={e => setPointsWrong(parseInt(e.target.value) || 0)}
                className="w-full bg-gray-700 rounded-lg px-4 py-3 text-red-400 font-bold"
              />
            </div>
          </div>

          {/* Fast/Slow bonus for multiple-choice and picture-sound */}
          {(round.config.type === 'multiple-choice' || round.config.type === 'picture-sound') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 mb-2">Fast Answer Bonus</label>
                <input
                  type="number"
                  value={pointsFast}
                  onChange={e => setPointsFast(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 rounded-lg px-4 py-3 text-yellow-400 font-bold"
                />
                <p className="text-gray-500 text-xs mt-1">Extra points for quick answers</p>
              </div>
              <div>
                <label className="block text-gray-400 mb-2">Slow Answer Points</label>
                <input
                  type="number"
                  value={pointsSlow}
                  onChange={e => setPointsSlow(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 rounded-lg px-4 py-3 text-orange-400 font-bold"
                />
                <p className="text-gray-500 text-xs mt-1">Points for slower correct answers</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={resetToDefaults}
            className="text-gray-400 hover:text-white px-4 py-2"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-4">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

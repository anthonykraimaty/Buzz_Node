import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { Question, Choice, RoundType, ROUND_ICONS } from '../types';

const CHOICE_COLORS: Choice['color'][] = ['blue', 'orange', 'green', 'yellow'];

// Map CSV round type names to RoundType
const ROUND_TYPE_MAP: Record<string, RoundType> = {
  'fastest-finger': 'fastest-finger',
  'fastestfinger': 'fastest-finger',
  'fastest finger': 'fastest-finger',
  'multiple-choice': 'multiple-choice',
  'multiplechoice': 'multiple-choice',
  'multiple choice': 'multiple-choice',
  'true-false': 'true-false',
  'truefalse': 'true-false',
  'true false': 'true-false',
  'true/false': 'true-false',
  'picture-sound': 'picture-sound',
  'picturesound': 'picture-sound',
  'picture sound': 'picture-sound',
  'steal-points': 'steal-points',
  'stealpoints': 'steal-points',
  'steal points': 'steal-points',
  'point heist': 'steal-points',
  'hot-potato': 'hot-potato',
  'hotpotato': 'hot-potato',
  'hot potato': 'hot-potato',
  'ladder': 'ladder',
  'final': 'final',
};

// Fisher-Yates shuffle
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
        i++; // Skip next quote
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

// Detect media type from filename extension
function getMediaType(filename: string): 'image' | 'audio' | 'video' | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '')) {
    return 'image';
  } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '')) {
    return 'audio';
  } else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '')) {
    return 'video';
  }
  return null;
}

// Parse CSV and convert to questions grouped by round type
function parseCSV(csvText: string): { roundType: RoundType; question: Omit<Question, 'id'> }[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  const questions: { roundType: RoundType; question: Omit<Question, 'id'> }[] = [];

  // Skip header row if it looks like one
  const startIndex = lines[0]?.toLowerCase().includes('game mode') ||
                     lines[0]?.toLowerCase().includes('round') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const columns = parseCSVLine(lines[i]);

    if (columns.length < 4) continue; // Need at least: mode, question/filename, correct, wrong1

    const [roundTypeStr, questionTextOrFilename, correctAnswer, wrong1, wrong2, wrong3] = columns;

    // Parse round type
    const normalizedType = roundTypeStr?.toLowerCase().trim();
    const roundType = ROUND_TYPE_MAP[normalizedType] || 'multiple-choice';

    if (!questionTextOrFilename?.trim() || !correctAnswer?.trim()) continue;

    // For picture-sound rounds, the second column can be just a filename
    // Format: picture-sound,filename.webp,Correct Answer,Wrong1,Wrong2,Wrong3
    let questionText = questionTextOrFilename.trim();
    let mediaUrl: string | undefined;
    let mediaType: 'image' | 'audio' | 'video' | undefined;

    if (roundType === 'picture-sound') {
      const detectedMediaType = getMediaType(questionTextOrFilename.trim());
      if (detectedMediaType) {
        // It's a filename - set media URL and use default question text
        mediaUrl = `/media/${questionTextOrFilename.trim()}`;
        mediaType = detectedMediaType;
        questionText = 'What is this?'; // Default question text for media
      }
    }

    // For true-false, only use correct answer and first wrong answer
    const isTrueFalse = roundType === 'true-false';

    // Build answers array
    const answers: { text: string; isCorrect: boolean }[] = [
      { text: correctAnswer.trim(), isCorrect: true }
    ];

    if (isTrueFalse) {
      // True/False only needs 2 options
      if (wrong1?.trim()) {
        answers.push({ text: wrong1.trim(), isCorrect: false });
      }
    } else {
      // Multiple choice needs up to 4 options
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
      roundType,
      question: {
        text: questionText,
        choices,
        ...(mediaUrl && { mediaUrl }),
        ...(mediaType && { mediaType }),
      }
    });
  }

  return questions;
}

// Generate CSV from all questions
function generateCSV(rounds: { config: { type: RoundType }; questions: Question[] }[]): string {
  const lines: string[] = ['Game Mode,Question,Correct Answer,Wrong Answer 1,Wrong Answer 2,Wrong Answer 3'];

  for (const round of rounds) {
    for (const question of round.questions || []) {
      const correctChoice = question.choices.find(c => c.isCorrect);
      const wrongChoices = question.choices.filter(c => !c.isCorrect);

      // Escape fields that contain commas or quotes
      const escapeField = (text: string) => {
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      };

      const row = [
        round.config.type,
        escapeField(question.text),
        escapeField(correctChoice?.text || ''),
        escapeField(wrongChoices[0]?.text || ''),
        escapeField(wrongChoices[1]?.text || ''),
        escapeField(wrongChoices[2]?.text || ''),
      ];

      lines.push(row.join(','));
    }
  }

  return lines.join('\n');
}

const SAMPLE_QUESTIONS: Omit<Question, 'id'>[] = [
  {
    text: 'What is the capital of France?',
    choices: [
      { id: 'a', text: 'London', color: 'blue', isCorrect: false },
      { id: 'b', text: 'Berlin', color: 'orange', isCorrect: false },
      { id: 'c', text: 'Paris', color: 'green', isCorrect: true },
      { id: 'd', text: 'Madrid', color: 'yellow', isCorrect: false },
    ],
    category: 'Geography',
    difficulty: 'easy',
  },
  {
    text: 'Which planet is known as the Red Planet?',
    choices: [
      { id: 'a', text: 'Venus', color: 'blue', isCorrect: false },
      { id: 'b', text: 'Mars', color: 'orange', isCorrect: true },
      { id: 'c', text: 'Jupiter', color: 'green', isCorrect: false },
      { id: 'd', text: 'Saturn', color: 'yellow', isCorrect: false },
    ],
    category: 'Science',
    difficulty: 'easy',
  },
  {
    text: 'Who painted the Mona Lisa?',
    choices: [
      { id: 'a', text: 'Vincent van Gogh', color: 'blue', isCorrect: false },
      { id: 'b', text: 'Pablo Picasso', color: 'orange', isCorrect: false },
      { id: 'c', text: 'Leonardo da Vinci', color: 'green', isCorrect: true },
      { id: 'd', text: 'Michelangelo', color: 'yellow', isCorrect: false },
    ],
    category: 'Art',
    difficulty: 'easy',
  },
];

export default function QuestionManager() {
  const navigate = useNavigate();
  const { gameState, addQuestion, removeQuestion, importQuestions } = useGameStore();
  const [selectedRoundType, setSelectedRoundType] = useState<RoundType | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<{ roundId: string; question: Question } | null>(null);
  const [importStatus, setImportStatus] = useState<{ count: number; show: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get all questions across all rounds
  const allQuestions: { roundId: string; roundType: RoundType; question: Question }[] = [];
  gameState?.rounds?.forEach(round => {
    round.questions?.forEach(question => {
      allQuestions.push({
        roundId: round.id,
        roundType: round.config.type,
        question
      });
    });
  });

  // Filter by selected round type
  const filteredQuestions = selectedRoundType === 'all'
    ? allQuestions
    : allQuestions.filter(q => q.roundType === selectedRoundType);

  // Get first round for sample import (default to multiple-choice)
  const defaultRound = gameState?.rounds?.find(r => r.config.type === 'multiple-choice') || gameState?.rounds?.[0];

  const handleImportSample = () => {
    if (defaultRound) {
      importQuestions(defaultRound.id, SAMPLE_QUESTIONS);
    }
  };

  const handleRemoveQuestion = (roundId: string, questionId: string) => {
    removeQuestion(roundId, questionId);
  };

  // Handle CSV file import
  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !gameState?.rounds) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      const parsedQuestions = parseCSV(csvText);

      // Group questions by round type and import
      let importedCount = 0;
      for (const { roundType, question } of parsedQuestions) {
        // Find matching round by type
        const round = gameState.rounds.find(r => r.config.type === roundType);
        if (round) {
          addQuestion(round.id, question);
          importedCount++;
        }
      }

      // Show status
      setImportStatus({ count: importedCount, show: true });
      setTimeout(() => setImportStatus(null), 3000);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Download all questions as CSV
  const handleDownloadCSV = () => {
    if (!gameState?.rounds) return;

    const csv = generateCSV(gameState.rounds);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${gameState.name || 'questions'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download sample CSV template
  const handleDownloadSampleCSV = () => {
    const sampleCSV = `Game Mode,Question,Correct Answer,Wrong Answer 1,Wrong Answer 2,Wrong Answer 3
multiple-choice,What is the capital of France?,Paris,London,Berlin,Madrid
multiple-choice,Which planet is closest to the Sun?,Mercury,Venus,Earth,Mars
true-false,The Earth is flat.,False,True,,
true-false,Water boils at 100 degrees Celsius.,True,False,,
fastest-finger,What is 2 + 2?,4,3,5,6
hot-potato,What color is the sky?,Blue,Green,Red,Yellow
steal-points,Who wrote Romeo and Juliet?,Shakespeare,Dickens,Austen,Hemingway`;

    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_questions.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Hidden file input for CSV import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv"
        onChange={handleCSVImport}
        className="hidden"
      />

      {/* Import status notification */}
      {importStatus?.show && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          Imported {importStatus.count} questions!
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Questions ({allQuestions.length})</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => navigate('/admin')}
            className="bg-buzz-blue hover:bg-blue-600 px-4 py-2 rounded-lg font-semibold"
          >
            Open Question Admin
          </button>
          <button
            onClick={handleDownloadSampleCSV}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            title="Download a sample CSV template"
          >
            Sample CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-semibold"
            disabled={!gameState?.rounds?.length}
            title="Import questions from CSV file"
          >
            Import CSV
          </button>
          <button
            onClick={handleDownloadCSV}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            disabled={allQuestions.length === 0}
            title="Download all questions as CSV"
          >
            Export CSV
          </button>
          <button
            onClick={handleImportSample}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            disabled={!defaultRound}
          >
            Import Sample
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-buzz-green hover:bg-green-600 px-4 py-2 rounded-lg font-semibold"
            disabled={!gameState?.rounds?.length}
          >
            + Add Question
          </button>
        </div>
      </div>

      {/* Round Type Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedRoundType('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selectedRoundType === 'all'
              ? 'bg-buzz-blue text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All Rounds
        </button>
        {gameState?.rounds?.map(round => (
          <button
            key={round.id}
            onClick={() => setSelectedRoundType(round.config.type)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              selectedRoundType === round.config.type
                ? 'bg-buzz-blue text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <span>{ROUND_ICONS[round.config.type]}</span>
            <span>{round.config.name}</span>
            <span className="opacity-60">({round.questions?.length || 0})</span>
          </button>
        ))}
      </div>

      {filteredQuestions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-xl mb-2">No questions yet</p>
          <p className="mb-4">Add questions or use the Question Admin for more options</p>
          <button
            onClick={() => navigate('/admin')}
            className="btn-primary"
          >
            Open Question Admin
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map(({ roundId, roundType, question }, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              roundType={roundType}
              index={index}
              onEdit={() => setEditingQuestion({ roundId, question })}
              onRemove={() => handleRemoveQuestion(roundId, question.id)}
            />
          ))}
        </div>
      )}

      {(showAddForm || editingQuestion) && gameState?.rounds?.length && (
        <QuestionModal
          question={editingQuestion?.question}
          rounds={gameState.rounds}
          defaultRoundId={editingQuestion?.roundId || defaultRound?.id}
          onClose={() => {
            setShowAddForm(false);
            setEditingQuestion(null);
          }}
          onSave={(roundId, q) => {
            addQuestion(roundId, q);
            setShowAddForm(false);
            setEditingQuestion(null);
          }}
        />
      )}
    </div>
  );
}

function QuestionCard({
  question,
  roundType,
  index,
  onEdit,
  onRemove,
}: {
  question: Question;
  roundType: RoundType;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-900/50 rounded-xl p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-sm font-mono">
              #{index + 1}
            </span>
            <span className="bg-gray-700/50 text-gray-400 px-2 py-1 rounded text-sm flex items-center gap-1">
              {ROUND_ICONS[roundType]}
            </span>
            {question.category && (
              <span className="bg-buzz-blue/30 text-buzz-blue px-2 py-1 rounded text-sm">
                {question.category}
              </span>
            )}
            {question.difficulty && (
              <span
                className={`px-2 py-1 rounded text-sm ${
                  question.difficulty === 'easy'
                    ? 'bg-green-500/30 text-green-400'
                    : question.difficulty === 'medium'
                    ? 'bg-yellow-500/30 text-yellow-400'
                    : 'bg-red-500/30 text-red-400'
                }`}
              >
                {question.difficulty}
              </span>
            )}
          </div>
          <p
            className="text-lg cursor-pointer hover:text-gray-300"
            onClick={() => setExpanded(!expanded)}
          >
            {question.text}
          </p>
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-white px-2 py-1"
          >
            Edit
          </button>
          <button
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500 px-2 py-1"
          >
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {question.choices.map((choice) => (
            <div
              key={choice.id}
              className={`rounded-lg px-4 py-2 flex items-center gap-2 ${
                choice.isCorrect
                  ? 'ring-2 ring-green-500 bg-green-500/20'
                  : 'bg-gray-800'
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
              <span className={choice.isCorrect ? 'text-green-400' : ''}>
                {choice.text}
              </span>
              {choice.isCorrect && (
                <span className="text-green-400 ml-auto">✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionModal({
  question,
  rounds,
  defaultRoundId,
  onClose,
  onSave,
}: {
  question?: Question;
  rounds: { id: string; config: { type: RoundType; name: string } }[];
  defaultRoundId?: string;
  onClose: () => void;
  onSave: (roundId: string, q: Omit<Question, 'id'>) => void;
}) {
  const [selectedRoundId, setSelectedRoundId] = useState(defaultRoundId || rounds[0]?.id || '');
  const [text, setText] = useState(question?.text || '');
  const [choices, setChoices] = useState<Choice[]>(
    question?.choices || CHOICE_COLORS.map((color, i) => ({
      id: String.fromCharCode(97 + i),
      text: '',
      color,
      isCorrect: i === 0,
    }))
  );

  const setCorrectAnswer = (id: string) => {
    setChoices(choices.map(c => ({ ...c, isCorrect: c.id === id })));
  };

  const handleSubmit = () => {
    if (!text.trim() || choices.some((c) => !c.text.trim())) return;
    onSave(selectedRoundId, {
      text: text.trim(),
      choices,
    });
  };

  const updateChoice = (index: number, newText: string) => {
    const newChoices = [...choices];
    newChoices[index] = { ...newChoices[index], text: newText };
    setChoices(newChoices);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6">
          {question ? 'Edit Question' : 'Add Question'}
        </h2>

        <div className="space-y-6">
          {/* Round Selection */}
          {!question && (
            <div>
              <label className="block text-gray-400 mb-2">Round</label>
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="w-full bg-gray-700 rounded-lg px-4 py-2"
              >
                {rounds.map(round => (
                  <option key={round.id} value={round.id}>
                    {ROUND_ICONS[round.config.type]} {round.config.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-gray-400 mb-2">Question</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your question"
              rows={3}
              className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white resize-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Answers (click to mark correct)</label>
            <div className="grid grid-cols-2 gap-3">
              {choices.map((choice, index) => (
                <div
                  key={choice.id}
                  className={`flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-all ${
                    choice.isCorrect
                      ? 'ring-2 ring-green-500 bg-green-500/20'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                  onClick={() => setCorrectAnswer(choice.id)}
                >
                  <div
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
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
                  >
                    {choice.color[0].toUpperCase()}
                  </div>
                  <input
                    value={choice.text}
                    onChange={(e) => updateChoice(index, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={`${choice.color.charAt(0).toUpperCase() + choice.color.slice(1)} answer`}
                    className="flex-1 bg-transparent border-none outline-none"
                  />
                  {choice.isCorrect && (
                    <span className="text-green-400 text-xl">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || choices.some((c) => !c.text.trim())}
            className="bg-buzz-green hover:bg-green-600 px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {question ? 'Save Changes' : 'Add Question'}
          </button>
        </div>
      </div>
    </div>
  );
}

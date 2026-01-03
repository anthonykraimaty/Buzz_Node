import mongoose, { Schema, Document } from 'mongoose';
import { GameState, Team, Round, Question, GameSettings, RoundResult } from '../types';

export interface GameDocument extends Document {
  gameId: string;
  name: string;
  status: GameState['status'];
  teams: Team[];
  rounds: Round[];
  currentRoundIndex: number;
  settings: GameSettings;
  roundResults: RoundResult[];
  createdAt: Date;
  updatedAt: Date;
}

const ChoiceSchema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  color: { type: String, enum: ['blue', 'orange', 'green', 'yellow'], required: true },
  isCorrect: { type: Boolean, required: true }
});

const QuestionSchema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  choices: [ChoiceSchema],
  category: String,
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
  mediaUrl: String,
  mediaType: { type: String, enum: ['image', 'audio', 'video'] },
  timeLimit: Number,
  roundType: String
});

const PlayerSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  controllerIndex: { type: Number, enum: [1, 2, 3, 4], required: true },
  avatar: String,
  color: String
});

const TeamSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
  players: [PlayerSchema],
  score: { type: Number, default: 0 },
  funName: String
});

const RoundConfigSchema = new Schema({
  type: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  questionCount: { type: Number, required: true },
  timePerQuestion: { type: Number, required: true },
  pointsCorrect: { type: Number, required: true },
  pointsWrong: { type: Number, required: true },
  pointsFast: Number,
  pointsSlow: Number,
  allowSteal: Boolean,
  ladderValues: [Number]
});

const RoundSchema = new Schema({
  id: { type: String, required: true },
  config: RoundConfigSchema,
  questions: [QuestionSchema],
  currentQuestionIndex: { type: Number, default: -1 },
  status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
  startTime: Number
});

const GameSettingsSchema = new Schema({
  maxPlayers: { type: Number, default: 4 },
  defaultTimeLimit: { type: Number, default: 20 },
  buzzLockoutMs: { type: Number, default: 500 },
  showLeaderboardBetweenRounds: { type: Boolean, default: true },
  playBuzzerSounds: { type: Boolean, default: true },
  playSoundEffects: { type: Boolean, default: true },
  allowLateBuzz: { type: Boolean, default: false },
  autoRevealAnswer: { type: Boolean, default: true },
  autoRevealDelayMs: { type: Number, default: 5000 },
  autoShowPoints: { type: Boolean, default: true },
  autoShowPointsDelayMs: { type: Number, default: 3000 },
  autoNextQuestion: { type: Boolean, default: true },
  autoNextDelayMs: { type: Number, default: 3000 }
});

const RoundResultSchema = new Schema({
  roundId: String,
  roundType: String,
  teamScores: [{
    teamId: String,
    pointsEarned: Number
  }],
  mvp: {
    playerId: String,
    pointsEarned: Number
  }
});

const GameSchema = new Schema<GameDocument>({
  gameId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ['lobby', 'setup', 'playing', 'paused', 'finished'],
    default: 'lobby'
  },
  teams: [TeamSchema],
  rounds: [RoundSchema],
  currentRoundIndex: { type: Number, default: -1 },
  settings: { type: GameSettingsSchema, default: () => ({}) },
  roundResults: [RoundResultSchema]
}, {
  timestamps: true
});

export const Game = mongoose.model<GameDocument>('Game', GameSchema);

// Question Bank for reusable questions
export interface QuestionBankDocument extends Document {
  category: string;
  questions: Question[];
}

const QuestionBankSchema = new Schema<QuestionBankDocument>({
  category: { type: String, required: true },
  questions: [QuestionSchema]
}, {
  timestamps: true
});

export const QuestionBank = mongoose.model<QuestionBankDocument>('QuestionBank', QuestionBankSchema);

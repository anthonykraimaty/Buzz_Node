import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Game } from './models/Game';
import { DEFAULT_ROUNDS, Question, Choice } from './types';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/buzzgame';

const CHOICE_COLORS: Choice['color'][] = ['blue', 'orange', 'green', 'yellow'];

function createQuestion(
  text: string,
  answers: string[],
  correctIndex: number,
  category?: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Question {
  return {
    id: uuidv4(),
    text,
    choices: answers.map((answer, i) => ({
      id: String.fromCharCode(97 + i),
      text: answer,
      color: CHOICE_COLORS[i],
      isCorrect: i === correctIndex
    })),
    category,
    difficulty
  };
}

function createTrueFalseQuestion(
  text: string,
  isTrue: boolean,
  category?: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Question {
  return {
    id: uuidv4(),
    text,
    choices: [
      { id: 'true', text: 'True', color: 'green', isCorrect: isTrue },
      { id: 'false', text: 'False', color: 'orange', isCorrect: !isTrue }
    ],
    category,
    difficulty
  };
}

const sampleQuestions: Record<string, Question[]> = {
  'fastest-finger': [
    createQuestion(
      'Which planet is known as the Red Planet?',
      ['Venus', 'Mars', 'Jupiter', 'Saturn'],
      1,
      'Science',
      'easy'
    ),
    createQuestion(
      'What is the capital of Japan?',
      ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'],
      2,
      'Geography',
      'easy'
    )
  ],
  'multiple-choice': [
    createQuestion(
      'Who painted the Mona Lisa?',
      ['Vincent van Gogh', 'Leonardo da Vinci', 'Pablo Picasso', 'Michelangelo'],
      1,
      'Art',
      'easy'
    ),
    createQuestion(
      'What year did World War II end?',
      ['1943', '1944', '1945', '1946'],
      2,
      'History',
      'medium'
    )
  ],
  'true-false': [
    createTrueFalseQuestion(
      'The Great Wall of China is visible from space with the naked eye.',
      false,
      'Myths',
      'medium'
    ),
    createTrueFalseQuestion(
      'Honey never spoils and has been found edible in ancient Egyptian tombs.',
      true,
      'Science',
      'medium'
    )
  ],
  'picture-sound': [
    createQuestion(
      'Which famous landmark is this? (Imagine: Eiffel Tower)',
      ['Big Ben', 'Eiffel Tower', 'Statue of Liberty', 'Colosseum'],
      1,
      'Landmarks',
      'easy'
    ),
    createQuestion(
      'Name this musical instrument sound. (Imagine: Piano)',
      ['Guitar', 'Violin', 'Piano', 'Drums'],
      2,
      'Music',
      'easy'
    )
  ],
  'steal-points': [
    createQuestion(
      'What is the largest ocean on Earth?',
      ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
      3,
      'Geography',
      'easy'
    ),
    createQuestion(
      'Which element has the chemical symbol "Au"?',
      ['Silver', 'Gold', 'Aluminum', 'Argon'],
      1,
      'Science',
      'medium'
    )
  ],
  'hot-potato': [
    createQuestion(
      'How many continents are there?',
      ['5', '6', '7', '8'],
      2,
      'Geography',
      'easy'
    ),
    createQuestion(
      'What is the fastest land animal?',
      ['Lion', 'Cheetah', 'Horse', 'Gazelle'],
      1,
      'Animals',
      'easy'
    ),
    createQuestion(
      'What is the chemical symbol for water?',
      ['H2O', 'CO2', 'NaCl', 'O2'],
      0,
      'Science',
      'easy'
    ),
    createQuestion(
      'Which planet is closest to the Sun?',
      ['Venus', 'Mercury', 'Mars', 'Earth'],
      1,
      'Science',
      'easy'
    ),
    createQuestion(
      'How many sides does a hexagon have?',
      ['5', '6', '7', '8'],
      1,
      'Math',
      'easy'
    ),
    createQuestion(
      'What is the largest mammal on Earth?',
      ['Elephant', 'Blue Whale', 'Giraffe', 'Hippo'],
      1,
      'Animals',
      'easy'
    ),
    createQuestion(
      'In which country is the Taj Mahal located?',
      ['Pakistan', 'India', 'Bangladesh', 'Nepal'],
      1,
      'Geography',
      'easy'
    ),
    createQuestion(
      'What color are emeralds?',
      ['Red', 'Blue', 'Green', 'Yellow'],
      2,
      'General',
      'easy'
    ),
    createQuestion(
      'How many legs does a spider have?',
      ['6', '8', '10', '12'],
      1,
      'Animals',
      'easy'
    ),
    createQuestion(
      'What is the capital of France?',
      ['London', 'Berlin', 'Paris', 'Madrid'],
      2,
      'Geography',
      'easy'
    ),
    createQuestion(
      'Which gas do plants absorb from the air?',
      ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Hydrogen'],
      1,
      'Science',
      'easy'
    ),
    createQuestion(
      'How many minutes are in one hour?',
      ['30', '45', '60', '90'],
      2,
      'Math',
      'easy'
    ),
    createQuestion(
      'What is the freezing point of water in Celsius?',
      ['-10°C', '0°C', '10°C', '32°C'],
      1,
      'Science',
      'easy'
    ),
    createQuestion(
      'Which animal is known as the King of the Jungle?',
      ['Tiger', 'Lion', 'Elephant', 'Bear'],
      1,
      'Animals',
      'easy'
    ),
    createQuestion(
      'What shape is a stop sign?',
      ['Circle', 'Square', 'Triangle', 'Octagon'],
      3,
      'General',
      'easy'
    ),
    createQuestion(
      'How many colors are in a rainbow?',
      ['5', '6', '7', '8'],
      2,
      'Science',
      'easy'
    ),
    createQuestion(
      'What is the smallest prime number?',
      ['0', '1', '2', '3'],
      2,
      'Math',
      'easy'
    ),
    createQuestion(
      'Which continent is Egypt in?',
      ['Asia', 'Africa', 'Europe', 'Australia'],
      1,
      'Geography',
      'medium'
    ),
    createQuestion(
      'What year did the Titanic sink?',
      ['1910', '1912', '1914', '1916'],
      1,
      'History',
      'medium'
    ),
    createQuestion(
      'What is the tallest mountain in the world?',
      ['K2', 'Mount Everest', 'Mont Blanc', 'Kilimanjaro'],
      1,
      'Geography',
      'easy'
    ),
    createQuestion(
      'Which country invented pizza?',
      ['Greece', 'Italy', 'Spain', 'France'],
      1,
      'Food',
      'easy'
    ),
    createQuestion(
      'How many bones are in the adult human body?',
      ['106', '156', '206', '256'],
      2,
      'Science',
      'medium'
    ),
    createQuestion(
      'What is the largest planet in our solar system?',
      ['Saturn', 'Neptune', 'Jupiter', 'Uranus'],
      2,
      'Science',
      'easy'
    ),
    createQuestion(
      'Which animal is the tallest in the world?',
      ['Elephant', 'Giraffe', 'Ostrich', 'Camel'],
      1,
      'Animals',
      'easy'
    ),
    createQuestion(
      'What is the main ingredient in guacamole?',
      ['Tomato', 'Avocado', 'Onion', 'Lime'],
      1,
      'Food',
      'easy'
    )
  ],
  'ladder': [
    createQuestion(
      'What is the square root of 144?',
      ['10', '11', '12', '14'],
      2,
      'Math',
      'easy'
    ),
    createQuestion(
      'Which Shakespeare play features the character Hamlet?',
      ['Macbeth', 'Othello', 'Hamlet', 'King Lear'],
      2,
      'Literature',
      'easy'
    )
  ],
  'final': [
    createQuestion(
      'In what year was the first iPhone released?',
      ['2005', '2006', '2007', '2008'],
      2,
      'Technology',
      'medium'
    ),
    createQuestion(
      'Which country has won the most FIFA World Cup titles?',
      ['Germany', 'Argentina', 'Brazil', 'Italy'],
      2,
      'Sports',
      'medium'
    )
  ]
};

async function seedSampleGame() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if sample game already exists
    const existingGame = await Game.findOne({ name: 'Sample Test Game' });
    if (existingGame) {
      console.log('Sample game already exists. Deleting and recreating...');
      await Game.deleteOne({ gameId: existingGame.gameId });
    }

    const gameId = uuidv4();
    const rounds = DEFAULT_ROUNDS.map(config => ({
      id: uuidv4(),
      config,
      questions: sampleQuestions[config.type] || [],
      currentQuestionIndex: -1,
      status: 'pending' as const
    }));

    const game = await Game.create({
      gameId,
      name: 'Sample Test Game',
      status: 'lobby',
      teams: [],
      rounds,
      currentRoundIndex: -1,
      settings: {
        maxPlayers: 4,
        defaultTimeLimit: 20,
        buzzLockoutMs: 500,
        showLeaderboardBetweenRounds: true,
        playBuzzerSounds: true,
        playSoundEffects: true,
        allowLateBuzz: false
      },
      roundResults: []
    });

    const totalQuestions = rounds.reduce((sum, r) => sum + r.questions.length, 0);
    console.log(`\nSample game created successfully!`);
    console.log(`Game ID: ${gameId}`);
    console.log(`Game Name: Sample Test Game`);
    console.log(`Rounds: ${rounds.length}`);
    console.log(`Total Questions: ${totalQuestions}`);
    console.log(`\nQuestions per round:`);
    rounds.forEach(r => {
      console.log(`  - ${r.config.name}: ${r.questions.length} questions`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding sample game:', error);
    process.exit(1);
  }
}

seedSampleGame();

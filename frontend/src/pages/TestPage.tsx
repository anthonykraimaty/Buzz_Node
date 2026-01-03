import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSounds } from '../hooks/useSounds';

interface ButtonPress {
  player: number;
  button: string;
  timestamp: number;
}

export default function TestPage() {
  const navigate = useNavigate();
  const { controllerConnected, testLights, setLights, lastButtonPress, clearButtonPress } = useGameStore();
  const { playSound } = useSounds();
  const [buttonHistory, setButtonHistory] = useState<ButtonPress[]>([]);
  const [activeButtons, setActiveButtons] = useState<Record<string, boolean>>({});

  // Listen for real controller button presses from backend
  useEffect(() => {
    if (lastButtonPress) {
      handleButtonPress(lastButtonPress.player, lastButtonPress.button);
      clearButtonPress();
    }
  }, [lastButtonPress]);

  // Listen for keyboard input to simulate buzzer presses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, { player: number; button: string }> = {
        // Player 1: Q W E R T
        'q': { player: 1, button: 'red' },
        'w': { player: 1, button: 'yellow' },
        'e': { player: 1, button: 'green' },
        'r': { player: 1, button: 'orange' },
        't': { player: 1, button: 'blue' },
        // Player 2: A S D F G
        'a': { player: 2, button: 'red' },
        's': { player: 2, button: 'yellow' },
        'd': { player: 2, button: 'green' },
        'f': { player: 2, button: 'orange' },
        'g': { player: 2, button: 'blue' },
        // Player 3: Z X C V B
        'z': { player: 3, button: 'red' },
        'x': { player: 3, button: 'yellow' },
        'c': { player: 3, button: 'green' },
        'v': { player: 3, button: 'orange' },
        'b': { player: 3, button: 'blue' },
        // Player 4: 1 2 3 4 5
        '1': { player: 4, button: 'red' },
        '2': { player: 4, button: 'yellow' },
        '3': { player: 4, button: 'green' },
        '4': { player: 4, button: 'orange' },
        '5': { player: 4, button: 'blue' },
      };

      const mapping = keyMap[e.key.toLowerCase()];
      if (mapping) {
        handleButtonPress(mapping.player, mapping.button);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleButtonPress = (player: number, button: string) => {
    const key = `${player}-${button}`;

    // Play sound
    if (button === 'red') {
      playSound('buzz');
    } else {
      playSound('tick');
    }

    // Add to history
    setButtonHistory(prev => [
      { player, button, timestamp: Date.now() },
      ...prev.slice(0, 19) // Keep last 20
    ]);

    // Show active state
    setActiveButtons(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setActiveButtons(prev => ({ ...prev, [key]: false }));
    }, 200);
  };

  const clearHistory = () => {
    setButtonHistory([]);
  };

  const getButtonColor = (button: string) => {
    switch (button) {
      case 'red': return 'bg-red-500';
      case 'yellow': return 'bg-yellow-400 text-gray-900';
      case 'green': return 'bg-green-500';
      case 'orange': return 'bg-orange-500';
      case 'blue': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Buzzer & Keys Test</h1>
            <p className="text-gray-400">Test your Buzz controllers and keyboard mappings</p>
          </div>
          <button onClick={() => navigate('/')} className="btn-secondary">
            Back to Home
          </button>
        </div>

        {/* Controller Status */}
        <div className="card mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${controllerConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-lg">
                {controllerConnected ? 'Buzz Controllers Connected' : 'No Controllers Detected'}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={testLights} className="btn-primary">
                Test All Lights
              </button>
              <button onClick={() => setLights([true, true, true, true])} className="btn-success">
                All Lights On
              </button>
              <button onClick={() => setLights([false, false, false, false])} className="btn-secondary">
                All Lights Off
              </button>
            </div>
          </div>
        </div>

        {/* Virtual Controllers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((player) => (
            <div key={player} className="card">
              <h3 className="text-xl font-bold mb-4 text-center">Player {player}</h3>

              {/* Buzzer (Red) */}
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => handleButtonPress(player, 'red')}
                  className={`w-24 h-24 rounded-full transition-all duration-100 ${
                    activeButtons[`${player}-red`]
                      ? 'bg-red-400 scale-95 shadow-inner'
                      : 'buzz-button red hover:scale-105'
                  }`}
                >
                  <span className="text-2xl font-black">BUZZ</span>
                </button>
              </div>

              {/* Answer Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {['yellow', 'green', 'orange', 'blue'].map((color) => (
                  <button
                    key={color}
                    onClick={() => handleButtonPress(player, color)}
                    className={`h-12 rounded-lg font-bold transition-all duration-100 ${
                      activeButtons[`${player}-${color}`]
                        ? `${getButtonColor(color)} scale-95 opacity-70`
                        : `${getButtonColor(color)} hover:scale-105`
                    }`}
                  >
                    {color[0].toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Light Control */}
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => {
                    const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
                    lights[player - 1] = true;
                    setLights(lights);
                  }}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Light P{player} Only
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Keyboard Mapping Reference */}
        <div className="card mb-8">
          <h3 className="text-xl font-bold mb-4">Keyboard Mappings</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-bold text-gray-400 mb-2">Player 1</div>
              <div className="space-y-1">
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">Q</kbd> Red (Buzz)</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">W</kbd> Yellow</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">E</kbd> Green</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">R</kbd> Orange</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">T</kbd> Blue</div>
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-400 mb-2">Player 2</div>
              <div className="space-y-1">
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">A</kbd> Red (Buzz)</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">S</kbd> Yellow</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">D</kbd> Green</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">F</kbd> Orange</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">G</kbd> Blue</div>
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-400 mb-2">Player 3</div>
              <div className="space-y-1">
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">Z</kbd> Red (Buzz)</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">X</kbd> Yellow</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">C</kbd> Green</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">V</kbd> Orange</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">B</kbd> Blue</div>
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-400 mb-2">Player 4</div>
              <div className="space-y-1">
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">1</kbd> Red (Buzz)</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">2</kbd> Yellow</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">3</kbd> Green</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">4</kbd> Orange</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">5</kbd> Blue</div>
              </div>
            </div>
          </div>
        </div>

        {/* Button Press History */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Button Press History</h3>
            <button onClick={clearHistory} className="btn-secondary text-sm">
              Clear
            </button>
          </div>

          {buttonHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Press any button on the controller or use keyboard shortcuts to test
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {buttonHistory.map((press, index) => (
                <div
                  key={`${press.timestamp}-${index}`}
                  className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg"
                >
                  <span className="font-bold text-lg">P{press.player}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${getButtonColor(press.button)}`}>
                    {press.button.toUpperCase()}
                  </span>
                  <span className="text-gray-500 text-sm ml-auto">
                    {new Date(press.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sound Test */}
        <div className="card mt-8">
          <h3 className="text-xl font-bold mb-4">Sound Test</h3>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => playSound('buzz')} className="btn-danger">
              Buzz Sound
            </button>
            <button onClick={() => playSound('correct')} className="btn-success">
              Correct
            </button>
            <button onClick={() => playSound('wrong')} className="btn-secondary">
              Wrong
            </button>
            <button onClick={() => playSound('tick')} className="btn-secondary">
              Tick
            </button>
            <button onClick={() => playSound('countdown')} className="btn-warning">
              Countdown
            </button>
            <button onClick={() => playSound('round-start')} className="btn-primary">
              Round Start
            </button>
            <button onClick={() => playSound('game-over')} className="btn-primary">
              Game Over
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

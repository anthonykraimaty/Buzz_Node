import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useGameStore, saveLastPage, getLastPage } from './store/gameStore';
import { useSounds } from './hooks/useSounds';
import HomePage from './pages/HomePage';
import SetupPage from './pages/SetupPage';
import GamePage from './pages/GamePage';
import HostPage from './pages/HostPage';
import TestPage from './pages/TestPage';
import AdminPage from './pages/AdminPage';

function App() {
  const { connect, disconnect, connected, controllerConnected, lastSoundEffect, clearSoundEffect, lastBuzzerSound, clearBuzzerSound, gameState } = useGameStore();
  const { playSound, playBuzzerSound } = useSounds();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  // Restore last page on initial load (only once when app mounts)
  useEffect(() => {
    const lastPage = getLastPage();
    // Only restore if we're on the home page (initial load) and there's an active game
    if (lastPage && location.pathname === '/' && gameState) {
      const validPages = ['/game', '/host', '/setup'];
      if (validPages.includes(lastPage)) {
        // Only restore game/host pages if game is in progress
        if (lastPage === '/game' || lastPage === '/host') {
          if (gameState.status === 'playing' || gameState.status === 'paused') {
            navigate(lastPage, { replace: true });
          }
        } else {
          navigate(lastPage, { replace: true });
        }
      }
    }
  }, [gameState]); // Run when gameState loads

  // Save current page to localStorage on navigation (only for game-related pages)
  useEffect(() => {
    const gamePaths = ['/game', '/host', '/setup'];
    if (gamePaths.includes(location.pathname)) {
      saveLastPage(location.pathname);
    }
  }, [location.pathname]);

  // Play sounds when they come from the server
  useEffect(() => {
    if (lastSoundEffect) {
      playSound(lastSoundEffect);
      clearSoundEffect();
    }
  }, [lastSoundEffect, playSound, clearSoundEffect]);

  // Play buzzer sounds when they come from the server
  useEffect(() => {
    if (lastBuzzerSound) {
      playBuzzerSound(lastBuzzerSound);
      clearBuzzerSound();
    }
  }, [lastBuzzerSound, playBuzzerSound, clearBuzzerSound]);

  return (
    <div className="min-h-screen game-bg">
      {/* Connection Status Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-gray-700/50 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg glow-red">
              <span className="text-xl font-black">B</span>
            </div>
            <span className="font-black text-2xl tracking-tight">BUZZ!</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Server Status */}
          <div className="flex items-center gap-2">
            <div className={`controller-light ${connected ? 'bg-green-500 active' : 'bg-red-500'}`}
                 style={{ color: connected ? '#22c55e' : '#ef4444' }} />
            <span className="text-sm font-medium">{connected ? 'Connected' : 'Offline'}</span>
          </div>

          {/* Controller Status */}
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].map((p) => (
              <div
                key={p}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  controllerConnected
                    ? 'bg-gradient-to-br from-red-500 to-red-700 shadow-md'
                    : 'bg-gray-700'
                }`}
              >
                P{p}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/host" element={<HostPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;

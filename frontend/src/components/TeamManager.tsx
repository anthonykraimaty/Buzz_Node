import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSounds } from '../hooks/useSounds';
import { Team, FUN_TEAM_NAMES, TEAM_COLORS, MAX_TEAMS, BUZZER_SOUNDS, BuzzerSound } from '../types';

export default function TeamManager() {
  const { gameState, addTeam, removeTeam, updateTeam, adjustScore, setLights } = useGameStore();

  // Get available colors (not yet used by a team)
  const usedColors = gameState?.teams.map(t => t.color) || [];
  const availableColors = TEAM_COLORS.filter(c => !usedColors.includes(c.hex));
  const canAddTeam = (gameState?.teams.length || 0) < MAX_TEAMS && availableColors.length > 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Teams ({gameState?.teams.length || 0}/{MAX_TEAMS})</h2>
      </div>

      {/* Available Color Slots */}
      <div className="bg-gray-800/50 rounded-xl p-4 mb-6 overflow-visible">
        <div className="text-gray-400 text-sm mb-3">Team Slots (Click to add)</div>
        <div className="grid grid-cols-4 gap-4 overflow-visible">
          {TEAM_COLORS.map((colorInfo) => {
            const existingTeam = gameState?.teams.find(t => t.color === colorInfo.hex);
            const isUsed = !!existingTeam;

            return (
              <TeamSlot
                key={colorInfo.id}
                colorInfo={colorInfo}
                team={existingTeam}
                onLightBuzzer={() => {
                  const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];
                  lights[colorInfo.controllerIndex - 1] = true;
                  setLights(lights);
                  // Turn off after 2 seconds
                  setTimeout(() => setLights([false, false, false, false]), 2000);
                }}
                onAdd={() => {
                  if (!isUsed && canAddTeam) {
                    // Get a random fun name
                    const usedNames = gameState?.teams.map(t => t.name) || [];
                    const availableNames = FUN_TEAM_NAMES.filter(n => !usedNames.includes(n));
                    const randomName = availableNames.length > 0
                      ? availableNames[Math.floor(Math.random() * availableNames.length)]
                      : `Team ${colorInfo.name}`;

                    addTeam({
                      name: randomName,
                      color: colorInfo.hex,
                      players: [{
                        id: crypto.randomUUID(),
                        name: `Player ${colorInfo.controllerIndex}`,
                        controllerIndex: colorInfo.controllerIndex as 1 | 2 | 3 | 4,
                      }],
                    });
                  }
                }}
                onRemove={() => existingTeam && removeTeam(existingTeam.id)}
                onUpdate={updateTeam}
                onAdjustScore={(points) => existingTeam && adjustScore(existingTeam.id, points)}
              />
            );
          })}
        </div>
      </div>

      {gameState?.teams.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-xl mb-2">No teams yet</p>
          <p>Click on a colored slot above to add a team</p>
        </div>
      )}
    </div>
  );
}

function TeamSlot({
  colorInfo,
  team,
  onLightBuzzer,
  onAdd,
  onRemove,
  onUpdate,
  onAdjustScore,
}: {
  colorInfo: typeof TEAM_COLORS[number];
  team?: Team;
  onLightBuzzer: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onUpdate: (team: Team) => void;
  onAdjustScore: (points: number) => void;
}) {
  const serverPlayerName = team?.players[0]?.name || '';
  const [editPlayerName, setEditPlayerName] = useState(serverPlayerName);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const { playBuzzerSound } = useSounds();

  // Only sync from server when the actual name string changes (not on every render)
  useEffect(() => {
    setEditPlayerName(serverPlayerName);
  }, [serverPlayerName]);

  const handleSavePlayerName = () => {
    if (team && editPlayerName.trim()) {
      const updatedPlayers = [...team.players];
      updatedPlayers[0] = { ...updatedPlayers[0], name: editPlayerName.trim() };
      onUpdate({ ...team, players: updatedPlayers });
    }
  };

  const handleSoundChange = (sound: BuzzerSound) => {
    if (team) {
      const updatedPlayers = [...team.players];
      updatedPlayers[0] = { ...updatedPlayers[0], buzzerSound: sound };
      onUpdate({ ...team, players: updatedPlayers });
    }
    setShowSoundPicker(false);
  };

  const currentSound = team?.players[0]?.buzzerSound || 'buzz';
  const currentSoundInfo = BUZZER_SOUNDS.find(s => s.id === currentSound) || BUZZER_SOUNDS[0];

  if (!team) {
    // Empty slot - show add button
    return (
      <button
        onClick={onAdd}
        className="p-4 rounded-xl border-2 border-dashed border-gray-600 hover:border-gray-500 transition-all group"
        style={{ borderColor: `${colorInfo.hex}40` }}
      >
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl font-bold mb-2 opacity-50 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: colorInfo.hex }}
        >
          +
        </div>
        <div className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">
          Add {colorInfo.name}
        </div>
        <div className="text-xs text-gray-500">Buzzer {colorInfo.controllerIndex}</div>
      </button>
    );
  }

  // Filled slot - show team info
  return (
    <div
      className="p-4 rounded-xl relative"
      style={{ backgroundColor: `${colorInfo.hex}20`, borderLeft: `4px solid ${colorInfo.hex}` }}
    >
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white flex items-center justify-center text-sm transition-colors"
      >
        ×
      </button>

      {/* Team color indicator */}
      <div
        className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl font-bold mb-2"
        style={{ backgroundColor: colorInfo.hex }}
      >
        {colorInfo.controllerIndex}
      </div>

      {/* Player name - always editable */}
      <div className="flex gap-1 mb-2">
        <input
          value={editPlayerName}
          onChange={(e) => setEditPlayerName(e.target.value)}
          onBlur={handleSavePlayerName}
          onKeyDown={(e) => e.key === 'Enter' && handleSavePlayerName()}
          className="flex-1 bg-gray-800 rounded px-2 py-1 text-center text-sm font-bold"
          placeholder="Player name"
          style={{ color: colorInfo.hex }}
        />
        <button
          onClick={onLightBuzzer}
          className="bg-gray-800 hover:bg-gray-700 rounded px-2 py-1 text-sm transition-colors"
          title="Light up buzzer"
        >
          💡
        </button>
      </div>

      {/* Buzzer Sound Picker */}
      <div className="relative mb-2">
        <div className="flex gap-1">
          <button
            onClick={() => setShowSoundPicker(!showSoundPicker)}
            className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-lg px-2 py-1 text-xs flex items-center justify-center gap-1 transition-colors"
          >
            <span>{currentSoundInfo.emoji}</span>
            <span className="truncate">{currentSoundInfo.name}</span>
            <span className="text-gray-500">▼</span>
          </button>
          <button
            onClick={() => playBuzzerSound(currentSound)}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg px-2 py-1 text-xs transition-colors"
            title="Preview sound"
          >
            🔊
          </button>
        </div>

        {showSoundPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50 max-h-64 overflow-y-auto">
            {BUZZER_SOUNDS.map(sound => (
              <button
                key={sound.id}
                onClick={() => handleSoundChange(sound.id)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors ${
                  sound.id === currentSound ? 'bg-gray-700 text-white' : 'text-gray-300'
                }`}
              >
                <span>{sound.emoji}</span>
                <span>{sound.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playBuzzerSound(sound.id);
                  }}
                  className="ml-auto text-gray-400 hover:text-white px-1"
                  title="Preview"
                >
                  🔊
                </button>
                {sound.id === currentSound && <span className="text-green-400">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Score */}
      <div
        className="text-2xl font-black text-center mb-2"
        style={{ color: colorInfo.hex }}
      >
        {team.score}
      </div>

      {/* Score adjustment */}
      <div className="flex gap-1">
        <button
          onClick={() => onAdjustScore(-100)}
          className="flex-1 bg-red-900/50 hover:bg-red-800 px-1 py-1 rounded text-xs"
        >
          -100
        </button>
        <button
          onClick={() => onAdjustScore(100)}
          className="flex-1 bg-green-900/50 hover:bg-green-800 px-1 py-1 rounded text-xs"
        >
          +100
        </button>
      </div>
    </div>
  );
}

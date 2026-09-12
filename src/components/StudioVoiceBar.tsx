import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  kidSpeech,
  GEMINI_NEURAL_VOICES,
  DEFAULT_KID_VOICE_PROFILES,
} from '../services/speechSynthesis';
import { VoiceSettingsState, Language } from '../types';
import { VoiceWaveformVisualizer } from './VoiceWaveformVisualizer';
import { Sparkles, Settings2, Volume2, Gauge, Zap } from 'lucide-react';

interface StudioVoiceBarProps {
  language: Language;
  isAudioPlaying: boolean;
  onOpenVoiceModal: () => void;
}

export const StudioVoiceBar: React.FC<StudioVoiceBarProps> = ({
  language,
  isAudioPlaying,
  onOpenVoiceModal,
}) => {
  const [settings, setSettings] = useState<VoiceSettingsState>(() =>
    kidSpeech.getSettings()
  );

  useEffect(() => {
    const unsub = kidSpeech.subscribe((newSettings) => {
      setSettings(newSettings);
    });
    return unsub;
  }, []);

  const activeGeminiVoice =
    GEMINI_NEURAL_VOICES.find((v) => v.id === settings.geminiVoice) ||
    GEMINI_NEURAL_VOICES[0];
  const activeKidProfile =
    DEFAULT_KID_VOICE_PROFILES.find((p) => p.id === settings.kidProfileId) ||
    DEFAULT_KID_VOICE_PROFILES[0];

  const handleSpeedChange = (rate: number) => {
    kidSpeech.updateSettings({ rate });
  };

  const handleToggleEngine = () => {
    const nextEngine =
      settings.engine === 'gemini_neural' ? 'browser_native' : 'gemini_neural';
    kidSpeech.updateSettings({ engine: nextEngine });
  };

  return (
    <div
      className="bg-[#fcfbf9] border border-[#e8e4d8] rounded-2xl p-2 sm:p-2.5 flex items-center justify-between gap-2 sm:gap-3 flex-wrap shadow-2xs"
      id="studio-voice-bar"
    >
      {/* Left: Active Voice Badge & Switcher */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenVoiceModal}
          id="btn-voice-avatar-modal"
          className="flex items-center gap-2 bg-[#f4f1e8] hover:bg-[#eae5d8] border border-[#ded8c8] px-3 py-1.5 rounded-xl transition-all group"
          title="Customize AI Reading Voice"
        >
          <span className="text-lg">
            {settings.engine === 'gemini_neural'
              ? activeGeminiVoice.avatar
              : activeKidProfile.avatar}
          </span>
          <div className="text-left leading-tight">
            <div className="flex items-center gap-1">
              <span className="text-xs font-black text-[#2d2d2d] group-hover:text-amber-700">
                {settings.engine === 'gemini_neural'
                  ? activeGeminiVoice.name
                  : activeKidProfile.name}
              </span>
              {settings.engine === 'gemini_neural' && (
                <span className="bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  HD
                </span>
              )}
            </div>
            <span className="text-[10px] text-stone-500 font-medium">
              {settings.engine === 'gemini_neural'
                ? 'Gemini Neural Voice'
                : 'Kid Buddy Voice'}
            </span>
          </div>
        </button>

        {/* Engine Switch Pill */}
        <button
          onClick={handleToggleEngine}
          id="btn-toggle-voice-engine"
          title="Switch between Gemini Studio HD and Native Offline Voice"
          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
            settings.engine === 'gemini_neural'
              ? 'bg-[#fff8e6] text-amber-900 border-[#fae2a0] hover:bg-[#ffefc6]'
              : 'bg-[#f0f9ff] text-sky-900 border-[#bae6fd] hover:bg-[#e0f2fe]'
          }`}
        >
          {settings.engine === 'gemini_neural' ? (
            <>
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Studio AI</span>
            </>
          ) : (
            <>
              <Zap className="w-3 h-3 text-sky-600" />
              <span>Offline Voice</span>
            </>
          )}
        </button>
      </div>

      {/* Middle: Live Waveform Visualizer */}
      <div className="flex items-center gap-1 bg-[#f4f1e8] px-2 py-0.5 rounded-xl border border-[#ded8c8]">
        <VoiceWaveformVisualizer
          isActive={isAudioPlaying}
          colorScheme={settings.engine === 'gemini_neural' ? 'amber' : 'emerald'}
          barCount={10}
          height={24}
        />
        <span className="text-[10px] font-bold text-stone-500 px-1 hidden sm:inline">
          {isAudioPlaying ? 'Narrating' : 'Ready'}
        </span>
      </div>

      {/* Right: Speed Presets & Voice Settings */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center bg-[#f4f1e8] p-0.5 rounded-xl border border-[#ded8c8] text-stone-800">
          {[
            { label: '0.75x', rate: 0.75, title: 'Slow (Phonics pace)' },
            { label: '0.9x', rate: 0.9, title: 'Standard Reading' },
            { label: '1.1x', rate: 1.1, title: 'Fluency pace' },
          ].map((preset) => {
            const isSelected = Math.abs(settings.rate - preset.rate) < 0.05;
            return (
              <button
                key={preset.label}
                onClick={() => handleSpeedChange(preset.rate)}
                title={preset.title}
                className={`px-2 py-1 rounded-lg text-[11px] font-black transition-all ${
                  isSelected
                    ? 'bg-[#2d2d2d] text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-[#eae5d8]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Open Full Studio Modal */}
        <button
          onClick={onOpenVoiceModal}
          id="btn-open-voice-studio"
          title="Open Voice Studio Settings"
          className="p-2 bg-[#f4f1e8] hover:bg-[#eae5d8] text-[#2d2d2d] rounded-xl border border-[#ded8c8] transition-all"
        >
          <Settings2 className="w-4 h-4 text-stone-700" />
        </button>
      </div>
    </div>
  );
};

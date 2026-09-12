import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Language,
  KidVoiceProfile,
  KidVoiceProfileId,
  GeminiNeuralVoiceId,
  VoiceEngineType,
  VoiceSettingsState,
} from '../types';
import {
  kidSpeech,
  GEMINI_NEURAL_VOICES,
  DEFAULT_KID_VOICE_PROFILES,
} from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import { VoiceWaveformVisualizer } from './VoiceWaveformVisualizer';
import {
  Volume2,
  Check,
  Sparkles,
  X,
  Play,
  Square,
  Mic,
  Sliders,
  Zap,
  Radio,
  Music,
  Gauge,
} from 'lucide-react';

interface VoiceProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const VoiceProfileModal: React.FC<VoiceProfileModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const [settings, setSettings] = useState<VoiceSettingsState>(() =>
    kidSpeech.getSettings()
  );
  const [activeTab, setActiveTab] = useState<'gemini' | 'kid_buddies'>('gemini');
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = kidSpeech.subscribe((newSettings) => {
      setSettings(newSettings);
    });
    return () => {
      unsub();
      kidSpeech.stop();
    };
  }, []);

  if (!isOpen) return null;

  const handleSelectGeminiVoice = (voiceId: GeminiNeuralVoiceId) => {
    soundEffects.playStarChime();
    kidSpeech.updateSettings({
      engine: 'gemini_neural',
      geminiVoice: voiceId,
    });

    setTestingId(voiceId);
    kidSpeech.previewGeminiVoice(voiceId, language, () => {
      setTestingId(null);
    });
  };

  const handleSelectKidProfile = (profileId: KidVoiceProfileId) => {
    soundEffects.playStarChime();
    kidSpeech.updateSettings({
      engine: 'browser_native',
      kidProfileId: profileId,
    });

    setTestingId(profileId);
    kidSpeech.previewKidProfile(profileId, language, () => {
      setTestingId(null);
    });
  };

  const handleTestPreview = (
    e: React.MouseEvent,
    id: string,
    isGemini: boolean
  ) => {
    e.stopPropagation();
    soundEffects.playWordPop();

    if (testingId === id) {
      kidSpeech.stop();
      setTestingId(null);
      return;
    }

    setTestingId(id);
    if (isGemini) {
      kidSpeech.previewGeminiVoice(id as GeminiNeuralVoiceId, language, () => {
        setTestingId(null);
      });
    } else {
      kidSpeech.previewKidProfile(id as KidVoiceProfileId, language, () => {
        setTestingId(null);
      });
    }
  };

  const handleSpeedSlider = (rate: number) => {
    kidSpeech.updateSettings({ rate });
  };

  const handlePitchSlider = (pitch: number) => {
    kidSpeech.updateSettings({ pitch });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#e8e4d8] relative my-6 max-h-[92vh] flex flex-col"
          id="voice-profile-modal"
        >
          {/* Close button */}
          <button
            onClick={() => {
              kidSpeech.stop();
              onClose();
            }}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-700 flex items-center justify-center transition-all cursor-pointer z-10"
            id="btn-close-voice-modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-2xl shadow-xs">
              🎙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-[#2d2d2d]">
                  Studio Voice & Narration Engine
                </h3>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                  వాయిస్ స్టూడియో
                </span>
              </div>
              <p className="text-xs text-stone-500 font-semibold">
                High-Fidelity AI Voices & Kid Storytellers for Reading
              </p>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex bg-[#f4f1e8] p-1 rounded-2xl border border-[#ded8c8] mb-4">
            <button
              onClick={() => setActiveTab('gemini')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs transition-all ${
                activeTab === 'gemini'
                  ? 'bg-[#2d2d2d] text-white shadow-xs'
                  : 'text-stone-700 hover:text-[#2d2d2d]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Gemini Neural HD Voices (24kHz)</span>
              <span className="bg-amber-400 text-amber-950 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                BEST
              </span>
            </button>

            <button
              onClick={() => setActiveTab('kid_buddies')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs transition-all ${
                activeTab === 'kid_buddies'
                  ? 'bg-[#2d2d2d] text-white shadow-xs'
                  : 'text-stone-700 hover:text-[#2d2d2d]'
              }`}
            >
              <Zap className="w-4 h-4 text-sky-400" />
              <span>Kid Buddy Personas (Offline)</span>
            </button>
          </div>

          {/* Voice Cards Content Container (Scrollable) */}
          <div className="overflow-y-auto flex-1 pr-1 mb-4 space-y-3">
            {activeTab === 'gemini' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GEMINI_NEURAL_VOICES.map((voice) => {
                  const isSelected =
                    settings.engine === 'gemini_neural' &&
                    settings.geminiVoice === voice.id;
                  const isTesting = testingId === voice.id;

                  return (
                    <div
                      key={voice.id}
                      onClick={() => handleSelectGeminiVoice(voice.id)}
                      className={`relative rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#fffbf0] border-amber-500 ring-2 ring-amber-400/40 shadow-xs'
                          : 'bg-white border-[#e8e4d8] hover:border-amber-300 hover:bg-stone-50/70'
                      }`}
                      id={`voice-gemini-${voice.id}`}
                    >
                      {/* Top Row */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#fff8e6] border border-[#fde68a] shadow-2xs flex items-center justify-center text-2xl">
                            {voice.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-black text-[#2d2d2d]">
                                {voice.name}
                              </h4>
                              {isSelected && (
                                <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-amber-800">
                              {voice.nativeTitle}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Tone & Best For */}
                      <p className="text-xs text-stone-600 mb-2 leading-relaxed">
                        {voice.tone}
                      </p>

                      <div className="bg-[#f4f1e8] p-2 rounded-xl text-[11px] font-medium text-stone-700 mb-3 border border-[#ded8c8]">
                        <span className="font-bold text-amber-900">Best for:</span>{' '}
                        {voice.bestFor}
                      </div>

                      {/* Actions row */}
                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-auto">
                        <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          24kHz HD Neural
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleTestPreview(e, voice.id, true)}
                          className={`text-[11px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                            isTesting
                              ? 'bg-amber-500 text-white animate-pulse'
                              : 'bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-800'
                          }`}
                        >
                          {isTesting ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>Playing...</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3 text-amber-600" />
                              <span>Hear Sample</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DEFAULT_KID_VOICE_PROFILES.map((profile) => {
                  const isSelected =
                    settings.engine === 'browser_native' &&
                    settings.kidProfileId === profile.id;
                  const isTesting = testingId === profile.id;

                  return (
                    <div
                      key={profile.id}
                      onClick={() => handleSelectKidProfile(profile.id)}
                      className={`relative rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#eff6ff] border-blue-500 ring-2 ring-blue-400/40 shadow-xs'
                          : 'bg-white border-[#e8e4d8] hover:border-blue-300 hover:bg-stone-50/70'
                      }`}
                      id={`voice-kid-${profile.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 shadow-2xs flex items-center justify-center text-2xl">
                            {profile.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-black text-[#2d2d2d]">
                                {profile.name}
                              </h4>
                              {isSelected && (
                                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-blue-800">
                              {profile.nativeName}
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-stone-600 mb-3 leading-relaxed">
                        {profile.description}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-auto">
                        <span className="text-[10px] font-extrabold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                          {profile.accent}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleTestPreview(e, profile.id, false)}
                          className={`text-[11px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                            isTesting
                              ? 'bg-blue-600 text-white animate-pulse'
                              : 'bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-700'
                          }`}
                        >
                          {isTesting ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>Playing...</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3 text-blue-600" />
                              <span>Preview</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Voice Fine-Tuning Controls */}
          <div className="bg-[#fcfbf9] border border-[#e8e4d8] rounded-2xl p-3.5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-[#2d2d2d] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-600" />
                Reading Speed & Articulation
              </span>
              <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                {settings.rate.toFixed(2)}x Speed
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-stone-500">0.6x (Slow)</span>
              <input
                type="range"
                min="0.6"
                max="1.3"
                step="0.05"
                value={settings.rate}
                onChange={(e) => handleSpeedSlider(parseFloat(e.target.value))}
                className="flex-1 accent-amber-500 cursor-pointer"
                id="voice-speed-slider"
              />
              <span className="text-[11px] font-bold text-stone-500">1.3x (Fast)</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-stone-500 border-t border-[#f0ece1] pt-3">
            <div className="flex items-center gap-2">
              <VoiceWaveformVisualizer
                isActive={testingId !== null}
                colorScheme="amber"
                barCount={8}
                height={20}
              />
              <span className="text-[11px] text-stone-600 font-medium">
                {testingId ? 'Playing voice sample...' : 'Settings saved instantly'}
              </span>
            </div>

            <button
              onClick={() => {
                kidSpeech.stop();
                onClose();
              }}
              className="px-5 py-2.5 bg-[#2d2d2d] hover:bg-black text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all"
            >
              Done (పూర్తయింది)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

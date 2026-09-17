import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, SarvamNeuralVoiceId, VoiceSettingsState } from '../types';
import { kidSpeech, SARVAM_VOICES } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import { VoiceWaveformVisualizer } from './VoiceWaveformVisualizer';
import { Volume2, Check, X, Square, Sliders } from 'lucide-react';

interface VoiceProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const VoiceProfileModal: React.FC<VoiceProfileModalProps> = ({ isOpen, onClose, language }) => {
  const [settings, setSettings] = useState<VoiceSettingsState>(() => kidSpeech.getSettings());
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = kidSpeech.subscribe((newSettings) => setSettings(newSettings));
    return () => {
      unsub();
      kidSpeech.stop();
    };
  }, []);

  if (!isOpen) return null;

  const handleSelectVoice = (voiceId: SarvamNeuralVoiceId) => {
    soundEffects.playStarChime();
    kidSpeech.updateSettings({ engine: 'sarvam_hd', sarvamVoice: voiceId });
    setTestingId(voiceId);
    kidSpeech.previewSarvamVoice(voiceId, language, () => setTestingId(null));
  };

  const handleTestPreview = (e: React.MouseEvent, voiceId: SarvamNeuralVoiceId) => {
    e.stopPropagation();
    soundEffects.playWordPop();
    if (testingId === voiceId) {
      kidSpeech.stop();
      setTestingId(null);
      return;
    }
    setTestingId(voiceId);
    kidSpeech.previewSarvamVoice(voiceId, language, () => setTestingId(null));
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
          <button onClick={() => { kidSpeech.stop(); onClose(); }} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-700 flex items-center justify-center transition-all cursor-pointer z-10" id="btn-close-voice-modal">
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-2xl shadow-xs">🎙️</div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-[#2d2d2d]">Studio Voice & Narration Engine</h3>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">వాయిస్ స్టూడియో</span>
              </div>
              <p className="text-xs text-stone-500 font-semibold">Choose a female or male Sarvam HD storyteller voice</p>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 pr-1 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SARVAM_VOICES.map((voice) => {
                const isSelected = settings.engine === 'sarvam_hd' && settings.sarvamVoice === voice.id;
                const isTesting = testingId === voice.id;
                return (
                  <div key={voice.id} onClick={() => handleSelectVoice(voice.id)} className={`relative rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between ${isSelected ? 'bg-[#fffbf0] border-amber-500 ring-2 ring-amber-400/40 shadow-xs' : 'bg-white border-[#e8e4d8] hover:border-amber-300 hover:bg-stone-50/70'}`} id={`voice-gemini-${voice.id}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#fff8e6] border border-[#fde68a] shadow-2xs flex items-center justify-center text-2xl">{voice.avatar}</div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-black text-[#2d2d2d]">{voice.name}</h4>
                            {isSelected && <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]"><Check className="w-2.5 h-2.5 stroke-[3]" /></span>}
                          </div>
                          <p className="text-[10px] font-bold text-amber-800">{voice.nativeTitle[language]}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 mb-2 leading-relaxed">{voice.tone}</p>
                    <div className="bg-[#f4f1e8] p-2 rounded-xl text-[11px] font-medium text-stone-700 mb-3 border border-[#ded8c8]"><span className="font-bold text-amber-900">Best for:</span> {voice.bestFor}</div>
                    <div className="flex items-center justify-end pt-2 border-t border-stone-100 mt-auto">
                      <button type="button" onClick={(e) => handleTestPreview(e, voice.id)} className={`text-[11px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${isTesting ? 'bg-amber-500 text-white animate-pulse' : 'bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-800'}`}>
                        {isTesting ? <><Square className="w-3 h-3 fill-current" /><span>Playing...</span></> : <><Volume2 className="w-3 h-3 text-amber-600" /><span>Hear Sample</span></>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#fcfbf9] border border-[#e8e4d8] rounded-2xl p-3.5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-[#2d2d2d] flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 text-amber-600" />Reading Speed & Articulation</span>
              <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">{settings.rate.toFixed(2)}x Speed</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-stone-500">0.6x (Slow)</span>
              <input type="range" min="0.6" max="1.3" step="0.05" value={settings.rate} onChange={(e) => kidSpeech.updateSettings({ rate: parseFloat(e.target.value) })} className="flex-1 accent-amber-500 cursor-pointer" id="voice-speed-slider" />
              <span className="text-[11px] font-bold text-stone-500">1.3x (Fast)</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-500 border-t border-[#f0ece1] pt-3">
            <div className="flex items-center gap-2"><VoiceWaveformVisualizer isActive={testingId !== null} colorScheme="amber" barCount={8} height={20} /><span className="text-[11px] text-stone-600 font-medium">{testingId ? 'Playing voice sample...' : 'Settings saved instantly'}</span></div>
            <button onClick={() => { kidSpeech.stop(); onClose(); }} className="px-5 py-2.5 bg-[#2d2d2d] hover:bg-black text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all">Done (పూర్తయింది)</button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

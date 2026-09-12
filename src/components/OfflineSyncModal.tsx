import React, { useState } from 'react';
import { motion } from 'motion/react';
import { offlineStorage } from '../services/offlineStorage';
import { networkSyncToastService } from '../services/networkSyncToastService';
import { soundEffects } from '../services/soundEffects';
import {
  Wifi,
  WifiOff,
  Download,
  RefreshCw,
  CheckCircle2,
  HardDrive,
  Database,
  X,
  Radio,
  FileDown,
  Sparkles,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface OfflineSyncModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
  stories?: any[];
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  onClose,
  onSyncComplete,
}) => {
  const isOnline = offlineStorage.isOnline();
  const queue = offlineStorage.getOfflineQueue();
  const lastSync = offlineStorage.getLastSyncTime();
  const [isSyncing, setIsSyncing] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const handleForceSync = async () => {
    setIsSyncing(true);
    soundEffects.playPageTurn();
    const res = await offlineStorage.processSyncQueue();
    setIsSyncing(false);

    if (res.success) {
      soundEffects.playVictoryFanfare();
      networkSyncToastService.notifySuccess(
        'Reading Logs Synced',
        `Successfully synced ${res.syncedCount} reading logs to the cloud.`,
        'పఠన వివరాలు విజయవంతంగా సింక్ అయ్యాయి'
      );
      onSyncComplete();
    } else {
      // processSyncQueue internally triggers the retry toast!
      soundEffects.playWordPop();
    }
  };

  const handleDownloadPacks = async (lang?: string) => {
    soundEffects.playWordPop();
    const res = await offlineStorage.fetchAndDownloadOfflinePack(undefined, lang);
    if (res.success) {
      setDownloadMsg(`Successfully saved ${res.count} stories for 100% offline classroom use!`);
      setTimeout(() => setDownloadMsg(null), 4000);
      onSyncComplete();
    }
  };

  const handleSimulateSyncError = () => {
    soundEffects.playWordPop();
    offlineStorage.triggerSimulatedSyncError();
  };

  const handleSimulateFetchError = () => {
    soundEffects.playWordPop();
    offlineStorage.triggerSimulatedFetchError();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2d2d2d]/60 backdrop-blur-xs flex items-center justify-center p-4 select-none overflow-y-auto font-sans"
      id="offline-sync-modal"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#e8e4d8] relative my-auto max-h-[90vh] overflow-y-auto"
        id="offline-sync-card"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-600 rounded-full transition-all border border-[#e5e1d5] cursor-pointer"
          id="btn-close-offline-modal"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#f0ece1] pb-4 mb-4">
          <div
            className={`p-2.5 rounded-2xl ${
              isOnline
                ? 'bg-[#edf9f2] text-emerald-800 border border-[#c4ebd1]'
                : 'bg-[#fff8e6] text-amber-800 border border-[#fae2a0]'
            }`}
          >
            {isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-lg font-black text-[#2d2d2d]">
              Offline Reading & Sync Center
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Zero-internet storage & telemetry sync with auto-retry
            </p>
          </div>
        </div>

        {/* Connection Banner */}
        <div
          className={`p-4 rounded-3xl border mb-4 flex items-center justify-between ${
            isOnline
              ? 'bg-[#edf9f2] border-[#c4ebd1] text-emerald-950'
              : 'bg-[#fff8e6] border-[#fae2a0] text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <div>
              <p className="text-xs font-black">
                {isOnline ? 'Connected to Classroom Cloud' : 'Offline Mode (Local Storage)'}
              </p>
              <p className="text-[11px] opacity-80 mt-0.5">Last synced: {lastSync}</p>
            </div>
          </div>
          <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-white border border-current shadow-2xs">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Offline Story Packs Downloader */}
        <div className="bg-[#fbf9f4] p-4.5 rounded-3xl border border-[#e8e4d8] mb-4">
          <span className="text-xs font-black text-[#2d2d2d] block mb-1">
            📥 Download Offline Story Packages:
          </span>
          <p className="text-[11px] text-stone-600 mb-3 leading-relaxed">
            Download stories and audio prompts to this device so primary students can read without
            any internet connection.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleDownloadPacks('Telugu')}
              className="p-3 bg-white hover:bg-[#fff8e6] border border-[#e8e4d8] hover:border-[#fae2a0] rounded-2xl text-left transition-all cursor-pointer"
              id="btn-download-telugu-pack"
            >
              <span className="text-xs font-black text-[#2d2d2d] block">
                Telugu Pack (తెలుగు)
              </span>
              <span className="text-[10px] text-stone-500">All Grade 1-5 Stories</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPacks('Hindi')}
              className="p-3 bg-white hover:bg-[#fff8e6] border border-[#e8e4d8] hover:border-[#fae2a0] rounded-2xl text-left transition-all cursor-pointer"
              id="btn-download-hindi-pack"
            >
              <span className="text-xs font-black text-[#2d2d2d] block">
                Hindi Pack (हिन्दी)
              </span>
              <span className="text-[10px] text-stone-500">All Grade 1-5 Stories</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPacks('English')}
              className="p-3 bg-white hover:bg-[#fff8e6] border border-[#e8e4d8] hover:border-[#fae2a0] rounded-2xl text-left transition-all cursor-pointer"
              id="btn-download-english-pack"
            >
              <span className="text-xs font-black text-[#2d2d2d] block">English Pack</span>
              <span className="text-[10px] text-stone-500">All Grade 1-5 Stories</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPacks()}
              className="p-3 bg-[#2d2d2d] hover:bg-black text-white font-black rounded-2xl text-center flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer"
              id="btn-download-all-pack"
            >
              <FileDown className="w-4 h-4 text-amber-400" />
              <span>Download All (100%)</span>
            </button>
          </div>

          {downloadMsg && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 bg-[#edf9f2] border border-[#c4ebd1] rounded-2xl text-xs font-black text-emerald-950"
            >
              {downloadMsg}
            </motion.div>
          )}
        </div>

        {/* Sync Telemetry Queue with Sync & Retry */}
        <div className="flex items-center justify-between p-3.5 bg-[#fff8e6] rounded-2xl border border-[#fae2a0] mb-4 text-xs">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-700" />
            <span className="font-bold text-amber-950">
              Pending Sync Logs: <span className="font-black text-amber-800">{queue.length}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleForceSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-[#2d2d2d] hover:bg-black disabled:opacity-50 text-white font-black px-3.5 py-2 rounded-xl shadow-2xs transition-all cursor-pointer"
            id="btn-sync-now"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>

        {/* Retry Toast Simulator (for testing error recovery) */}
        <div className="p-3.5 rounded-2xl bg-stone-100 border border-stone-200 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-stone-600 tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Test Graceful Network Toast & Retry:</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSimulateSyncError}
              className="px-2.5 py-2 rounded-xl bg-white hover:bg-amber-50 border border-stone-300 text-stone-800 text-[11px] font-bold text-center transition-all cursor-pointer"
              id="btn-simulate-sync-error"
            >
              Test Sync Error Toast
            </button>
            <button
              type="button"
              onClick={handleSimulateFetchError}
              className="px-2.5 py-2 rounded-xl bg-white hover:bg-amber-50 border border-stone-300 text-stone-800 text-[11px] font-bold text-center transition-all cursor-pointer"
              id="btn-simulate-fetch-error"
            >
              Test Fetch Error Toast
            </button>
          </div>
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-[#f4f1e8] hover:bg-[#eae5d8] text-[#2d2d2d] font-black text-xs py-3 rounded-2xl border border-[#e5e1d5] transition-all cursor-pointer"
          id="btn-close-offline-footer"
        >
          Close Offline Center
        </button>
      </motion.div>
    </div>
  );
};

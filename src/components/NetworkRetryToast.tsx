import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NetworkSyncToast } from '../types';
import { networkSyncToastService } from '../services/networkSyncToastService';
import { soundEffects } from '../services/soundEffects';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Database,
  CloudOff,
  ShieldCheck,
} from 'lucide-react';

export const NetworkRetryToast: React.FC = () => {
  const [toasts, setToasts] = useState<NetworkSyncToast[]>([]);

  useEffect(() => {
    const unsub = networkSyncToastService.subscribe((list) => {
      setToasts(list);
    });
    return () => unsub();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-3 max-w-md w-[calc(100vw-2rem)] sm:w-full pointer-events-none select-none font-sans"
      id="network-retry-toast-container"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const isError = toast.type === 'sync_error' || toast.type === 'fetch_error';
          const isSuccess = toast.type === 'sync_success' || toast.type === 'fetch_success';
          const isOfflineNotice = toast.type === 'offline_detected';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`pointer-events-auto rounded-3xl p-4 sm:p-5 shadow-2xl border transition-all ${
                isSuccess
                  ? 'bg-white border-emerald-300 text-stone-900 shadow-emerald-900/10'
                  : isError
                  ? 'bg-[#2d2d2d] border-amber-500/60 text-white shadow-black/40'
                  : 'bg-stone-900 border-stone-700 text-stone-100 shadow-black/30'
              }`}
              id={`toast-card-${toast.id}`}
            >
              {/* Header Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div
                    className={`p-2.5 rounded-2xl shrink-0 flex items-center justify-center ${
                      isSuccess
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : isError
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-stone-800 text-stone-300 border border-stone-700'
                    }`}
                  >
                    {isSuccess ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : isError ? (
                      <WifiOff className="w-5 h-5 text-amber-400 animate-pulse" />
                    ) : (
                      <CloudOff className="w-5 h-5 text-stone-400" />
                    )}
                  </div>

                  {/* Title & Native text */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={`text-sm font-black tracking-tight ${
                          isSuccess ? 'text-emerald-950' : 'text-white'
                        }`}
                      >
                        {toast.title}
                      </h4>
                      {isError && (
                        <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-amber-400/30">
                          Offline Protected
                        </span>
                      )}
                    </div>

                    {toast.titleNative && (
                      <p
                        className={`text-xs font-semibold ${
                          isSuccess ? 'text-emerald-800' : 'text-amber-300/90'
                        }`}
                      >
                        {toast.titleNative}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dismiss X button */}
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playWordPop();
                    networkSyncToastService.dismiss(toast.id);
                  }}
                  className={`p-1.5 rounded-xl transition-colors shrink-0 cursor-pointer ${
                    isSuccess
                      ? 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                      : 'text-stone-400 hover:text-white hover:bg-stone-800'
                  }`}
                  id={`btn-dismiss-${toast.id}`}
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message Content */}
              <div className="mt-2.5 ml-11 space-y-1">
                <p
                  className={`text-xs leading-relaxed ${
                    isSuccess ? 'text-stone-600' : 'text-stone-300'
                  }`}
                >
                  {toast.message}
                </p>

                {toast.messageNative && (
                  <p
                    className={`text-[11px] leading-relaxed italic ${
                      isSuccess ? 'text-emerald-700' : 'text-amber-200/75'
                    }`}
                  >
                    {toast.messageNative}
                  </p>
                )}
              </div>

              {/* Data Safety Assurance Pill */}
              {isError && (
                <div className="mt-3 ml-11 flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-800/60 px-2.5 py-1 rounded-xl w-fit">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>0 Data Lost • Saved in Local Storage</span>
                </div>
              )}

              {/* Action Buttons: Retry & Keep Offline */}
              {toast.canRetry && (
                <div className="mt-4 ml-11 flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    disabled={toast.isRetrying}
                    onClick={async () => {
                      await networkSyncToastService.triggerRetry(toast.id);
                    }}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-black text-xs px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                    id="btn-toast-retry-action"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${toast.isRetrying ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {toast.isRetrying
                        ? 'Retrying Connection...'
                        : toast.actionLabel || 'Retry Sync'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playWordPop();
                      networkSyncToastService.dismiss(toast.id);
                    }}
                    className="text-stone-400 hover:text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
                    id="btn-toast-save-offline"
                  >
                    Keep Offline
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

import { NetworkSyncToast, NetworkToastType } from '../types';
import { soundEffects } from './soundEffects';

type ToastSubscriber = (toasts: NetworkSyncToast[]) => void;

class NetworkSyncToastService {
  private toasts: NetworkSyncToast[] = [];
  private subscribers: Set<ToastSubscriber> = new Set();
  private isSimulatingOffline = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.handleOnlineEvent();
      });
      window.addEventListener('offline', () => {
        this.handleOfflineEvent();
      });
    }
  }

  public getToasts(): NetworkSyncToast[] {
    return [...this.toasts];
  }

  public subscribe(callback: ToastSubscriber): () => void {
    this.subscribers.add(callback);
    callback(this.getToasts());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    const list = this.getToasts();
    this.subscribers.forEach((cb) => cb(list));
  }

  public showToast(toast: Omit<NetworkSyncToast, 'id' | 'timestamp'> & { id?: string }): string {
    const id = toast.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newToast: NetworkSyncToast = {
      ...toast,
      id,
      timestamp: new Date().toISOString(),
    };

    // Remove any existing toast with identical ID or same type to avoid clutter
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.toasts.push(newToast);

    // Play subtle audio cue
    if (toast.type === 'sync_error' || toast.type === 'fetch_error') {
      soundEffects.playWordPop();
    } else if (toast.type === 'sync_success' || toast.type === 'fetch_success') {
      soundEffects.playStarChime();
    }

    this.notify();

    // Auto-dismiss successes after 3.5s
    if (toast.type === 'sync_success' || toast.type === 'fetch_success') {
      setTimeout(() => {
        this.dismiss(id);
      }, 3500);
    }

    return id;
  }

  public dismiss(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public clearAll(): void {
    this.toasts = [];
    this.notify();
  }

  /**
   * Helper to trigger a graceful sync error notification with a Retry action
   */
  public notifySyncError(options: {
    pendingCount?: number;
    customMessage?: string;
    onRetry?: () => Promise<boolean | void>;
  }): string {
    const count = options.pendingCount ?? 1;
    return this.showToast({
      id: 'reading_log_sync_error',
      type: 'sync_error',
      title: 'Reading Logs Saved Offline',
      titleNative: 'పఠన పురోగతి ఆఫ్‌లైన్‌లో భద్రపరచబడింది',
      message:
        options.customMessage ||
        `Network error encountered while syncing ${count} reading ${
          count === 1 ? 'log' : 'logs'
        }. All your stars and progress are safely stored locally.`,
      messageNative: 'నెట్‌వర్క్ అంతరాయం కలిగింది. మీ పఠన ఫలితాలు స్థానికంగా సురక్షితంగా ఉన్నాయి.',
      itemCount: count,
      canRetry: true,
      actionLabel: 'Retry Sync (మళ్లీ ప్రయత్నించండి)',
      retryAction: options.onRetry,
    });
  }

  /**
   * Helper to trigger a graceful offline story pack fetch error notification with a Retry action
   */
  public notifyFetchError(options: {
    packName?: string;
    customMessage?: string;
    onRetry?: () => Promise<boolean | void>;
  }): string {
    const pack = options.packName || 'Story Pack';
    return this.showToast({
      id: `fetch_error_${pack.replace(/\s+/g, '_').toLowerCase()}`,
      type: 'fetch_error',
      title: `Could Not Download ${pack}`,
      titleNative: 'ఆఫ్‌లైన్ కథల డౌన్‌లోడ్ విఫలమైంది',
      message:
        options.customMessage ||
        `Network timeout while fetching ${pack}. Please check your connection or tap Retry to resume downloading.`,
      messageNative: 'నెట్‌వర్క్ కనెక్షన్ లోపించింది. డౌన్‌లోడ్ పునఃప్రారంభించడానికి రీట్రై నొక్కండి.',
      packName: pack,
      canRetry: true,
      actionLabel: 'Retry Download (మళ్లీ డౌన్‌లోడ్)',
      retryAction: options.onRetry,
    });
  }

  /**
   * Helper to notify sync recovery / success
   */
  public notifySuccess(title: string, message: string, titleNative?: string): string {
    return this.showToast({
      id: `success_${Date.now()}`,
      type: 'sync_success',
      title,
      titleNative,
      message,
      canRetry: false,
    });
  }

  /**
   * Execute the retry handler on a specific toast
   */
  public async triggerRetry(toastId: string): Promise<boolean> {
    const target = this.toasts.find((t) => t.id === toastId);
    if (!target) return false;

    // Set loading/retrying state
    this.toasts = this.toasts.map((t) =>
      t.id === toastId ? { ...t, isRetrying: true } : t
    );
    this.notify();
    soundEffects.playPageTurn();

    try {
      if (target.retryAction) {
        const result = await target.retryAction();
        // If result is explicitly false, assume it failed again
        if (result === false) {
          this.toasts = this.toasts.map((t) =>
            t.id === toastId
              ? {
                  ...t,
                  isRetrying: false,
                  message:
                    'Network connection still unavailable. Progress remains protected in offline storage.',
                  messageNative: 'నెట్‌వర్క్ ఇంకా అందుబాటులో లేదు. ఫలితాలు సురక్షితంగా ఉన్నాయి.',
                }
              : t
          );
          this.notify();
          return false;
        }
      }

      // Success! Transform toast into confirmation
      soundEffects.playVictoryFanfare();
      this.toasts = this.toasts.map((t) =>
        t.id === toastId
          ? {
              ...t,
              type: target.type === 'fetch_error' ? 'fetch_success' : 'sync_success',
              title:
                target.type === 'fetch_error'
                  ? 'Stories Downloaded Successfully!'
                  : 'Reading Logs Synced Successfully!',
              titleNative:
                target.type === 'fetch_error'
                  ? 'కథలు విజయవంతంగా డౌన్‌లోడ్ అయ్యాయి!'
                  : 'పఠన వివరాలు విజయవంతంగా సింక్ అయ్యాయి!',
              message:
                target.type === 'fetch_error'
                  ? `Offline reading pack is ready for 100% offline practice.`
                  : `All pending sessions, stars, and fluency telemetry have been synchronized.`,
              isRetrying: false,
              canRetry: false,
            }
          : t
      );
      this.notify();

      setTimeout(() => {
        this.dismiss(toastId);
      }, 3500);

      return true;
    } catch (err) {
      console.warn('Retry execution error:', err);
      this.toasts = this.toasts.map((t) =>
        t.id === toastId
          ? {
              ...t,
              isRetrying: false,
              message:
                'Connection attempt timed out. Your reading records are safe locally.',
            }
          : t
      );
      this.notify();
      return false;
    }
  }

  private handleOnlineEvent(): void {
    // When connection is restored, if there were active sync errors, notify recovery
    const hasSyncError = this.toasts.some((t) => t.type === 'sync_error');
    if (hasSyncError) {
      this.notifySuccess(
        'Internet Connection Restored',
        'Automatic background synchronization is now resuming.',
        'ఇంటర్నెట్ కనెక్షన్ పునరుద్ధరించబడింది'
      );
    }
  }

  private handleOfflineEvent(): void {
    // Graceful offline detection
    this.showToast({
      id: 'offline_status_toast',
      type: 'offline_detected',
      title: 'Offline Classroom Mode Active',
      titleNative: 'ఆఫ్‌లైన్ మోడ్ యాక్టివ్‌గా ఉంది',
      message:
        'You are now reading offline. All your speech recordings, stars, and story completions are saved locally on this device.',
      messageNative: 'మీరు ప్రస్తుతం ఆఫ్‌లైన్‌లో చదువుతున్నారు. అన్ని వివరాలు స్థానికంగా భద్రపరచబడతాయి.',
      canRetry: false,
    });
  }

  // Simulation helpers for demonstration/testing
  public toggleSimulation(): boolean {
    this.isSimulatingOffline = !this.isSimulatingOffline;
    return this.isSimulatingOffline;
  }

  public isSimulatedOffline(): boolean {
    return this.isSimulatingOffline;
  }
}

export const networkSyncToastService = new NetworkSyncToastService();

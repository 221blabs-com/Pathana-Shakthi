// Easy mode and the language of a child's screens: read from the signed-in
// child (set by them or their teacher), changed here, saved on the device
// and on the server (POST /api/student/prefs). The language chosen on the
// sign-in screen is remembered for the device so the login itself can talk
// in it before anyone has signed in.
import { Language, Student } from '../types';
import { easyModeOn, isUiLang, t, UiKey, UiLang } from '../data/uiStrings';
import { offlineStorage } from './offlineStorage';
import { kidSpeech } from './speechSynthesis';
import { authHeaders } from './backendApi';
import { STUDENT_UPDATED_EVENT } from './progressSync';

const DEVICE_LANG_KEY = 'ps_ui_lang';

export function deviceUiLang(): UiLang {
  try {
    const saved = localStorage.getItem(DEVICE_LANG_KEY);
    return isUiLang(saved) ? saved : 'English';
  } catch {
    return 'English';
  }
}

export function setDeviceUiLang(lang: UiLang) {
  try {
    localStorage.setItem(DEVICE_LANG_KEY, lang);
  } catch {
    // storage blocked
  }
}

/** The child's screen language: their own setting, else this device's. */
export const uiLangOf = (student?: Pick<Student, 'appLanguage'> | null): UiLang =>
  isUiLang(student?.appLanguage) ? student!.appLanguage! : deviceUiLang();

export const isEasy = (student?: Student | null) => easyModeOn(student);

/** Say a label aloud in the child's language (Shakthi Mitra's voice). */
export function say(text: string, lang: UiLang, onEnd?: () => void) {
  if (!text) return;
  void kidSpeech.speakText(text, lang as Language, { onEnd, onError: onEnd }).catch(() => onEnd?.());
}

export const sayKey = (lang: UiLang, key: UiKey, vars?: Record<string, string | number>) => say(t(lang, key, vars), lang);

async function savePrefs(prefs: { easyMode?: 'on' | 'off' | 'auto'; appLanguage?: UiLang }) {
  try {
    const headers = new Headers(await authHeaders());
    headers.set('Content-Type', 'application/json');
    await fetch('/api/student/prefs', { method: 'POST', headers, body: JSON.stringify(prefs) });
  } catch {
    // Kept on the device; the next change tries again.
  }
}

function updateLocal(patch: Partial<Student>) {
  offlineStorage.updateCurrentStudent(patch);
  window.dispatchEvent(new CustomEvent(STUDENT_UPDATED_EVENT));
}

export const kidPrefs = {
  setLanguage(lang: UiLang) {
    setDeviceUiLang(lang);
    updateLocal({ appLanguage: lang });
    sayKey(lang, 'langChosen');
    void savePrefs({ appLanguage: lang });
  },
  setEasy(on: boolean, lang: UiLang) {
    updateLocal({ easyMode: on ? 'on' : 'off' });
    sayKey(lang, on ? 'easyOn' : 'easyOffSay');
    void savePrefs({ easyMode: on ? 'on' : 'off' });
  },
};

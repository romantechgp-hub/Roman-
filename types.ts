
export enum Emotion {
  NEUTRAL = 'Neutral',
  HAPPY = 'Happy & Cheerful',
  SAD = 'Sad & Emotional',
  EXCITED = 'Excited & Energetic',
  ANGRY = 'Angry & Serious',
  WHISPER = 'Soft & Whispering'
}

export type Gender = 'male' | 'female';

export interface Voice {
  name: string;
  label: string;
  description: string;
  gender: Gender;
}

export interface HistoryItem {
  id: string;
  original: string;
  translated: string;
  from: string;
  to: string;
  timestamp: number;
}

export const VOICES: Voice[] = [
  { name: 'Puck', label: 'Puck', description: 'Bright & Playful', gender: 'male' },
  { name: 'Charon', label: 'Charon', description: 'Deep & Authoritative', gender: 'male' },
  { name: 'Fenrir', label: 'Fenrir', description: 'Warm & Natural', gender: 'male' }
];

export interface TranslationState {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  isTranslating: boolean;
  isGeneratingSpeech: boolean;
  isSpeaking: boolean;
  audioUrl: string | null;
  selectedEmotion: Emotion;
  selectedVoice: string;
  selectedGender: Gender;
  isNewsMode: boolean;
  history: HistoryItem[];
  isOnline: boolean;
}

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ar', name: 'Arabic' }
];

// Basic offline dictionary for common phrases
export const OFFLINE_DICTIONARY: Record<string, Record<string, string>> = {
  'hello': { 'bn': 'নমস্কার / হ্যালো', 'es': 'Hola', 'fr': 'Bonjour' },
  'thank you': { 'bn': 'ধন্যবাদ', 'es': 'Gracias', 'fr': 'Merci' },
  'help': { 'bn': 'সাহায্য করুন', 'es': 'Ayuda', 'fr': 'Aide' },
  'how are you': { 'bn': 'কেমন আছেন?', 'es': '¿Cómo estás?', 'fr': 'Comment ça va?' }
};

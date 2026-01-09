
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Header from './components/Header';
import { Emotion, LANGUAGES, VOICES, TranslationState, HistoryItem, OFFLINE_DICTIONARY, Gender } from './types';
import { translateText, generateExpressiveSpeech } from './services/geminiService';
import { decodeBase64, createWavBlob, decodeAudioData } from './utils/audioUtils';

const App: React.FC = () => {
  const [state, setState] = useState<TranslationState>(() => {
    const savedHistory = localStorage.getItem('translation_history');
    return {
      originalText: '',
      translatedText: '',
      sourceLang: 'en',
      targetLang: 'bn',
      isTranslating: false,
      isGeneratingSpeech: false,
      isSpeaking: false,
      audioUrl: null,
      selectedEmotion: Emotion.NEUTRAL,
      selectedVoice: 'Puck',
      selectedGender: 'male',
      isNewsMode: false,
      history: savedHistory ? JSON.parse(savedHistory) : [],
      isOnline: navigator.onLine
    };
  });

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);

  // Monitor connectivity & PWA install prompt
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    localStorage.setItem('translation_history', JSON.stringify(state.history));
  }, [state.history]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setState(prev => ({ ...prev, originalText: transcript }));
      };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') setError("Microphone access denied.");
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError("Speech recognition not supported.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setError(null);
      try {
        recognitionRef.current.lang = state.sourceLang;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) { setIsListening(false); }
    }
  };

  const handleTranslate = async () => {
    if (!state.originalText.trim()) return;
    const cleanText = state.originalText.toLowerCase().trim();

    if (!state.isOnline) {
      if (OFFLINE_DICTIONARY[cleanText] && OFFLINE_DICTIONARY[cleanText][state.targetLang]) {
        setState(prev => ({ ...prev, translatedText: OFFLINE_DICTIONARY[cleanText][state.targetLang] }));
      } else {
        setError("Offline mode active. Only basic phrases work without internet.");
      }
      return;
    }

    setState(prev => ({ ...prev, isTranslating: true, audioUrl: null, translatedText: '' }));
    setError(null);

    try {
      const translation = await translateText(
        state.originalText,
        LANGUAGES.find(l => l.code === state.sourceLang)?.name || state.sourceLang,
        LANGUAGES.find(l => l.code === state.targetLang)?.name || state.targetLang
      );
      
      const newHistoryItem: HistoryItem = {
        id: crypto.randomUUID(),
        original: state.originalText,
        translated: translation,
        from: state.sourceLang,
        to: state.targetLang,
        timestamp: Date.now()
      };

      setState(prev => ({ 
        ...prev, 
        translatedText: translation, 
        isTranslating: false,
        history: [newHistoryItem, ...prev.history].slice(0, 20)
      }));
    } catch (err) {
      setError("Translation failed. Check connection.");
      setState(prev => ({ ...prev, isTranslating: false }));
    }
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setState(prev => ({ ...prev, isSpeaking: false }));
  };

  const handleSpeak = async () => {
    if (!state.translatedText || !state.isOnline) return;
    if (state.isSpeaking) { stopAudio(); return; }

    setState(prev => ({ ...prev, isGeneratingSpeech: true }));
    setError(null);

    try {
      const base64Audio = await generateExpressiveSpeech(
        state.translatedText,
        state.selectedEmotion,
        state.targetLang === 'bn' ? 'Bengali' : 'English',
        state.selectedVoice,
        state.isNewsMode
      );
      const pcmData = decodeBase64(base64Audio);
      const wavBlob = createWavBlob(pcmData);
      const url = URL.createObjectURL(wavBlob);

      setState(prev => ({ ...prev, audioUrl: url, isGeneratingSpeech: false, isSpeaking: true }));
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const buffer = await decodeAudioData(pcmData, audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setState(prev => ({ ...prev, isSpeaking: false }));
      audioSourceRef.current = source;
      source.start();
    } catch (err) {
      setError("Voice synthesis failed.");
      setState(prev => ({ ...prev, isGeneratingSpeech: false, isSpeaking: false }));
    }
  };

  const filteredVoices = VOICES.filter(v => v.gender === state.selectedGender);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-safe">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {deferredPrompt && (
            <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="text-sm font-bold">Install Roman Translator on your device</p>
              </div>
              <button onClick={installApp} className="px-4 py-1.5 bg-white text-indigo-600 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-100 transition-colors">Install Now</button>
            </div>
          )}

          {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl text-sm text-red-700 font-medium">{error}</div>}

          <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
            <select value={state.sourceLang} onChange={(e) => setState(prev => ({ ...prev, sourceLang: e.target.value }))} className="flex-1 w-full p-3.5 bg-slate-50 border rounded-2xl font-semibold text-slate-700">
              {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
            </select>
            <button onClick={() => setState(prev => ({...prev, sourceLang: prev.targetLang, targetLang: prev.sourceLang, originalText: prev.translatedText, translatedText: prev.originalText}))} className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-transform active:rotate-180">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
            </button>
            <select value={state.targetLang} onChange={(e) => setState(prev => ({ ...prev, targetLang: e.target.value }))} className="flex-1 w-full p-3.5 bg-slate-50 border rounded-2xl font-semibold text-slate-700">
              {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`bg-white rounded-[2rem] shadow-sm border p-6 min-h-[350px] flex flex-col relative transition-all ${isListening ? 'border-red-400 ring-4 ring-red-50' : 'border-slate-200'}`}>
              <textarea value={state.originalText} onChange={(e) => setState(prev => ({ ...prev, originalText: e.target.value }))} placeholder="Type or speak..." className="flex-grow w-full resize-none border-none outline-none text-xl p-2 leading-relaxed text-slate-800 bg-transparent"/>
              <button onClick={toggleListening} className={`absolute top-6 right-6 p-4 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6"><path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/></svg>
              </button>
              <div className="mt-4 flex justify-between items-center border-t pt-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase">{state.originalText.length} chars</span>
                <button onClick={handleTranslate} disabled={state.isTranslating || !state.originalText.trim()} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 disabled:opacity-50">
                  {state.isTranslating ? 'Translating...' : 'Translate'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 min-h-[350px] flex flex-col relative">
              <div className="flex-grow w-full text-xl p-2 leading-relaxed text-slate-700 overflow-auto">
                {state.translatedText || <span className="text-slate-300 italic opacity-50">Results will appear here...</span>}
              </div>
              {state.translatedText && (
                <div className="mt-4 border-t pt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setState(prev => ({ ...prev, selectedGender: 'male' }))} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${state.selectedGender === 'male' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Male</button>
                      <button onClick={() => setState(prev => ({ ...prev, selectedGender: 'female' }))} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${state.selectedGender === 'female' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`} disabled>Female</button>
                    </div>
                    <button onClick={() => setState(prev => ({ ...prev, isNewsMode: !prev.isNewsMode }))} className={`px-4 py-2 rounded-xl text-xs font-bold border ${state.isNewsMode ? 'bg-red-600 text-white' : 'bg-white text-slate-600'}`}>News Mode</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filteredVoices.map(v => <button key={v.name} onClick={() => setState(prev => ({ ...prev, selectedVoice: v.name }))} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${state.selectedVoice === v.name ? 'bg-indigo-600 text-white' : 'bg-slate-50'}`}>{v.label}</button>)}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSpeak} disabled={state.isGeneratingSpeech || !state.isOnline} className={`flex-1 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95 ${state.isSpeaking ? 'bg-red-500' : 'bg-indigo-600'} disabled:opacity-50`}>
                      {state.isGeneratingSpeech ? 'Loading...' : state.isSpeaking ? 'Stop' : 'Voiceover'}
                    </button>
                    {state.audioUrl && <a href={state.audioUrl} download="translation.wav" className="p-4 bg-slate-100 rounded-2xl text-slate-600 border"><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12l4.5 4.5m0 0l4.5-4.5M12 3v13.5" strokeWidth="2"/></svg></a>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t p-8 text-center text-slate-400 text-[10px] font-bold tracking-widest uppercase">
        <p>&copy; {new Date().getFullYear()} Roman Translator &bull; Pro Broadcast Voice Enabled</p>
      </footer>
    </div>
  );
};

export default App;


import { GoogleGenAI, Modality } from "@google/genai";
import { Emotion } from "../types";

const API_KEY = process.env.API_KEY || "";

export const translateText = async (text: string, from: string, to: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Translate the following text from ${from} to ${to}. Return only the translated text.
    
    Text: ${text}`,
  });

  return response.text || "";
};

export const generateExpressiveSpeech = async (
  text: string, 
  emotion: Emotion, 
  language: string,
  voiceName: string = 'Puck',
  isNewsMode: boolean = false
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // Custom prompt to induce specific styles and emotions
  let voicePrompt = `Speak the following ${language} text with a ${emotion.toLowerCase()} tone: "${text}"`;
  
  if (isNewsMode) {
    voicePrompt = `Act as a professional news presenter. Deliver the following ${language} text with clear articulation, formal tone, perfectly measured pacing, and a crisp broadcast quality: "${text}"`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: voicePrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data returned from Gemini API");
  
  return base64Audio;
};

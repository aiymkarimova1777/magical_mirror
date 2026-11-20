
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface CommentaryResult {
  text: string;
  audioData?: string;
}

export const fetchAiCommentary = async (score: number, status: string, level: string): Promise<CommentaryResult> => {
  try {
    // 500 қатесін болдырмау үшін сұранысты барынша қарапайым етеміз
    const prompt = `Short cheer for a balloon pop game. Status: ${status}. Level: ${level}. Limit to 7 words.`;

    // Мәтінді алу (Gemini 3 Flash - ең тұрақты модель)
    const textGen = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    const resultText = textGen.text?.trim() || "Great job! Жарайсың!";

    try {
      // Дауысты алу (Бөлек блокта, егер ол қате берсе, ойын тоқтамауы тиіс)
      const audioGen = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: resultText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          },
        },
      });
      const audioData = audioGen.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return { text: resultText, audioData };
    } catch (e) {
      console.warn("TTS Error, skipping audio:", e);
      return { text: resultText };
    }
  } catch (error) {
    console.error("Gemini Global Error:", error);
    return { text: "Magical pop! Керемет!" };
  }
};

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

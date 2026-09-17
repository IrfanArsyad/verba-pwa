/**
 * Backend & AI Service Module
 * Modul ini menangani:
 * 1. Integrasi API 9router & System Prompt Baku
 * 2. Parsing JSON Strict & Handling Error Fallback
 * 3. HistoryManager untuk menyimpan, mengambil, dan menghapus riwayat di localStorage
 * 4. Modular TTS Provider (Browser SpeechSynthesis & Kokoro Homelab API)
 */

// ============================================================================
// 1. SYSTEM PROMPT BAKU FOR AI ENGLISH TUTOR
// ============================================================================
export const SYSTEM_PROMPT = `You are a friendly and expert AI English Tutor for Indonesian speakers.
Your job is to translate and correct the user's Indonesian input into natural, grammatically accurate English, and provide a clear, point-by-point grammar explanation in Indonesian.

CRITICAL INSTRUCTION:
You MUST respond strictly with a RAW JSON object.
Do NOT wrap your response in markdown syntax (such as \`\`\`json or \`\`\`).
Do NOT add any text outside of the JSON string.

The JSON schema MUST follow this exact structure:
{
  "indonesian_input": "<user's original Indonesian input text>",
  "english_text": "<corrected and natural English translation>",
  "explanation": "<point-by-point grammar explanation in Indonesian. Use bullet points or line breaks for readability.>"
}`;

/**
 * System Prompt baku khusus untuk Mode Chat Practice (Multi-turn Conversation)
 */
export const CHAT_SYSTEM_PROMPT = `You are a friendly, encouraging, and expert AI English Tutor for Indonesian learners engaged in an interactive practice chat.

YOUR RESPONSIBILITIES:
1. Respond to the user naturally and conversationally in English.
2. Provide a short, constructive grammar correction in Indonesian if the user made any grammatical/spelling errors in their previous message.
3. Provide an Indonesian translation of your English reply at the bottom.

CRITICAL INSTRUCTION:
You MUST respond strictly with a RAW JSON object.
Do NOT wrap your response in markdown syntax (such as \`\`\`json or \`\`\`).
Do NOT add any text outside of the JSON string.

The JSON schema MUST follow this exact structure:
{
  "reply": "<Your conversational response in natural English>",
  "correction": "<Short grammar correction in Indonesian for user's last input, or leave empty string '' if no errors>",
  "translation": "<Indonesian translation of your English reply>"
}`;

// ============================================================================
// 2. 9ROUTER API REQUEST HANDLER & JSON PARSER
// ============================================================================

/**
 * Mengirim permintaan terjemahan & koreksi tata bahasa ke API 9router
 * @param {string} indonesianInput - Teks bahasa Indonesia dari user
 * @param {string} apiKey - 9router API Key
 * @param {object} options - Opsi tambahan: model name & endpoint URL
 * @returns {Promise<{indonesian_input: string, english_text: string, explanation: string}>}
 */
export async function processIndonesianToEnglish(indonesianInput, apiKey, options = {}) {
  const endpoint = options.endpoint || 'https://api.9router.com/v1/chat/completions';
  const model = options.model || 'deepseek/deepseek-chat';

  // Validasi API Key
  if (!apiKey) {
    return createFallbackResponse(
      indonesianInput,
      'API Key 9router belum dikonfigurasi.',
      'Silakan masukkan 9router API Key Anda di pengaturan aplikasi.'
    );
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: indonesianInput }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('9router API Error:', response.status, errText);
      return createFallbackResponse(
        indonesianInput,
        'Gagal menghubungkan ke layanan AI.',
        `HTTP Status ${response.status}: ${errText.slice(0, 100)}`
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Parsing dan Validasi JSON Strict
    return parseAndValidateJSON(rawContent, indonesianInput);

  } catch (error) {
    console.error('Fetch Exception:', error);
    return createFallbackResponse(
      indonesianInput,
      'Terjadi gangguan koneksi.',
      `Error detail: ${error.message}`
    );
  }
}

/**
 * Mengirim array riwayat pesan (multi-turn conversation) ke API 9router untuk Mode Chat AI Practice
 * @param {Array<{role: 'user'|'assistant'|'system', content: string}>} messages - Array riwayat percakapan
 * @param {string} apiKey - 9router API Key
 * @param {object} options - Opsi tambahan: model name, endpoint URL, temperature
 * @returns {Promise<{reply: string, correction: string, translation: string}>}
 */
export async function processChatConversation(messages = [], apiKey, options = {}) {
  const endpoint = options.endpoint || 'https://api.9router.com/v1/chat/completions';
  const model = options.model || 'deepseek/deepseek-chat';
  const temperature = options.temperature !== undefined ? options.temperature : 0.7;

  // Validasi API Key
  if (!apiKey) {
    return createChatFallbackResponse(
      'Sorry, 9router API Key is not configured yet.',
      'Silakan masukkan API Key Anda pada pengaturan aplikasi.',
      'API Key 9router belum dikonfigurasi.'
    );
  }

  // Pastikan messages berupa array
  const validMessages = Array.isArray(messages) ? messages : [];

  // Sisipkan System Prompt Chat di paling awal riwayat pesan
  const fullConversation = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...validMessages
  ];

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: fullConversation,
        temperature: temperature
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('9router Chat API Error:', response.status, errText);
      return createChatFallbackResponse(
        'Sorry, failed to get response from AI Chat Service.',
        `HTTP Status ${response.status}: ${errText.slice(0, 100)}`,
        'Gagal terhubung ke layanan AI Chat.'
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Parsing dan Validasi JSON Strict untuk Chat
    return parseAndValidateChatJSON(rawContent);

  } catch (error) {
    console.error('Chat Fetch Exception:', error);
    return createChatFallbackResponse(
      'Sorry, a connection error occurred during chat.',
      `Error detail: ${error.message}`,
      'Terjadi kesalahan koneksi saat percakapan.'
    );
  }
}

/**
 * Pembersih Markdown Codeblock dan Validator Struktur JSON khusus Chat
 * @param {string} rawContent - Teks respon mentah dari LLM
 * @returns {{reply: string, correction: string, translation: string}}
 */
function parseAndValidateChatJSON(rawContent) {
  try {
    let cleanText = (rawContent || '').trim();

    // Hapus wrapper markdown (```json ... ```) jika LLM menyertakannya
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanText);

    // Validasi keberadaan kunci wajib (reply) pada skema JSON chat
    if (typeof parsed === 'object' && parsed !== null && 'reply' in parsed) {
      return {
        reply: parsed.reply || '',
        correction: parsed.correction || '',
        translation: parsed.translation || ''
      };
    }

    throw new Error('Skema JSON chat tidak lengkap.');
  } catch (err) {
    console.warn('Parsing JSON chat gagal, mengembalikan text fallback:', err.message, rawContent);
    return {
      reply: rawContent || 'No response generated.',
      correction: '',
      translation: ''
    };
  }
}

/**
 * Pembuat Respons Fallback untuk Mode Chat ketika terjadi kesalahan parsing / error API
 */
function createChatFallbackResponse(reply, correction, translation) {
  return {
    reply: reply || '',
    correction: correction || '',
    translation: translation || ''
  };
}

/**
 * Pembersih Markdown Codeblock dan Validator Struktur JSON
 * Memastikan output LLM sesuai dengan skema JSON yang dibutuhkan Frontend
 */
function parseAndValidateJSON(rawContent, fallbackInput) {
  try {
    let cleanText = rawContent.trim();
    
    // Hapus wrapper markdown (```json ... ```) jika LLM tidak sengaja menyertakannya
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanText);

    // Validasi keberadaan kunci yang wajib ada pada JSON schema
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'indonesian_input' in parsed &&
      'english_text' in parsed &&
      'explanation' in parsed
    ) {
      return parsed;
    }

    throw new Error('Skema JSON tidak lengkap.');
  } catch (err) {
    console.warn('JSON parsing failed, falling back:', err.message, rawContent);
    return createFallbackResponse(
      fallbackInput,
      'Respons AI tidak dapat dibaca dengan benar.',
      `Gagal memproses JSON dari LLM. Respon mentah: ${rawContent.slice(0, 150)}`
    );
  }
}

/**
 * Pembuat Respons Fallback ketika terjadi kesalahan parsing / error API
 */
function createFallbackResponse(indonesianInput, fallbackEnglish, fallbackExplanation) {
  return {
    indonesian_input: indonesianInput || '-',
    english_text: fallbackEnglish,
    explanation: fallbackExplanation
  };
}

// ============================================================================
// 3. HISTORY & STORAGE LOKAL MANAGER (HistoryManager)
// ============================================================================

const HISTORY_STORAGE_KEY = 'verba_ai_history';
const MAX_HISTORY_ITEMS = 50;

/**
 * HistoryManager Object
 * Mengelola riwayat hasil terjemahan di localStorage (Simpan, Ambil, Hapus)
 */
export const HistoryManager = {
  /**
   * Mengambil semua riwayat dari localStorage
   * @returns {Array<{id: string, timestamp: number, indonesian_input: string, english_text: string, explanation: string}>}
   */
  getHistory() {
    try {
      const rawData = localStorage.getItem(HISTORY_STORAGE_KEY);
      return rawData ? JSON.parse(rawData) : [];
    } catch (error) {
      console.error('Gagal mengambil history dari localStorage:', error);
      return [];
    }
  },

  /**
   * Menyimpan item terjemahan baru ke dalam riwayat localStorage
   * @param {object} item - Object terjemahan { indonesian_input, english_text, explanation }
   * @returns {Array} Array riwayat terbaru
   */
  saveItem(item) {
    if (!item || !item.english_text) return this.getHistory();

    try {
      const history = this.getHistory();
      const newItem = {
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: Date.now(),
        indonesian_input: item.indonesian_input || '',
        english_text: item.english_text || '',
        explanation: item.explanation || ''
      };

      // Tambahkan di paling awal (terbaru di atas)
      history.unshift(newItem);

      // Batasi jumlah maksimal riwayat agar localStorage tidak memenuhi kuota
      const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmedHistory));

      return trimmedHistory;
    } catch (error) {
      console.error('Gagal menyimpan item ke history:', error);
      return this.getHistory();
    }
  },

  /**
   * Menghapus satu item riwayat berdasarkan ID-nya
   * @param {string} id - ID item riwayat yang akan dihapus
   * @returns {Array} Array riwayat terbaru setelah item dihapus
   */
  deleteItem(id) {
    try {
      const history = this.getHistory();
      const updatedHistory = history.filter(item => item.id !== id);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      return updatedHistory;
    } catch (error) {
      console.error('Gagal menghapus item dari history:', error);
      return this.getHistory();
    }
  },

  /**
   * Menghapus seluruh riwayat terjemahan dari localStorage
   */
  clearHistory() {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      return [];
    } catch (error) {
      console.error('Gagal mengosongkan history:', error);
      return [];
    }
  }
};

const CHAT_STORAGE_KEY = 'verba_ai_chat_history';
const MAX_CHAT_ITEMS = 60;

/**
 * ChatHistoryManager Object
 * Mengelola riwayat pesan Chat AI di localStorage tanpa perlu Login
 */
export const ChatHistoryManager = {
  /**
   * Mengambil seluruh riwayat pesan chat tersimpan dari localStorage
   * @returns {Array<{role: string, content: string, reply?: string, correction?: string, translation?: string, timestamp: number}>}
   */
  getChatHistory() {
    try {
      const rawData = localStorage.getItem(CHAT_STORAGE_KEY);
      return rawData ? JSON.parse(rawData) : [];
    } catch (error) {
      console.error('Gagal mengambil history chat dari localStorage:', error);
      return [];
    }
  },

  /**
   * Menyimpan daftar pesan percakapan chat ke localStorage
   * @param {Array} chatList - Array pesan chat
   */
  saveChatHistory(chatList) {
    try {
      if (!Array.isArray(chatList)) return;
      const trimmedList = chatList.slice(-MAX_CHAT_ITEMS);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmedList));
    } catch (error) {
      console.error('Gagal menyimpan history chat ke localStorage:', error);
    }
  },

  /**
   * Menghapus seluruh riwayat percakapan chat dari localStorage
   */
  clearChatHistory() {
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return [];
    } catch (error) {
      console.error('Gagal mengosongkan chat history:', error);
      return [];
    }
  }
};

// ============================================================================
// 4. MODULAR TTS PROVIDER (Browser & Kokoro Homelab)
// ============================================================================

/**
 * Enum Pilihan TTS Provider
 */
export const TTSProvider = {
  BROWSER: 'browser',
  KOKORO_HOMELAB: 'kokoro'
};

const TTS_CONFIG_STORAGE_KEY = 'verba_ai_tts_config';

/**
 * Default konfigurasi untuk TTS
 */
export const DEFAULT_TTS_CONFIG = {
  provider: TTSProvider.BROWSER,
  kokoroUrl: 'http://localhost:8880/v1/audio/speech',
  voice: 'af_heart',
  rate: 0.9,
  lang: 'en-US'
};

/**
 * Mengambil konfigurasi TTS yang tersimpan di localStorage atau default
 * @returns {object}
 */
export function getTTSConfig() {
  try {
    const stored = localStorage.getItem(TTS_CONFIG_STORAGE_KEY);
    return stored ? { ...DEFAULT_TTS_CONFIG, ...JSON.parse(stored) } : { ...DEFAULT_TTS_CONFIG };
  } catch (error) {
    console.error('Gagal mengambil konfigurasi TTS:', error);
    return { ...DEFAULT_TTS_CONFIG };
  }
}

/**
 * Menyimpan konfigurasi TTS ke localStorage
 * @param {object} newConfig - Konfigurasi TTS yang baru (provider, kokoroUrl, voice, rate, lang)
 */
export function saveTTSConfig(newConfig = {}) {
  try {
    const currentConfig = getTTSConfig();
    const updated = { ...currentConfig, ...newConfig };
    localStorage.setItem(TTS_CONFIG_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Gagal menyimpan konfigurasi TTS:', error);
    return getTTSConfig();
  }
}

/**
 * Synthesizer Suara Modular
 * Mendukung pembacaan suara via Browser Web Speech API atau Homelab Kokoro API
 * @param {string} text - Teks bahasa Inggris yang akan diucapkan
 * @param {object} customConfig - Opsi konfigurasi opsional untuk melakukan override
 * @returns {Promise<{success: boolean, provider: string}>}
 */
export async function synthesizeTTS(text, customConfig = {}) {
  // Gabungkan konfigurasi yang tersimpan di localStorage dengan override yang diberikan
  const activeConfig = { ...getTTSConfig(), ...customConfig };
  const provider = activeConfig.provider || TTSProvider.BROWSER;

  // Jika provider dipilih adalah Kokoro Homelab API
  if (provider === TTSProvider.KOKORO_HOMELAB) {
    const kokoroUrl = activeConfig.kokoroUrl || DEFAULT_TTS_CONFIG.kokoroUrl;
    try {
      const res = await fetch(kokoroUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'kokoro',
          input: text,
          voice: activeConfig.voice || 'af_heart',
          response_format: 'mp3'
        })
      });
      if (!res.ok) throw new Error(`Kokoro TTS HTTP error status: ${res.status}`);
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      await audio.play();
      return { success: true, provider: TTSProvider.KOKORO_HOMELAB };
    } catch (err) {
      console.warn('Kokoro Homelab TTS gagal, mengalihkan secara otomatis ke Browser SpeechSynthesis:', err);
      // Fallback ke browser jika Kokoro Homelab offline/gagal
    }
  }

  // Provider Default: Browser SpeechSynthesis
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      return reject(new Error('Browser ini tidak mendukung fitur SpeechSynthesis (TTS).'));
    }
    
    // Hentikan suara yang sedang berputar sebelum memulai suara baru
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = activeConfig.lang || 'en-US';
    utterance.rate = activeConfig.rate || 0.9;
    
    // Cari dan pasangkan voice Bahasa Inggris jika tersedia di browser
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en-US') || v.lang.startsWith('en'));
    if (enVoice) utterance.voice = enVoice;

    utterance.onend = () => resolve({ success: true, provider: TTSProvider.BROWSER });
    utterance.onerror = (e) => reject(e);

    window.speechSynthesis.speak(utterance);
  });
}


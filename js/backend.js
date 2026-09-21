/**
 * Backend & AI Service Module
 * Modul ini menangani:
 * 1. Integrasi API 9router & System Prompt Baku
 * 2. Parsing JSON Strict & Handling Error Fallback
 * 3. HistoryManager untuk menyimpan, mengambil, dan menghapus riwayat di localStorage
 * 4. Modular TTS Provider (Browser SpeechSynthesis & Kokoro Homelab API)
 */

// ============================================================================
// 1. BAHASA & SYSTEM PROMPT DINAMIS
// ============================================================================

/**
 * Daftar bahasa yang didukung.
 * speech: kode untuk Web Speech (STT & TTS), stt: kode ISO-639-1 untuk Whisper.
 */
export const LANGUAGES = [
  { code: 'id', label: 'Indonesia', english: 'Indonesian', flag: '🇮🇩', speech: 'id-ID', stt: 'id', sample: 'Halo! Saya tutor bahasa Anda. Mari kita berlatih bersama.' },
  { code: 'en', label: 'Inggris', english: 'English', flag: '🇬🇧', speech: 'en-US', stt: 'en', sample: 'Hello! I am your VerbaAI tutor. Let us practice together.' },
  { code: 'ja', label: 'Jepang', english: 'Japanese', flag: '🇯🇵', speech: 'ja-JP', stt: 'ja', sample: 'こんにちは！あなたの語学チューターです。一緒に練習しましょう。' },
  { code: 'ko', label: 'Korea', english: 'Korean', flag: '🇰🇷', speech: 'ko-KR', stt: 'ko', sample: '안녕하세요! 저는 당신의 언어 튜터입니다. 함께 연습해요.' },
  { code: 'zh', label: 'Mandarin', english: 'Mandarin Chinese', flag: '🇨🇳', speech: 'zh-CN', stt: 'zh', sample: '你好！我是你的语言导师，我们一起练习吧。' },
  { code: 'ar', label: 'Arab', english: 'Arabic', flag: '🇸🇦', speech: 'ar-SA', stt: 'ar', sample: 'مرحبا! أنا معلم اللغة الخاص بك. لنتدرب معا.' },
  { code: 'es', label: 'Spanyol', english: 'Spanish', flag: '🇪🇸', speech: 'es-ES', stt: 'es', sample: '¡Hola! Soy tu tutor de idiomas. Practiquemos juntos.' },
  { code: 'de', label: 'Jerman', english: 'German', flag: '🇩🇪', speech: 'de-DE', stt: 'de', sample: 'Hallo! Ich bin dein Sprachtutor. Lass uns zusammen üben.' },
  { code: 'fr', label: 'Prancis', english: 'French', flag: '🇫🇷', speech: 'fr-FR', stt: 'fr', sample: 'Bonjour ! Je suis votre tuteur de langue. Pratiquons ensemble.' },
  { code: 'ms', label: 'Melayu', english: 'Malay', flag: '🇲🇾', speech: 'ms-MY', stt: 'ms', sample: 'Helo! Saya tutor bahasa anda. Mari kita berlatih bersama.' }
];

export const DEFAULT_SOURCE_LANG = 'id';
export const DEFAULT_TARGET_LANG = 'en';

export function getLanguage(code) {
  return LANGUAGES.find((lang) => lang.code === code) || LANGUAGES[0];
}

/**
 * Prompt tutor: terjemahkan + koreksi dari bahasa sumber ke bahasa tujuan,
 * penjelasan tata bahasa ditulis dalam bahasa sumber (bahasa yang dikuasai pengguna).
 */
export function buildTutorPrompt(sourceCode, targetCode) {
  const source = getLanguage(sourceCode).english;
  const target = getLanguage(targetCode).english;

  return `You are a friendly and expert AI ${target} tutor for ${source} speakers.
Your job is to translate and correct the user's ${source} input into natural, grammatically accurate ${target}, and provide a clear, point-by-point grammar explanation written in ${source}.

CRITICAL INSTRUCTION:
You MUST respond strictly with a RAW JSON object.
Do NOT wrap your response in markdown syntax (such as \`\`\`json or \`\`\`).
Do NOT add any text outside of the JSON string.

The JSON schema MUST follow this exact structure:
{
  "source_text": "<user's original ${source} input text>",
  "target_text": "<corrected and natural ${target} translation>",
  "explanation": "<point-by-point grammar explanation written in ${source}. One point per line.>"
}`;
}

/**
 * Prompt Mode Chat Practice (Multi-turn Conversation)
 */
export function buildChatPrompt(sourceCode, targetCode) {
  const source = getLanguage(sourceCode).english;
  const target = getLanguage(targetCode).english;

  return `You are a friendly, encouraging, and expert AI ${target} tutor for ${source} speakers engaged in an interactive practice chat.

YOUR RESPONSIBILITIES:
1. Respond to the user naturally and conversationally in ${target}.
2. Provide a short, constructive grammar correction written in ${source} if the user made any grammatical/spelling errors in their previous message.
3. Provide a ${source} translation of your ${target} reply at the bottom.

CRITICAL INSTRUCTION:
You MUST respond strictly with a RAW JSON object.
Do NOT wrap your response in markdown syntax (such as \`\`\`json or \`\`\`).
Do NOT add any text outside of the JSON string.

The JSON schema MUST follow this exact structure:
{
  "reply": "<Your conversational response in natural ${target}>",
  "correction": "<Short grammar correction in ${source} for user's last input, or leave empty string '' if no errors>",
  "translation": "<${source} translation of your ${target} reply>"
}`;
}

// ============================================================================
// 2. 9ROUTER API REQUEST HANDLER & JSON PARSER
// ============================================================================

/**
 * Ubah isian host dari pengaturan menjadi URL chat completions lengkap.
 * Menerima domain saja ("api.domain.com"), base URL ("https://x/v1"),
 * atau URL endpoint lengkap ("https://x/v1/chat/completions").
 */
export function resolveChatEndpoint(host) {
  return resolveApiUrl(host, '/chat/completions');
}

/**
 * Gabungkan isian host dengan path API (mis. "/audio/transcriptions").
 * Jika host sudah berupa URL endpoint lengkap, bagian endpoint-nya dibuang dulu.
 */
export function resolveApiUrl(host, path) {
  let url = (host || '').trim();
  if (!url) throw new Error('API Host belum diisi di Pengaturan.');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  
  // Jika host bertipe Google Generative Language API
  if (url.includes('generativelanguage.googleapis.com')) {
    return 'https://generativelanguage.googleapis.com/v1beta/openai' + path;
  }

  url = url.replace(/\/+$/, '').replace(/\/(chat\/completions|audio\/[a-z]+)$/i, '');
  if (!/\/v\d+$/i.test(url)) url += '/v1';
  return url + path;
}

/**
 * Buat header HTTP request (menambahkan X-Goog-Api-Key jika menggunakan Google Gemini).
 */
export function getApiHeaders(apiKey, host = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    if ((host || '').includes('generativelanguage.googleapis.com')) {
      headers['X-Goog-Api-Key'] = apiKey;
    }
  }
  return headers;
}

/**
 * Prompt kosakata harian: N kata dalam bahasa tujuan + arti dalam bahasa sumber.
 */
export function buildVocabPrompt(sourceCode, targetCode, count, avoid = []) {
  const source = getLanguage(sourceCode).english;
  const target = getLanguage(targetCode).english;
  const avoidLine = avoid.length
    ? `\nDo NOT use these words (already learned): ${avoid.slice(0, 60).join(', ')}.`
    : '';

  return `You are a ${target} vocabulary coach for ${source} speakers.
Pick exactly ${count} useful everyday ${target} words or short phrases for a learner, mixing difficulty from easy to intermediate.${avoidLine}

CRITICAL INSTRUCTION:
You MUST respond strictly with a RAW JSON object.
Do NOT wrap your response in markdown syntax (such as \`\`\`json or \`\`\`).
Do NOT add any text outside of the JSON string.

The JSON schema MUST follow this exact structure:
{
  "words": [
    {
      "word": "<the ${target} word or phrase>",
      "reading": "<pronunciation guide; romanization for non-Latin scripts, else empty string>",
      "type": "<part of speech written in ${source}, e.g. kata benda>",
      "meaning": "<short meaning written in ${source}>",
      "example": "<one natural example sentence in ${target}>",
      "example_translation": "<that sentence translated into ${source}>"
    }
  ]
}`;
}

/**
 * Minta daftar kosakata harian ke LLM.
 * @returns {Promise<Array<{word,reading,type,meaning,example,example_translation}>>}
 */
export async function generateVocabulary(apiKey, options = {}) {
  const endpoint = resolveChatEndpoint(options.endpoint);
  const count = options.count || 5;
  const rawModel = options.model || 'gemini-1.5-flash';
  const model = rawModel.replace(/^models\//i, '');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: getApiHeaders(apiKey, options.endpoint),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildVocabPrompt(options.sourceLang, options.targetLang, count, options.avoid || []) },
        { role: 'user', content: `Give me ${count} new words for today (${new Date().toDateString()}).` }
      ],
      temperature: 0.8
    })
  });

  if (!response.ok) {
    const errText = (await response.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(`HTTP ${response.status}: ${errText.slice(0, 140)}`);
  }

  const data = await response.json();
  let raw = (data.choices?.[0]?.message?.content || '').trim();
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

  const parsed = JSON.parse(raw);
  const words = Array.isArray(parsed) ? parsed : (parsed.words || []);
  return words
    .filter((w) => w && w.word)
    .slice(0, count)
    .map((w) => ({
      word: String(w.word),
      reading: String(w.reading || ''),
      type: String(w.type || ''),
      meaning: String(w.meaning || ''),
      example: String(w.example || ''),
      example_translation: String(w.example_translation || '')
    }));
}

// ============================================================================
// KOSAKATA HARIAN: penyimpanan per hari + kata yang sudah dikuasai + streak
// ============================================================================
const VOCAB_DAILY_KEY = 'verba_vocab_daily';
const VOCAB_LEARNED_KEY = 'verba_vocab_learned';
const VOCAB_STREAK_KEY = 'verba_vocab_streak';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Gagal menyimpan', key, err);
  }
}

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const VocabManager = {
  /** Kosakata hari ini untuk pasangan bahasa tertentu, atau null kalau belum ada */
  getToday(pair) {
    const all = readJSON(VOCAB_DAILY_KEY, {});
    const entry = all[`${todayKey()}|${pair}`];
    return entry && Array.isArray(entry.words) ? entry.words : null;
  },

  saveToday(pair, words) {
    const all = readJSON(VOCAB_DAILY_KEY, {});
    all[`${todayKey()}|${pair}`] = { date: todayKey(), pair, words };

    // Simpan maksimal 14 hari terakhir saja
    const keys = Object.keys(all).sort();
    while (keys.length > 14) delete all[keys.shift()];
    writeJSON(VOCAB_DAILY_KEY, all);
  },

  /** Daftar kata yang sudah ditandai dikuasai untuk pasangan bahasa ini */
  getLearned(pair) {
    return readJSON(VOCAB_LEARNED_KEY, {})[pair] || [];
  },

  isLearned(pair, word) {
    return this.getLearned(pair).includes(word);
  },

  toggleLearned(pair, word) {
    const all = readJSON(VOCAB_LEARNED_KEY, {});
    const list = all[pair] || [];
    const index = list.indexOf(word);
    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.push(word);
      this.markStreakToday();
    }
    all[pair] = list;
    writeJSON(VOCAB_LEARNED_KEY, all);
    return index < 0;
  },

  countLearned() {
    const all = readJSON(VOCAB_LEARNED_KEY, {});
    return Object.values(all).reduce((total, list) => total + list.length, 0);
  },

  /** Catat aktivitas belajar hari ini dan hitung streak harian berturut-turut */
  markStreakToday() {
    const streak = readJSON(VOCAB_STREAK_KEY, { last: '', count: 0 });
    const today = todayKey();
    if (streak.last === today) return streak.count;

    const yesterday = todayKey(new Date(Date.now() - 86400000));
    streak.count = streak.last === yesterday ? streak.count + 1 : 1;
    streak.last = today;
    writeJSON(VOCAB_STREAK_KEY, streak);
    return streak.count;
  },

  getStreak() {
    const streak = readJSON(VOCAB_STREAK_KEY, { last: '', count: 0 });
    if (!streak.last) return 0;
    const today = todayKey();
    const yesterday = todayKey(new Date(Date.now() - 86400000));
    return streak.last === today || streak.last === yesterday ? streak.count : 0;
  }
};

/**
 * Ambil daftar model dari endpoint /v1/models (format OpenAI).
 * @returns {Promise<string[]>} ID model, terurut
 */
export async function listModels(host, apiKey) {
  const isGemini = (host || '').includes('generativelanguage.googleapis.com');
  if (isGemini) {
    if (apiKey) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
        if (resp.ok) {
          const json = await resp.json();
          const models = (json.models || [])
            .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
            .map((m) => (m.name || '').replace(/^models\//i, ''))
            .filter((name) => name.startsWith('gemini'));
          if (models.length) return [...new Set(models)].sort((a, b) => a.localeCompare(b));
        }
      } catch (_) { /* fallback ke list manual */ }
    }
    return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'];
  }

  const endpoint = resolveApiUrl(host, '/models');
  let response;
  try {
    response = await fetch(endpoint, { headers: getApiHeaders(apiKey, host) });
  } catch (err) {
    throw new Error(`Tidak bisa menghubungi ${endpoint}. Cek domain (harus https & bisa diakses dari HP) atau izin CORS server. (${err.message})`);
  }

  const body = await response.text();
  if (!response.ok) {
    const plain = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(`${endpoint} → HTTP ${response.status}${response.status === 401 || response.status === 403 ? ' (API Key salah/tidak diizinkan)' : response.status === 404 ? ' (bukan server API, cek host)' : ''}: ${plain.slice(0, 120)}`);
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch (_) {
    throw new Error(`${endpoint} tidak mengembalikan JSON. Host kemungkinan bukan server API.`);
  }
  const items = Array.isArray(data) ? data : (data.data || data.models || []);
  const ids = items.map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
  return ids.length ? [...new Set(ids)].sort((a, b) => a.localeCompare(b)) : [];
}

/**
 * Mengirim permintaan terjemahan & koreksi tata bahasa ke API 9router
 * @param {string} indonesianInput - Teks bahasa Indonesia dari user
 * @param {string} apiKey - 9router API Key
 * @param {object} options - Opsi tambahan: model name & endpoint URL
 * @returns {Promise<{indonesian_input: string, english_text: string, explanation: string}>}
 */
export async function processIndonesianToEnglish(indonesianInput, apiKey, options = {}) {
  const endpoint = resolveChatEndpoint(options.endpoint);
  const rawModel = options.model || 'deepseek/deepseek-chat';
  const model = rawModel.replace(/^models\//i, '');

  // Validasi API Key
  if (!apiKey) {
    return createFallbackResponse(
      indonesianInput,
      'API Key belum dikonfigurasi.',
      'Silakan masukkan API Key Anda di pengaturan aplikasi.'
    );
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getApiHeaders(apiKey, options.endpoint),
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: buildTutorPrompt(options.sourceLang, options.targetLang) },
          { role: 'user', content: indonesianInput }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('LLM API Error:', response.status, errText);
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
  const endpoint = resolveChatEndpoint(options.endpoint);
  const model = options.model || 'deepseek/deepseek-chat';
  const temperature = options.temperature !== undefined ? options.temperature : 0.7;

  // Validasi API Key
  if (!apiKey) {
    return createChatFallbackResponse(
      'Sorry, API Key is not configured yet.',
      'Silakan masukkan API Key Anda pada pengaturan aplikasi.',
      'API Key belum dikonfigurasi.'
    );
  }

  // Pastikan messages berupa array
  const validMessages = Array.isArray(messages) ? messages : [];

  // Sisipkan System Prompt Chat di paling awal riwayat pesan
  const fullConversation = [
    { role: 'system', content: buildChatPrompt(options.sourceLang, options.targetLang) },
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

    // Terima skema baru (source_text/target_text) maupun skema lama
    if (typeof parsed === 'object' && parsed !== null && 'explanation' in parsed) {
      const sourceText = parsed.source_text ?? parsed.indonesian_input;
      const targetText = parsed.target_text ?? parsed.english_text;
      if (typeof sourceText === 'string' && typeof targetText === 'string') {
        return {
          indonesian_input: sourceText || fallbackInput,
          english_text: targetText,
          explanation: parsed.explanation
        };
      }
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
// 3b. SPEECH-TO-TEXT VIA SERVER (Whisper kompatibel OpenAI)
// ============================================================================

export const DEFAULT_STT_MODEL = 'whisper-1';

/**
 * Kirim rekaman audio ke endpoint /v1/audio/transcriptions pada host API.
 * Dipakai ketika Web Speech API diblokir (iOS di luar Safari / PWA terpasang).
 * @param {Blob} audioBlob - Hasil MediaRecorder
 * @param {string} apiKey - API Key host
 * @param {object} options - host, model, language
 * @returns {Promise<string>} Teks hasil transkripsi
 */
export async function transcribeAudio(audioBlob, apiKey, options = {}) {
  const endpoint = resolveApiUrl(options.host, '/audio/transcriptions');
  const type = audioBlob.type || '';
  const ext = type.includes('mp4') || type.includes('aac') ? 'm4a'
    : type.includes('ogg') ? 'ogg'
    : type.includes('wav') ? 'wav'
    : 'webm';

  const form = new FormData();
  form.append('file', audioBlob, `rekaman.${ext}`);
  form.append('model', options.model || DEFAULT_STT_MODEL);
  if (options.language) form.append('language', options.language);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form
  });

  if (!response.ok) {
    const errText = await response.text();
    const plain = errText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(`HTTP ${response.status}: ${plain.slice(0, 120)}`);
  }

  const data = await response.json();
  return (data.text || '').trim();
}

// ============================================================================
// 4. MODULAR TTS PROVIDER (Browser & Kokoro Homelab)
// ============================================================================

/**
 * Enum Pilihan TTS Provider
 */
export const TTSProvider = {
  BROWSER: 'browser',
  SERVER: 'server',
  KOKORO_HOMELAB: 'kokoro'
};

const TTS_CONFIG_STORAGE_KEY = 'verba_ai_tts_config';

/**
 * Default konfigurasi untuk TTS
 */
export const DEFAULT_TTS_CONFIG = {
  provider: TTSProvider.BROWSER,
  kokoroUrl: '',
  serverModel: '',
  serverVoice: '',
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

// ---------------------------------------------------------------------------
// Pemutar audio bersama. iOS hanya mengizinkan suara yang dipicu ketukan;
// elemen yang sudah "dibuka" sekali saat diketuk bisa dipakai ulang setelahnya.
// ---------------------------------------------------------------------------
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
let sharedAudio = null;
let audioUnlocked = false;

function getSharedAudio() {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.setAttribute('playsinline', '');
  }
  return sharedAudio;
}

/**
 * Panggil dari event ketukan pengguna (pointerdown/click) untuk membuka
 * izin pemutaran audio & SpeechSynthesis di iOS.
 */
export function unlockAudioPlayback() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  try {
    const audio = getSharedAudio();
    audio.src = SILENT_WAV;
    const p = audio.play();
    if (p && p.catch) p.catch(() => { audioUnlocked = false; });
  } catch (_) {
    audioUnlocked = false;
  }

  if ('speechSynthesis' in window) {
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.volume = 0;
    window.speechSynthesis.speak(warmup);
  }
}

async function playAudioBlob(blob) {
  const audio = getSharedAudio();
  const url = URL.createObjectURL(blob);
  audio.pause();
  audio.src = url;
  try {
    await audio.play();
    await new Promise((resolve) => {
      const done = () => {
        audio.removeEventListener('ended', done);
        audio.removeEventListener('error', done);
        resolve();
      };
      audio.addEventListener('ended', done);
      audio.addEventListener('error', done);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Utterance disimpan di luar fungsi agar tidak dibersihkan garbage collector
// sebelum selesai (bug Chrome/Safari yang membuat onend tidak pernah terpanggil).
let activeUtterance = null;

function speakWithBrowser(text, config) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Browser ini tidak mendukung suara (SpeechSynthesis).'));
      return;
    }

    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.lang || 'en-US';
    utterance.rate = config.rate || 0.9;

    const wanted = (config.lang || 'en-US').replace('_', '-');
    const base = wanted.split('-')[0];
    const voices = synth.getVoices().map((v) => ({ v, lang: (v.lang || '').replace('_', '-') }));
    const match = voices.find((x) => x.lang === wanted && x.v.localService)
      || voices.find((x) => x.lang === wanted)
      || voices.find((x) => x.lang.startsWith(base));
    if (match) utterance.voice = match.v;

    // Batas waktu supaya tombol tidak terkunci kalau browser diam saja
    const timeout = setTimeout(() => resolve({ success: true, provider: TTSProvider.BROWSER }), Math.max(4000, text.length * 120));
    utterance.onend = () => {
      clearTimeout(timeout);
      resolve({ success: true, provider: TTSProvider.BROWSER });
    };
    utterance.onerror = (e) => {
      clearTimeout(timeout);
      if (e.error === 'interrupted' || e.error === 'canceled') {
        resolve({ success: true, provider: TTSProvider.BROWSER });
      } else {
        reject(new Error(`Suara browser gagal: ${e.error || 'unknown'}`));
      }
    };

    activeUtterance = utterance;
    // Jeda singkat setelah cancel(); tanpa ini Chrome/Safari kadang membuang ucapan baru
    setTimeout(() => synth.speak(activeUtterance), 60);
    if (synth.paused) synth.resume();
  });
}

async function fetchSpeech(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const errText = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let message = errText;
    try { message = JSON.parse(errText).error?.message || errText; } catch (_) { /* bukan JSON */ }
    throw new Error(`HTTP ${res.status}: ${message.slice(0, 200)}`);
  }
  return res.blob();
}

/**
 * Synthesizer Suara Modular
 * Provider: Browser SpeechSynthesis, Server (Groq/OpenAI /v1/audio/speech), atau Kokoro.
 * Kalau provider server gagal, otomatis jatuh ke suara browser dan
 * mengembalikan `fallbackError` berisi alasannya.
 * @param {string} text - Teks bahasa Inggris yang akan diucapkan
 * @param {object} customConfig - Opsi konfigurasi opsional untuk melakukan override
 * @returns {Promise<{success: boolean, provider: string, fallbackError?: string}>}
 */
export async function synthesizeTTS(text, customConfig = {}) {
  const activeConfig = { ...getTTSConfig(), ...customConfig };
  const provider = activeConfig.provider || TTSProvider.BROWSER;
  let fallbackError = '';

  if (provider === TTSProvider.SERVER) {
    try {
      const host = activeConfig.serverHost || '';
      const isGroq = /groq\.com/i.test(host);
      const blob = await fetchSpeech(
        resolveApiUrl(host, '/audio/speech'),
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeConfig.serverKey || ''}` },
        {
          model: activeConfig.serverModel || (isGroq ? 'canopylabs/orpheus-v1-english' : 'tts-1'),
          voice: activeConfig.serverVoice || (isGroq ? 'hannah' : 'alloy'),
          input: text,
          response_format: 'wav'
        }
      );
      await playAudioBlob(blob);
      return { success: true, provider: TTSProvider.SERVER };
    } catch (err) {
      console.warn('TTS server gagal, beralih ke suara browser:', err);
      fallbackError = err.message;
    }
  }

  if (provider === TTSProvider.KOKORO_HOMELAB) {
    try {
      if (!activeConfig.kokoroUrl) throw new Error('Kokoro URL belum diisi.');
      const blob = await fetchSpeech(
        activeConfig.kokoroUrl,
        { 'Content-Type': 'application/json' },
        { model: 'kokoro', input: text, voice: activeConfig.voice || 'af_heart', response_format: 'mp3' }
      );
      await playAudioBlob(blob);
      return { success: true, provider: TTSProvider.KOKORO_HOMELAB };
    } catch (err) {
      console.warn('Kokoro TTS gagal, beralih ke suara browser:', err);
      fallbackError = err.message;
    }
  }

  const result = await speakWithBrowser(text, activeConfig);
  return fallbackError ? { ...result, fallbackError } : result;
}

import { 
  processIndonesianToEnglish, 
  processChatConversation,
  synthesizeTTS, 
  HistoryManager, 
  ChatHistoryManager,
  getTTSConfig, 
  saveTTSConfig, 
  TTSProvider,
  DEFAULT_STT_MODEL,
  transcribeAudio,
  resolveChatEndpoint,
  listModels,
  unlockAudioPlayback,
  LANGUAGES,
  getLanguage,
  DEFAULT_SOURCE_LANG,
  DEFAULT_TARGET_LANG,
  generateVocabulary,
  VocabManager
} from './backend.js?v=__BUILD__';

// DOM Elements - View Containers
const homeView = document.getElementById('homeView');
const voiceView = document.getElementById('voiceView');
const chatViewCard = document.getElementById('chatViewCard');
const dashboardView = document.getElementById('dashboardView');
const vocabView = document.getElementById('vocabView');

// DOM Elements - Home Launcher & Widgets
const quickVoiceCard = document.getElementById('quickVoiceCard');
const quickChatCard = document.getElementById('quickChatCard');
const quickDashCard = document.getElementById('quickDashCard');
const homeTotalCount = document.getElementById('homeTotalCount');
const homeSodSpeakBtn = document.getElementById('homeSodSpeakBtn');
const sodEnglish = document.getElementById('sodEnglish');

// DOM Elements - Dashboard View Controls
const dashClearAllBtn = document.getElementById('dashClearAllBtn');
const dashTotalSentences = document.getElementById('dashTotalSentences');
const dashVocabLearned = document.getElementById('dashVocabLearned');
const dashStreak = document.getElementById('dashStreak');
const dashHistoryCount = document.getElementById('dashHistoryCount');
const dashHistoryList = document.getElementById('dashHistoryList');

// DOM Elements - Voice & Text Input
const micBtn = document.getElementById('micBtn');
const waveVisualizer = document.getElementById('waveVisualizer');
const micStatus = document.getElementById('micStatus');
const textInput = document.getElementById('textInput');
const submitBtn = document.getElementById('submitBtn');
const mainInputCard = document.getElementById('mainInputCard');

// DOM Elements - Chat AI Component
const chatMessageList = document.getElementById('chatMessageList');
const chatInputText = document.getElementById('chatInputText');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatMicBtn = document.getElementById('chatMicBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const chatTypingIndicator = document.getElementById('chatTypingIndicator');

// DOM Elements - Settings & Config Modal
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsModalContent = document.getElementById('settingsModalContent');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiHostInput = document.getElementById('apiHostInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const modelSelect = document.getElementById('modelSelect'); // input teks, sumber nilai model
const modelPicker = document.getElementById('modelPicker');
const refreshModelsBtn = document.getElementById('refreshModelsBtn');
const modelStatus = document.getElementById('modelStatus');
const ttsProviderSelect = document.getElementById('ttsProviderSelect');
const kokoroUrlContainer = document.getElementById('kokoroUrlContainer');
const kokoroUrlInput = document.getElementById('kokoroUrlInput');
const ttsServerContainer = document.getElementById('ttsServerContainer');
const ttsModelInput = document.getElementById('ttsModelInput');
const ttsVoiceInput = document.getElementById('ttsVoiceInput');
const testVoiceBtn = document.getElementById('testVoiceBtn');
const aiStatusPill = document.getElementById('aiStatusPill');
const voiceStatusPill = document.getElementById('voiceStatusPill');
const sttProviderSelect = document.getElementById('sttProviderSelect');
const sttModelInput = document.getElementById('sttModelInput');
const sttHostInput = document.getElementById('sttHostInput');
const sttKeyInput = document.getElementById('sttKeyInput');
const sttStatus = document.getElementById('sttStatus');

// DOM Elements - Bottom Navigation Bar (Mobile Native UI)
const navHomeBtn = document.getElementById('navHomeBtn');
const navVoiceBtn = document.getElementById('navVoiceBtn');
const navChatBtn = document.getElementById('navChatBtn');
const navDashboardBtn = document.getElementById('navDashboardBtn');
const navVocabBtn = document.getElementById('navVocabBtn');
const navHistoryBadge = document.getElementById('navHistoryBadge');

// DOM Elements - Result & Loading Cards
const loadingState = document.getElementById('loadingState');
const resultCard = document.getElementById('resultCard');
const indonesianOutput = document.getElementById('indonesianOutput');
const englishOutput = document.getElementById('englishOutput');
const explanationOutput = document.getElementById('explanationOutput');

// DOM Elements - Action Buttons & Toast
const speakBtn = document.getElementById('speakBtn');
const copyBtn = document.getElementById('copyBtn');
const toast = document.getElementById('toast');
const offlineBanner = document.getElementById('offlineBanner');

// DOM Elements - History Drawer
const openHistoryBtn = document.getElementById('openHistoryBtn');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyDrawer = document.getElementById('historyDrawer');
const historyDrawerContent = document.getElementById('historyDrawerContent');
const historyList = document.getElementById('historyList');
const historyBadge = document.getElementById('historyBadge');

// App State
let isRecording = false;
let currentMicSource = 'voice'; // 'voice' | 'chat'
let mediaRecorder = null; // Perekam untuk mode STT server (Whisper)
let sourceLang = DEFAULT_SOURCE_LANG;
let targetLang = DEFAULT_TARGET_LANG;
let vocabCount = Number(localStorage.getItem('verba_vocab_count')) || 5;
let browserSttBlocked = false; // true setelah Web Speech ditolak (service-not-allowed)
let recognition = null;
let currentResult = null;
let activeTab = 'home'; // 'home' | 'voice' | 'chat' | 'dashboard'
let chatMessages = []; // Array of { role: 'user'|'assistant', content: string }

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // iOS: buka izin audio pada ketukan pertama agar jawaban bisa dibacakan otomatis
  ['touchend', 'click'].forEach((type) => document.addEventListener(type, unlockAudioPlayback, { capture: true, passive: true }));
  initSegmentedControls();
  initLanguagePicker();
  loadSettings();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  initSpeechRecognition();
  initOnlineStatusListener();
  registerServiceWorker();
  initInstallPrompt();
  renderHistoryList();
  loadSavedChatHistory();
  attachEventListeners();
});

// Load Saved API Key & Settings
function loadSettings() {
  // Load 9router LLM Settings
  const savedKey = localStorage.getItem('9router_api_key') || '';
  if (savedKey && apiKeyInput) apiKeyInput.value = savedKey;

  // Default lama (api.9router.com hanya website, bukan API) dibuang sekali.
  if (localStorage.getItem('9router_api_host') === 'https://api.9router.com/v1/chat/completions') {
    localStorage.removeItem('9router_api_host');
  }
  const savedHost = localStorage.getItem('9router_api_host') || '';
  if (apiHostInput) apiHostInput.value = savedHost;

  const savedModel = localStorage.getItem('9router_model') || '';
  if (modelSelect) modelSelect.value = savedModel;

  // Load STT Config (Web Speech vs Server Whisper)
  if (sttProviderSelect) sttProviderSelect.value = localStorage.getItem('verba_stt_provider') || 'auto';
  if (sttHostInput) sttHostInput.value = localStorage.getItem('verba_stt_host') || '';
  if (sttKeyInput) sttKeyInput.value = localStorage.getItem('verba_stt_key') || '';
  // "whisper-1" dulu jadi default padahal 9Router tidak punya model audio; kosongkan.
  const savedSttModel = localStorage.getItem('verba_stt_model') || '';
  if (sttModelInput) sttModelInput.value = savedSttModel === 'whisper-1' && !localStorage.getItem('verba_stt_host') ? '' : savedSttModel;

  // Load TTS Config (Browser / Server / Kokoro)
  const ttsConfig = getTTSConfig();
  if (ttsProviderSelect) ttsProviderSelect.value = ttsConfig.provider || TTSProvider.BROWSER;
  if (kokoroUrlInput) {
    // Default lama localhost tidak bisa dijangkau dari HP; Kokoro kini
    // diproksikan di domain yang sama lewat /kokoro/.
    const saved = /localhost/.test(ttsConfig.kokoroUrl || '') ? '' : (ttsConfig.kokoroUrl || '');
    kokoroUrlInput.value = saved || `${location.origin}/kokoro/v1/audio/speech`;
  }
  if (ttsModelInput) ttsModelInput.value = ttsConfig.serverModel || '';
  if (ttsVoiceInput) ttsVoiceInput.value = ttsConfig.serverVoice || '';

  refreshSegmentedControls();
  updateVoiceFields();
}

// ---------------------------------------------------------------------------
// Pilihan bahasa (sumber → tujuan)
// ---------------------------------------------------------------------------
function loadLanguages() {
  const savedSource = localStorage.getItem('verba_source_lang');
  const savedTarget = localStorage.getItem('verba_target_lang');
  if (savedSource && getLanguage(savedSource).code === savedSource) sourceLang = savedSource;
  if (savedTarget && getLanguage(savedTarget).code === savedTarget) targetLang = savedTarget;
  if (sourceLang === targetLang) targetLang = sourceLang === 'en' ? 'id' : 'en';
}

function setLanguages(nextSource, nextTarget) {
  // Sumber & tujuan tidak boleh sama; yang lama otomatis bertukar
  if (nextSource === nextTarget) {
    if (nextSource !== sourceLang) nextTarget = sourceLang;
    else nextSource = targetLang;
  }
  sourceLang = nextSource;
  targetLang = nextTarget;
  localStorage.setItem('verba_source_lang', sourceLang);
  localStorage.setItem('verba_target_lang', targetLang);
  applyLanguages();
}

function langChipHTML(lang, active) {
  return `<button type="button" data-lang="${lang.code}" class="flex items-center gap-2 rounded-2xl border px-3 py-2.5 min-h-[48px] text-[14px] font-semibold transition active:scale-[0.98] ${active ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/25' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'}">
    <span class="text-lg leading-none">${lang.flag}</span>${lang.label}
  </button>`;
}

function renderLanguageLists() {
  const sourceList = document.getElementById('sourceLangList');
  const targetList = document.getElementById('targetLangList');
  if (sourceList) sourceList.innerHTML = LANGUAGES.map((lang) => langChipHTML(lang, lang.code === sourceLang)).join('');
  if (targetList) targetList.innerHTML = LANGUAGES.map((lang) => langChipHTML(lang, lang.code === targetLang)).join('');
}

// Terapkan bahasa ke seluruh UI (label, placeholder, dan bahasa suara)
function applyLanguages() {
  const source = getLanguage(sourceLang);
  const target = getLanguage(targetLang);

  document.querySelectorAll('.lang-pill-text').forEach((el) => {
    el.textContent = `${source.flag} ${source.label} → ${target.flag} ${target.label}`;
  });
  const sourceBadge = document.getElementById('sourceBadge');
  const targetBadge = document.getElementById('targetBadge');
  if (sourceBadge) sourceBadge.textContent = source.code.toUpperCase();
  if (targetBadge) targetBadge.textContent = target.code.toUpperCase();

  document.querySelectorAll('.lang-info-source').forEach((el) => {
    el.textContent = `Ucapkan atau ketik kalimat Bahasa ${source.label}.`;
  });
  document.querySelectorAll('.lang-info-target').forEach((el) => {
    el.textContent = `AI mengubahnya jadi Bahasa ${target.label} yang benar.`;
  });

  if (textInput) textInput.placeholder = `Atau ketik kalimat Bahasa ${source.label}...`;
  if (chatInputText) chatInputText.placeholder = `Ketik atau ucapkan pesan Bahasa ${target.label}...`;
  const dashAccent = document.getElementById('dashTtsAccent');
  if (dashAccent) dashAccent.textContent = `${target.speech} Native`;
  if (recognition) recognition.lang = source.speech;
  renderLanguageLists();
  if (vocabView && !vocabView.classList.contains('hidden')) renderVocab();
}

function openLangModal() {
  const modal = document.getElementById('langModal');
  const content = document.getElementById('langModalContent');
  if (!modal || !content) return;
  renderLanguageLists();
  modal.classList.remove('opacity-0', 'pointer-events-none');
  content.classList.remove('translate-y-6');
}

function closeLangModal() {
  const modal = document.getElementById('langModal');
  const content = document.getElementById('langModalContent');
  if (!modal || !content) return;
  content.classList.add('translate-y-6');
  modal.classList.add('opacity-0', 'pointer-events-none');
}

function initLanguagePicker() {
  loadLanguages();
  applyLanguages();

  document.querySelectorAll('.lang-pill').forEach((btn) => btn.addEventListener('click', openLangModal));

  const modal = document.getElementById('langModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLangModal();
    });
  }
  const closeBtn = document.getElementById('closeLangBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeLangModal);

  const swapBtn = document.getElementById('swapLangBtn');
  if (swapBtn) swapBtn.addEventListener('click', () => setLanguages(targetLang, sourceLang));

  const sourceList = document.getElementById('sourceLangList');
  const targetList = document.getElementById('targetLangList');
  if (sourceList) {
    sourceList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (btn) setLanguages(btn.dataset.lang, targetLang);
    });
  }
  if (targetList) {
    targetList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (btn) setLanguages(sourceLang, btn.dataset.lang);
    });
  }
}

// Simpan semua isian pengaturan ke localStorage (tanpa validasi)
function persistSettings() {
  if (apiKeyInput) localStorage.setItem('9router_api_key', apiKeyInput.value.trim());
  if (apiHostInput) localStorage.setItem('9router_api_host', apiHostInput.value.trim());
  if (modelSelect) localStorage.setItem('9router_model', modelSelect.value.trim());

  if (sttProviderSelect) localStorage.setItem('verba_stt_provider', sttProviderSelect.value);
  if (sttHostInput) localStorage.setItem('verba_stt_host', sttHostInput.value.trim());
  if (sttKeyInput) localStorage.setItem('verba_stt_key', sttKeyInput.value.trim());
  if (sttModelInput) localStorage.setItem('verba_stt_model', sttModelInput.value.trim());
  browserSttBlocked = false;

  saveTTSConfig({
    provider: ttsProviderSelect ? ttsProviderSelect.value : TTSProvider.BROWSER,
    kokoroUrl: kokoroUrlInput ? kokoroUrlInput.value.trim() : '',
    serverModel: ttsModelInput ? ttsModelInput.value.trim() : '',
    serverVoice: ttsVoiceInput ? ttsVoiceInput.value.trim() : ''
  });
  updateVoiceFields();
}

// ---------------------------------------------------------------------------
// Kontrol segmented: <select data-segmented> tetap jadi sumber nilai,
// tombol-tombolnya dibuat dari <option> (teks + data-desc).
// ---------------------------------------------------------------------------
function initSegmentedControls() {
  document.querySelectorAll('select[data-segmented]').forEach((select) => {
    const container = document.querySelector(`[data-segmented-for="${select.id}"]`);
    if (!container) return;
    container.innerHTML = '';
    Array.from(select.options).forEach((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.value = option.value;
      btn.className = 'segmented-option text-left rounded-2xl border px-3 py-2.5 min-h-[52px] transition active:scale-[0.98]';
      btn.innerHTML = `<span class="block text-[13px] font-bold leading-tight"></span><span class="block text-[10px] mt-0.5 opacity-70 leading-tight"></span>`;
      btn.children[0].textContent = option.textContent;
      btn.children[1].textContent = option.dataset.desc || '';
      btn.addEventListener('click', () => {
        if (select.value === option.value) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change'));
        refreshSegmentedControls();
      });
      container.appendChild(btn);
    });
  });
  refreshSegmentedControls();
}

function refreshSegmentedControls() {
  document.querySelectorAll('select[data-segmented]').forEach((select) => {
    document.querySelectorAll(`[data-segmented-for="${select.id}"] .segmented-option`).forEach((btn) => {
      const active = btn.dataset.value === select.value;
      btn.classList.toggle('bg-blue-600', active);
      btn.classList.toggle('border-blue-600', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('shadow-md', active);
      btn.classList.toggle('shadow-blue-600/25', active);
      btn.classList.toggle('bg-white', !active);
      btn.classList.toggle('border-slate-200', !active);
      btn.classList.toggle('text-slate-700', !active);
    });
  });
}

function setPill(pill, text, tone) {
  if (!pill) return;
  pill.textContent = text;
  pill.className = 'shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ' + ({
    ok: 'bg-emerald-50 text-emerald-700',
    error: 'bg-red-50 text-red-600',
    busy: 'bg-blue-50 text-blue-600',
    muted: 'bg-slate-100 text-slate-500'
  }[tone] || 'bg-slate-100 text-slate-500');
}

// Tampilkan kolom sesuai pilihan suara & perbarui label status kartu Suara
function updateVoiceFields() {
  const ttsProvider = ttsProviderSelect ? ttsProviderSelect.value : TTSProvider.BROWSER;
  if (kokoroUrlContainer) kokoroUrlContainer.classList.toggle('hidden', ttsProvider !== TTSProvider.KOKORO_HOMELAB);
  if (ttsServerContainer) ttsServerContainer.classList.toggle('hidden', ttsProvider !== TTSProvider.SERVER);

  const labels = { browser: 'Mic browser', server: 'Mic server', keyboard: 'Mic keyboard' };
  const mode = getSttMode();
  const ready = getSttServerConfig().ready;
  setPill(voiceStatusPill, labels[mode] || 'Suara', mode === 'server' ? (ready ? 'ok' : 'error') : 'muted');
}

// ---------------------------------------------------------------------------
// Pemilih model: daftar diambil dari {host}/v1/models
// ---------------------------------------------------------------------------
const OLD_DEFAULT_MODEL = 'deepseek/deepseek-chat';
const MANUAL_MODEL = '__manual__';
const NON_CHAT_MODEL = /whisper|transcri|tts|speech|embed|rerank|moderation|dall-e|image/i;
let modelLoadSeq = 0;

function setModelStatus(text, tone = 'muted') {
  if (!modelStatus) return;
  modelStatus.textContent = text;
  modelStatus.classList.remove('text-slate-500', 'text-red-600', 'text-emerald-600');
  modelStatus.classList.add(tone === 'error' ? 'text-red-600' : tone === 'ok' ? 'text-emerald-600' : 'text-slate-500');
  if (text.startsWith('⏳')) {
    setPill(aiStatusPill, 'Memeriksa...', 'busy');
  } else if (tone === 'ok') {
    setPill(aiStatusPill, 'Terhubung', 'ok');
  } else if (tone === 'error') {
    setPill(aiStatusPill, 'Bermasalah', 'error');
  } else {
    setPill(aiStatusPill, 'Belum diatur', 'muted');
  }
}

function showManualModelInput(show) {
  if (modelSelect) modelSelect.classList.toggle('hidden', !show);
}

function fillModelPicker(models, selected) {
  if (!modelPicker) return;
  modelPicker.innerHTML = '';

  // Kelompokkan berdasarkan prefix provider 9Router, mis. "cc/", "gh/", "openrouter/"
  const groups = new Map();
  models.forEach((id) => {
    const prefix = id.includes('/') ? id.split('/')[0] : 'Lainnya';
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(id);
  });

  groups.forEach((ids, prefix) => {
    const group = document.createElement('optgroup');
    group.label = prefix;
    ids.forEach((id) => group.appendChild(new Option(id, id)));
    modelPicker.appendChild(group);
  });

  modelPicker.appendChild(new Option('✏️ Ketik nama model manual...', MANUAL_MODEL));
  modelPicker.value = selected;
}

async function loadModelOptions() {
  if (!modelPicker) return;
  const host = apiHostInput ? apiHostInput.value.trim() : '';
  const key = apiKeyInput ? apiKeyInput.value.trim() : '';
  const current = modelSelect ? modelSelect.value.trim() : '';

  if (!host || !key) {
    modelPicker.innerHTML = '';
    modelPicker.appendChild(new Option(current ? `${current} (isi host & key untuk memuat daftar)` : 'Isi API Host & API Key dulu', current));
    showManualModelInput(false);
    setModelStatus('Daftar model diambil otomatis dari server setelah host & API key diisi.');
    return;
  }

  const seq = ++modelLoadSeq;
  setModelStatus('⏳ Memuat daftar model dari server...');
  if (refreshModelsBtn) refreshModelsBtn.disabled = true;

  try {
    const models = await listModels(host, key);
    if (seq !== modelLoadSeq) return;

    if (models.length === 0) throw new Error('Server tidak mengembalikan model apa pun.');

    const chatModels = models.filter((id) => !NON_CHAT_MODEL.test(id));
    const pickable = chatModels.length ? chatModels : models;
    let selected = current;
    let note = '';

    if (!pickable.includes(current)) {
      if (!current || current === OLD_DEFAULT_MODEL) {
        selected = pickable[0];
        note = ` Model otomatis dipilih: ${selected}.`;
      } else {
        selected = MANUAL_MODEL;
        note = ` ⚠️ Model "${current}" tidak ada di daftar server.`;
      }
    }

    fillModelPicker(pickable, selected);
    if (selected !== MANUAL_MODEL && modelSelect) {
      modelSelect.value = selected;
      persistSettings();
    }
    showManualModelInput(selected === MANUAL_MODEL);
    setModelStatus(`✅ ${pickable.length} model tersedia.${note}`, note.includes('⚠️') ? 'error' : 'ok');

  } catch (err) {
    if (seq !== modelLoadSeq) return;
    console.error('Gagal memuat model:', err);
    modelPicker.innerHTML = '';
    modelPicker.appendChild(new Option('Gagal memuat daftar — ketik manual', MANUAL_MODEL));
    showManualModelInput(true);
    setModelStatus(`❌ ${err.message}`, 'error');
  } finally {
    if (seq === modelLoadSeq && refreshModelsBtn) refreshModelsBtn.disabled = false;
  }
}

// Cek server STT & isi saran model transkripsi dari {sttHost}/v1/models
let sttLoadSeq = 0;
async function loadSttModelOptions() {
  if (!sttStatus) return;
  const { host, key } = getSttServerConfig();
  const setStatus = (text, tone) => {
    sttStatus.textContent = text;
    sttStatus.classList.remove('text-slate-500', 'text-red-600', 'text-emerald-600');
    sttStatus.classList.add(tone === 'error' ? 'text-red-600' : tone === 'ok' ? 'text-emerald-600' : 'text-slate-500');
    updateVoiceFields();
  };

  if (!host || !key) {
    setStatus(host || key ? 'Isi STT Host dan STT API Key. Kalau kosong, mikrofon memakai dikte keyboard HP.' : 'Kosong = mikrofon memakai dikte keyboard HP. Gratis: daftar di console.groq.com, host https://api.groq.com/openai.', 'muted');
    return;
  }

  const seq = ++sttLoadSeq;
  setStatus('⏳ Memeriksa server STT...', 'muted');
  try {
    const models = await listModels(host, key);
    if (seq !== sttLoadSeq) return;
    const sttModels = models.filter((id) => /whisper|transcri|stt/i.test(id));
    const ttsModels = models.filter((id) => /tts|orpheus|playai|speech/i.test(id) && !/whisper|transcri/i.test(id));
    const ttsList = document.getElementById('ttsModelOptions');
    if (ttsList) ttsList.innerHTML = ttsModels.map((id) => `<option value="${id}"></option>`).join('');
    const list = document.getElementById('sttModelOptions');
    if (list) list.innerHTML = sttModels.map((id) => `<option value="${id}"></option>`).join('');

    if (sttModels.length === 0) {
      setStatus('⚠️ Server terhubung, tapi tidak ada model speech-to-text (whisper). Pakai Groq/OpenAI.', 'error');
      return;
    }
    if (sttModelInput && !sttModelInput.value.trim()) {
      sttModelInput.value = sttModels.find((id) => id === 'whisper-large-v3') || sttModels[0];
      persistSettings();
    }
    setStatus(`✅ Server STT siap. Model: ${getSttServerConfig().model}`, 'ok');
  } catch (err) {
    if (seq !== sttLoadSeq) return;
    setStatus(`❌ ${err.message}`, 'error');
  }
}

// Banner / Notifikasi status Online/Offline
function initOnlineStatusListener() {
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

function updateOnlineStatus() {
  if (!offlineBanner) return;
  if (navigator.onLine) {
    offlineBanner.classList.add('hidden');
  } else {
    offlineBanner.classList.remove('hidden');
  }
}

// 1. Web Speech API (STT - Speech to Text) dengan bahasa id-ID
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  // Tanpa Web Speech API, mikrofon tetap bisa dipakai lewat STT server (Whisper).
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = getLanguage(sourceLang).speech;
  // Safari iOS sering tidak pernah mengirim hasil final; pakai hasil sementara
  // dan hentikan sendiri setelah pengguna diam sebentar.
  recognition.continuous = true;
  recognition.interimResults = true;

  let latestTranscript = '';
  let handled = false;
  let silenceTimer = null;
  let noSpeechTimer = null;

  const clearTimers = () => {
    clearTimeout(silenceTimer);
    clearTimeout(noSpeechTimer);
  };

  recognition.onstart = () => {
    latestTranscript = '';
    handled = false;
    clearTimers();
    noSpeechTimer = setTimeout(() => recognition.stop(), 8000);
    startRecordingUI('Mendengarkan... Bicara sekarang, berhenti otomatis saat Anda diam');
  };

  recognition.onresult = (event) => {
    latestTranscript = Array.from(event.results).map((r) => r[0].transcript).join(' ').trim();
    clearTimers();
    silenceTimer = setTimeout(() => recognition.stop(), 1500);
    if (currentMicSource === 'voice' && micStatus && latestTranscript) {
      micStatus.textContent = `🎙️ "${latestTranscript}"`;
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    clearTimers();
    if (event.error === 'aborted') return;
    if (event.error === 'no-speech' && latestTranscript) return; // onend akan memproses

    handled = true;
    stopRecordingUI();

    // iOS menolak Web Speech di luar Safari / di aplikasi terpasang.
    // Mode otomatis langsung beralih ke perekaman server.
    if (event.error === 'service-not-allowed' && getSttProvider() !== 'browser') {
      browserSttBlocked = true;
      if (getSttServerConfig().ready) {
        startServerRecording();
      } else {
        startKeyboardDictation();
      }
      return;
    }

    showSttError(describeSpeechError(event.error));
  };

  recognition.onend = () => {
    clearTimers();
    if (mediaRecorder) return;
    if (handled) {
      stopRecordingUI();
      return;
    }
    handled = true;
    if (latestTranscript) {
      handleTranscript(latestTranscript);
    } else {
      stopRecordingUI();
      showSttError(describeSpeechError('no-speech'));
    }
  };
}

// Pastikan host & key sudah diisi; kalau belum, buka Pengaturan.
function ensureApiConfig(apiKey, apiHost) {
  if (!apiHost) {
    showToast('Isi API Host dulu di Pengaturan.');
    openSettingsModal();
    return false;
  }
  if (!apiKey) {
    showToast('Isi API Key dulu di Pengaturan.');
    openSettingsModal();
    return false;
  }
  if (!modelSelect || !modelSelect.value.trim()) {
    showToast('Pilih model AI dulu di Pengaturan.');
    openSettingsModal();
    return false;
  }
  return true;
}

function getSttProvider() {
  return (sttProviderSelect && sttProviderSelect.value) || localStorage.getItem('verba_stt_provider') || 'auto';
}

function isIOSDevice() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Web Speech di iOS hanya diizinkan di Safari biasa (bukan Chrome/Firefox iOS, bukan PWA terpasang).
function isWebSpeechLikelyBlocked() {
  return isIOSDevice() && (isStandalone() || /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent));
}

function getSttServerConfig() {
  const host = ((sttHostInput ? sttHostInput.value : localStorage.getItem('verba_stt_host')) || '').trim();
  const key = ((sttKeyInput ? sttKeyInput.value : localStorage.getItem('verba_stt_key')) || '').trim();
  const typedModel = ((sttModelInput ? sttModelInput.value : localStorage.getItem('verba_stt_model')) || '').trim();
  const model = typedModel || (/groq\.com/i.test(host) ? 'whisper-large-v3' : DEFAULT_STT_MODEL);
  return { host, key, model, ready: Boolean(host && key) };
}

// Tentukan cara menangkap suara: 'browser' | 'server' | 'keyboard'
function getSttMode() {
  const provider = getSttProvider();
  if (provider === 'keyboard') return 'keyboard';
  if (provider === 'server') return 'server';
  if (provider === 'browser') return recognition ? 'browser' : 'keyboard';
  if (recognition && !browserSttBlocked && !isWebSpeechLikelyBlocked()) return 'browser';
  return getSttServerConfig().ready ? 'server' : 'keyboard';
}

// Tanpa server STT: buka keyboard supaya pengguna bisa pakai tombol 🎤 dikte bawaan HP.
function startKeyboardDictation() {
  const target = currentMicSource === 'chat' ? chatInputText : textInput;
  const message = '⌨️ Ketuk 🎤 di keyboard HP, bicara, lalu tekan Kirim.';
  if (target) {
    target.focus();
    target.classList.add('ring-4', 'ring-blue-500/30', 'border-blue-500');
    setTimeout(() => target.classList.remove('ring-4', 'ring-blue-500/30', 'border-blue-500'), 4000);
  }
  if (currentMicSource === 'voice' && micStatus) {
    micStatus.textContent = message;
  } else {
    showToast(message);
  }
}

function describeSpeechError(code) {
  switch (code) {
    case 'service-not-allowed':
      return 'Browser ini tidak mengizinkan pengenalan suara. Isi server STT di Pengaturan, atau pakai tombol 🎤 di keyboard.';
    case 'not-allowed':
      return 'Izin mikrofon ditolak. Aktifkan izin mikrofon untuk situs ini di pengaturan browser.';
    case 'no-speech':
      return 'Tidak ada suara terdengar. Coba lagi dan bicara lebih dekat ke mikrofon.';
    case 'audio-capture':
      return 'Mikrofon tidak ditemukan atau sedang dipakai aplikasi lain.';
    case 'network':
      return 'Pengenalan suara butuh koneksi internet. Periksa jaringan Anda.';
    default:
      return `Gagal merekam: ${code}`;
  }
}

function showSttError(message) {
  if (currentMicSource === 'voice' && micStatus) {
    micStatus.textContent = message;
  } else {
    showToast(message);
  }
}

function handleTranscript(transcript) {
  stopRecordingUI();
  const text = (transcript || '').trim();
  if (!text) {
    showSttError('Tidak ada suara yang dikenali. Coba lagi.');
    return;
  }

  if (currentMicSource === 'chat') {
    if (chatInputText) chatInputText.value = text;
    // Auto-send pesan chat setelah perekaman selesai
    handleSendChatMessage();
  } else {
    if (textInput) textInput.value = text;
    if (micStatus) micStatus.textContent = 'Suara berhasil ditangkap!';
    // Auto-submit koreksi terjemahan setelah perekaman selesai
    handleTranslate(text);
  }
}

function toggleRecording(source = 'voice') {
  if (isRecording) {
    if (mediaRecorder) {
      mediaRecorder.stop();
    } else if (recognition) {
      recognition.stop();
    }
    return;
  }

  currentMicSource = source;
  if (recognition) recognition.lang = getLanguage(sourceLang).speech;

  const mode = getSttMode();
  if (mode === 'keyboard') {
    startKeyboardDictation();
    return;
  }
  if (mode === 'server') {
    startServerRecording();
    return;
  }

  try {
    recognition.start();
  } catch (err) {
    console.warn('Recognition already active:', err);
  }
}

// Rekam audio dengan MediaRecorder lalu transkripsi via /v1/audio/transcriptions
async function startServerRecording() {
  const { host: sttHost, key: sttKey, model: sttModel, ready } = getSttServerConfig();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    startKeyboardDictation();
    return;
  }

  if (!ready) {
    showToast('Isi STT API Host & STT API Key dulu di Pengaturan.');
    openSettingsModal();
    return;
  }

  // AudioContext dibuat sebelum await supaya iOS menganggapnya bagian dari ketukan pengguna.
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error('getUserMedia error:', err);
    if (audioCtx) audioCtx.close().catch(() => {});
    showSttError(describeSpeechError(err.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture'));
    return;
  }

  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
    .find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const maxDuration = setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop();
  }, 30000);

  // Deteksi diam: berhenti otomatis ~1,5 detik setelah pengguna selesai bicara.
  // Kalau AudioContext tidak bisa jalan, pengguna tetap bisa ketuk tombol untuk kirim.
  let levelTimer = null;
  let noSpeech = false;
  if (audioCtx) {
    try {
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const startedAt = Date.now();
      let heardSpeech = false;
      let lastLoudAt = Date.now();

      levelTimer = setInterval(() => {
        if (audioCtx.state !== 'running' || recorder.state !== 'recording') return;
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        const now = Date.now();

        if (rms > 0.02) {
          heardSpeech = true;
          lastLoudAt = now;
        }
        if (heardSpeech && now - lastLoudAt > 1500) {
          recorder.stop();
        } else if (!heardSpeech && now - startedAt > 8000) {
          noSpeech = true;
          recorder.stop();
        }
      }, 100);
    } catch (err) {
      console.warn('Deteksi diam tidak tersedia:', err);
    }
  }

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = async () => {
    clearTimeout(maxDuration);
    clearInterval(levelTimer);
    if (audioCtx) audioCtx.close().catch(() => {});
    stream.getTracks().forEach((track) => track.stop());
    mediaRecorder = null;
    stopRecordingUI();

    if (noSpeech) {
      showSttError(describeSpeechError('no-speech'));
      return;
    }

    const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
    if (blob.size < 1000) {
      showSttError('Rekaman terlalu pendek. Tekan mikrofon lalu bicara.');
      return;
    }

    if (currentMicSource === 'voice' && micStatus) {
      micStatus.textContent = '⏳ Mengubah suara jadi teks...';
    } else {
      showToast('⏳ Mengubah suara jadi teks...');
    }
    try {
      const text = await transcribeAudio(blob, sttKey, { host: sttHost, model: sttModel, language: getLanguage(sourceLang).stt });
      handleTranscript(text);
    } catch (err) {
      console.error('Transcription error:', err);
      showSttError(`Transkripsi gagal (${err.message}). Cek STT Host/Key/model "${sttModel}", atau pakai tombol 🎤 di keyboard.`);
    }
  };

  mediaRecorder = recorder;
  recorder.start();
  startRecordingUI('Merekam... Bicara sekarang. Berhenti otomatis saat Anda diam, atau ketuk KIRIM.');
}

function setMicButtonLabel(text) {
  const label = micBtn && micBtn.querySelector('span');
  if (label) label.textContent = text;
}

function startRecordingUI(statusText) {
  isRecording = true;
  if (currentMicSource === 'chat') {
    if (chatMicBtn) {
      chatMicBtn.classList.add('bg-red-600', 'text-white', 'recording-glow');
      chatMicBtn.classList.remove('bg-white', 'text-slate-700');
    }
    if (chatInputText) chatInputText.placeholder = 'Mendengarkan ucapan Anda...';
  } else {
    if (micBtn) micBtn.classList.add('recording-glow');
    setMicButtonLabel('KIRIM');
    if (waveVisualizer) {
      waveVisualizer.classList.remove('hidden');
      waveVisualizer.classList.add('flex');
    }
    if (micStatus) micStatus.textContent = statusText;
  }
}

function stopRecordingUI() {
  const wasRecording = isRecording;
  isRecording = false;
  if (micBtn) micBtn.classList.remove('recording-glow');
  setMicButtonLabel('REKAM');
  if (waveVisualizer) {
    waveVisualizer.classList.add('hidden');
    waveVisualizer.classList.remove('flex');
  }
  if (wasRecording && micStatus && /^(Mendengarkan|Merekam)\.\.\./.test(micStatus.textContent)) {
    micStatus.textContent = 'Ketuk untuk bicara';
  }

  if (chatMicBtn) {
    chatMicBtn.classList.remove('bg-red-600', 'text-white', 'recording-glow');
    chatMicBtn.classList.add('bg-white', 'text-slate-700');
  }
  if (chatInputText && chatInputText.placeholder === 'Mendengarkan ucapan Anda...') {
    chatInputText.placeholder = 'Ketik atau ucapkan pesan...';
  }
}

// 2. Translaasi & Integrasi Backend API
async function handleTranslate(inputOverride) {
  const text = (inputOverride || textInput.value).trim();
  const apiKey = (apiKeyInput ? apiKeyInput.value : localStorage.getItem('9router_api_key') || '').trim();
  const apiHost = (apiHostInput ? apiHostInput.value : localStorage.getItem('9router_api_host') || '').trim();
  const selectedModel = (modelSelect && modelSelect.value.trim()) || '';

  if (!text) {
    showToast(`Masukkan kalimat Bahasa ${getLanguage(sourceLang).label} terlebih dahulu.`);
    return;
  }

  if (!ensureApiConfig(apiKey, apiHost)) return;

  // Simpan Pengaturan API Key & Model & Host
  localStorage.setItem('9router_api_key', apiKey);
  localStorage.setItem('9router_api_host', apiHost);
  if (modelSelect) localStorage.setItem('9router_model', selectedModel);

  // Tampilkan UI Loading State
  showLoading(true);

  try {
    // Panggil Layanan Backend AI (9router API)
    const result = await processIndonesianToEnglish(text, apiKey, {
      model: selectedModel,
      sourceLang,
      targetLang,
      endpoint: apiHost
    });

    currentResult = result;
    renderUI(result);

    // Simpan ke Riwayat Belajar (HistoryManager)
    if (result.english_text && !result.english_text.includes('Gagal')) {
      HistoryManager.saveItem(result);
      renderHistoryList();
    }

    // 3. Auto Output Suara TTS (en-US)
    if (result.english_text && !result.english_text.includes('Gagal')) {
      playTTS(result.english_text, { auto: true });
    }

  } catch (err) {
    console.error('Translation error:', err);
    showToast('Terjadi kesalahan saat memproses data.');
  } finally {
    showLoading(false);
  }
}

// 4. Render UI Hasil Terjemahan
function renderUI(data) {
  indonesianOutput.textContent = data.indonesian_input || '-';
  englishOutput.textContent = data.english_text || '-';
  explanationOutput.innerHTML = formatExplanation(data.explanation || '');

  resultCard.classList.remove('hidden');
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function formatExplanation(text) {
  if (!text) return '<p class="text-[14px] text-slate-500">Tidak ada penjelasan grammar.</p>';

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const items = lines.map((line) => {
    const clean = line.replace(/^(?:[•\-\*]|\d+[.)])\s*/, '');
    // Tebalkan **teks** dan sorot `kata`/"kata" bahasa Inggris setelah di-escape
    const html = escapeHTML(clean)
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/`([^`]+)`/g, '<span class="font-semibold text-blue-700 bg-blue-50 rounded px-1">$1</span>')
      .replace(/&quot;([^&]{1,60}?)&quot;/g, '<span class="font-semibold text-blue-700 bg-blue-50 rounded px-1">$1</span>');
    return html;
  });

  if (items.length === 1) {
    return `<p class="text-[14px] leading-relaxed text-slate-700">${items[0]}</p>`;
  }

  return `<ol class="space-y-3">${items.map((html, i) => `
    <li class="flex gap-3">
      <span class="w-6 h-6 shrink-0 rounded-full bg-amber-100 text-amber-700 text-[12px] font-bold flex items-center justify-center">${i + 1}</span>
      <span class="flex-1 text-[14px] leading-relaxed text-slate-700">${html}</span>
    </li>`).join('')}</ol>`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Format waktu timestamp menjadi teks tanggal ramah pengguna
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 5. Pemutar Suara TTS (Browser vs Homelab Kokoro)
// auto: pembacaan otomatis setelah jawaban; kegagalannya tidak perlu ditampilkan
async function playTTS(text, { auto = false } = {}) {
  const targetText = text || (currentResult ? currentResult.english_text : '');
  if (!targetText) return;

  const buttons = [speakBtn, testVoiceBtn].filter(Boolean);
  buttons.forEach((btn) => { btn.disabled = true; btn.classList.add('opacity-75'); });

  try {
    const { host, key } = getSttServerConfig();
    const result = await synthesizeTTS(targetText, { ...getTTSConfig(), lang: getLanguage(targetLang).speech, serverHost: host, serverKey: key });
    if (result && result.fallbackError && !auto) {
      showToast(`Suara server gagal, pakai suara HP. (${result.fallbackError})`);
    }
  } catch (err) {
    console.error('TTS Playback Error:', err);
    if (!auto) showToast(`🔇 ${err.message || 'Gagal memutar suara.'} Cek mode senyap & volume HP.`);
  } finally {
    buttons.forEach((btn) => { btn.disabled = false; btn.classList.remove('opacity-75'); });
  }
}

// Fitur Salin Teks (Clipboard)
async function copyToClipboard(text) {
  const targetText = text || (currentResult ? currentResult.english_text : englishOutput.textContent);
  if (!targetText) return;

  try {
    await navigator.clipboard.writeText(targetText);
    showToast('📋 Teks berhasil disalin!');
  } catch (err) {
    const tempInput = document.createElement('textarea');
    tempInput.value = targetText;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('📋 Teks berhasil disalin!');
  }
}

// 6. Pengelolaan Drawer & Daftar Riwayat Belajar (History)
function renderHistoryList() {
  const history = HistoryManager.getHistory();

  // Update Badge Riwayat di Header & Bottom Navigation Bar & Dashboard
  const historyCount = history.length;
  if (homeTotalCount) homeTotalCount.textContent = historyCount;
  const homeStreak = document.getElementById('homeStreak');
  const homeVocabCount = document.getElementById('homeVocabCount');
  if (homeStreak) homeStreak.textContent = VocabManager.getStreak();
  if (homeVocabCount) homeVocabCount.textContent = VocabManager.countLearned();
  if (dashTotalSentences) dashTotalSentences.textContent = historyCount;
  if (dashHistoryCount) dashHistoryCount.textContent = historyCount;
  if (dashVocabLearned) dashVocabLearned.textContent = VocabManager.countLearned();
  if (dashStreak) dashStreak.textContent = VocabManager.getStreak();

  [historyBadge, navHistoryBadge].forEach(badge => {
    if (badge) {
      if (historyCount > 0) {
        badge.textContent = historyCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  });

  // Render both Drawer List and Embedded Dashboard List
  renderListContainer(historyList, history, true);
  renderListContainer(dashHistoryList, history, false);
}

function renderListContainer(containerEl, history, isDrawer = false) {
  if (!containerEl) return;

  // Jika riwayat kosong
  if (history.length === 0) {
    containerEl.innerHTML = `
      <div class="text-center py-10 space-y-1.5 border border-dashed border-slate-200 rounded-2xl">
        <div class="text-2xl">🗒️</div>
        <p class="text-[13px] font-bold text-slate-700">Belum ada riwayat</p>
        <p class="text-[12px] text-slate-500">Hasil koreksi akan tersimpan di sini.</p>
      </div>`;
    return;
  }

  // Render Item Riwayat (kartu ringkas)
  containerEl.innerHTML = history.map(item => `
    <div class="history-item bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-blue-300 transition cursor-pointer" data-id="${item.id}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <p class="text-[14px] font-bold text-slate-900 leading-snug">${escapeHTML(item.english_text)}</p>
          <p class="mt-0.5 text-[12px] text-slate-500 truncate">${escapeHTML(item.indonesian_input)}</p>
        </div>
        <span class="text-[10px] text-slate-400 font-semibold shrink-0 pt-0.5">${formatTimestamp(item.timestamp)}</span>
      </div>
      <div class="flex items-center gap-1.5 mt-2.5">
        <button class="play-hist-btn w-9 h-9 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition active:scale-95" title="Dengarkan" aria-label="Dengarkan">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.5.86l11.14-6.86a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z"/></svg>
        </button>
        <button class="copy-hist-btn w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition active:scale-95" title="Salin" aria-label="Salin">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M5 15V6a2 2 0 012-2h9"/></svg>
        </button>
        <button class="delete-hist-btn w-9 h-9 ml-auto rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition active:scale-95" title="Hapus" aria-label="Hapus">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  // Attach Event Listeners ke setiap Card Riwayat
  const cards = containerEl.querySelectorAll('.history-item');
  cards.forEach(card => {
    const id = card.getAttribute('data-id');
    const item = history.find(h => h.id === id);
    if (!item) return;

    // Klik Card -> Muat ke tampilan utama & tutup drawer
    card.addEventListener('click', () => {
      currentResult = item;
      setActiveTab('voice');
      renderUI(item);
      if (isDrawer) closeHistoryDrawer();
      showToast('📜 Riwayat dimuat ke tampilan utama.');
    });

    // Tombol Putar Suara
    const playBtnEl = card.querySelector('.play-hist-btn');
    if (playBtnEl) {
      playBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        playTTS(item.english_text);
      });
    }

    // Tombol Copy Teks
    const copyBtnEl = card.querySelector('.copy-hist-btn');
    if (copyBtnEl) {
      copyBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.english_text);
      });
    }

    // Tombol Hapus Item
    const deleteBtnEl = card.querySelector('.delete-hist-btn');
    if (deleteBtnEl) {
      deleteBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        HistoryManager.deleteItem(item.id);
        renderHistoryList();
        showToast('🗑️ Item riwayat dihapus.');
      });
    }
  });
}

// ============================================================================
// 6. FITUR CHAT AI PRACTICE CONVERSATION (Tersimpan di LocalStorage)
// ============================================================================

/**
 * Memuat riwayat pesan percakapan chat tersimpan dari localStorage
 */
function loadSavedChatHistory() {
  const savedHistory = ChatHistoryManager.getChatHistory();
  if (!savedHistory || savedHistory.length === 0) return;

  chatMessages = [];
  savedHistory.forEach(item => {
    if (item.role === 'user') {
      chatMessages.push({ role: 'user', content: item.content });
      appendUserMessageUI(item.content, item.timestamp);
    } else if (item.role === 'assistant') {
      chatMessages.push({ role: 'assistant', content: item.reply || item.content });
      appendAIMessageUI(item, item.timestamp);
    }
  });

  scrollChatToBottom();
}

/**
 * Mengirim pesan dari input chat ke 9router AI secara real-time
 */
async function handleSendChatMessage() {
  const text = (chatInputText ? chatInputText.value : '').trim();
  const apiKey = (apiKeyInput ? apiKeyInput.value : localStorage.getItem('9router_api_key') || '').trim();
  const apiHost = (apiHostInput ? apiHostInput.value : localStorage.getItem('9router_api_host') || '').trim();

  if (!text) {
    showToast('Tulis atau ucapkan pesan terlebih dahulu.');
    return;
  }

  if (!ensureApiConfig(apiKey, apiHost)) return;

  const timestamp = Date.now();

  // 1. Tampilkan pesan user di UI Chat List
  appendUserMessageUI(text, timestamp);

  // 2. Tambahkan pesan user ke array percakapan & simpan di localStorage
  chatMessages.push({ role: 'user', content: text });
  
  const savedHistory = ChatHistoryManager.getChatHistory();
  savedHistory.push({ id: 'chat_' + timestamp, role: 'user', content: text, timestamp });
  ChatHistoryManager.saveChatHistory(savedHistory);

  // Kosongkan kolom input chat
  if (chatInputText) chatInputText.value = '';

  // 3. Tampilkan Typing Indicator AI Tutor
  showChatTypingIndicator(true);
  scrollChatToBottom();

  try {
    // 4. Panggil Backend processChatConversation dari backend.js
    const selectedModel = (modelSelect && modelSelect.value.trim()) || '';
    const result = await processChatConversation(chatMessages, apiKey, { 
      model: selectedModel,
      sourceLang,
      targetLang,
      endpoint: apiHost
    });

    // 5. Sembunyikan Typing Indicator
    showChatTypingIndicator(false);

    // 6. Simpan balasan AI ke riwayat percakapan chat (memory & localStorage)
    if (result && result.reply) {
      chatMessages.push({ role: 'assistant', content: result.reply });
      
      const currentSaved = ChatHistoryManager.getChatHistory();
      currentSaved.push({
        id: 'chat_' + Date.now(),
        role: 'assistant',
        content: result.reply,
        reply: result.reply,
        correction: result.correction || '',
        translation: result.translation || '',
        timestamp: Date.now()
      });
      ChatHistoryManager.saveChatHistory(currentSaved);
    }

    // 7. Render balasan AI Tutor ke UI Chat
    appendAIMessageUI(result, Date.now());

    // 8. Auto Output Suara TTS (en-US)
    if (result && result.reply) {
      playTTS(result.reply, { auto: true });
    }

  } catch (err) {
    console.error('Chat error:', err);
    showChatTypingIndicator(false);
    showToast('Terjadi kesalahan saat memproses percakapan.');
  } finally {
    scrollChatToBottom();
  }
}

/**
 * Render gelembung pesan pengguna (User) di area percakapan chat dengan styling premium Light Mode
 */
function appendUserMessageUI(text, timestamp = Date.now()) {
  if (!chatMessageList) return;
  const userDiv = document.createElement('div');
  userDiv.className = 'flex flex-col items-end gap-1';
  userDiv.innerHTML = `
    <div class="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 text-white px-4 py-2.5 shadow-sm">
      <p class="text-[14px] leading-relaxed whitespace-pre-wrap">${escapeHTML(text)}</p>
    </div>
    <span class="text-[10px] text-slate-400 pr-1">${formatTimestamp(timestamp)}</span>
  `;
  chatMessageList.appendChild(userDiv);
}

/**
 * Render gelembung pesan AI Tutor (dengan Grammar Correction Card, Terjemahan & Action Buttons)
 */
function appendAIMessageUI(data, timestamp = Date.now()) {
  if (!chatMessageList) return;
  const aiDiv = document.createElement('div');
  aiDiv.className = 'flex flex-col items-start gap-1';

  const replyText = data.reply || data.content || 'No response generated.';
  const correctionText = data.correction || '';
  const translationText = data.translation || '';

  aiDiv.innerHTML = `
    <div class="max-w-[88%] rounded-2xl rounded-tl-md bg-white border border-slate-200 px-4 py-3 shadow-sm space-y-2.5">
      <p class="text-[15px] font-semibold text-slate-900 leading-relaxed">${escapeHTML(replyText)}</p>

      ${translationText ? `
      <button class="chat-translate-btn text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition">
        ${getLanguage(sourceLang).flag} Lihat terjemahan
      </button>
      <p class="chat-translation hidden text-[13px] text-slate-500 leading-relaxed">${escapeHTML(translationText)}</p>` : ''}

      ${correctionText ? `
      <div class="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
        <p class="text-[11px] font-bold text-amber-700 mb-0.5">✏️ Koreksi</p>
        <p class="text-[13px] text-amber-900 leading-relaxed">${escapeHTML(correctionText)}</p>
      </div>` : ''}

      <div class="flex items-center gap-1.5 pt-0.5">
        <button class="chat-speak-btn w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition active:scale-95" title="Dengarkan" aria-label="Dengarkan">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.5.86l11.14-6.86a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z"/></svg>
        </button>
        <button class="chat-copy-btn w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition active:scale-95" title="Salin" aria-label="Salin">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M5 15V6a2 2 0 012-2h9"/></svg>
        </button>
        <span class="ml-auto text-[10px] text-slate-400">${formatTimestamp(timestamp)}</span>
      </div>
    </div>
  `;

  const translateBtn = aiDiv.querySelector('.chat-translate-btn');
  const translationEl = aiDiv.querySelector('.chat-translation');
  if (translateBtn && translationEl) {
    translateBtn.addEventListener('click', () => {
      const hidden = translationEl.classList.toggle('hidden');
      translateBtn.textContent = `${getLanguage(sourceLang).flag} ${hidden ? 'Lihat' : 'Sembunyikan'} terjemahan`;
    });
  }

  // Listener untuk tombol Putar Suara & Copy pada gelembung AI ini
  const speakBtnEl = aiDiv.querySelector('.chat-speak-btn');
  if (speakBtnEl) speakBtnEl.addEventListener('click', () => playTTS(replyText));

  const copyBtnEl = aiDiv.querySelector('.chat-copy-btn');
  if (copyBtnEl) copyBtnEl.addEventListener('click', () => copyToClipboard(replyText));

  chatMessageList.appendChild(aiDiv);
}

/**
 * Tampilkan atau sembunyikan indikator mengetik AI pada percakapan chat
 */
function showChatTypingIndicator(show) {
  if (!chatTypingIndicator || !chatMessageList) return;
  if (show) {
    chatTypingIndicator.classList.remove('hidden');
    chatMessageList.appendChild(chatTypingIndicator);
  } else {
    chatTypingIndicator.classList.add('hidden');
  }
}

/**
 * Gulir otomatis percakapan chat ke paling bawah
 */
function scrollChatToBottom() {
  if (chatMessageList) {
    chatMessageList.scrollTop = chatMessageList.scrollHeight;
  }
}

/**
 * Bersihkan percakapan chat AI (Memory & LocalStorage)
 */
function clearChatMessages() {
  if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat percakapan chat?')) {
    chatMessages = [];
    ChatHistoryManager.clearChatHistory();
    if (chatMessageList) {
      chatMessageList.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0 text-xs font-extrabold mt-1">
            🤖
          </div>
          <div class="space-y-2 max-w-[85%] sm:max-w-[78%]">
            <div class="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm p-4 text-xs sm:text-sm text-slate-800 shadow-sm space-y-2">
              <p class="font-extrabold text-slate-900 text-sm">Hello! 👋 I'm your AI English Tutor.</p>
              <p class="text-slate-700 leading-relaxed font-medium">How are you feeling today? You can type or speak in English or Indonesian, and I will guide your conversation & grammar!</p>
              <div class="text-[11px] text-slate-500 pt-2 border-t border-slate-200 italic font-medium">
                🇮🇩 Halo! Saya Tutor AI Anda. Percakapan ini otomatis tersimpan di HP/Browser Anda. Ucapkan atau ketik apa saja!
              </div>
            </div>
          </div>
        </div>
      `;
    }
    showToast('🧹 Percakapan chat berhasil dibersihkan.');
  }
}

// Buka & Tutup Drawer History
function openHistoryDrawer() {
  if (!historyDrawer || !historyDrawerContent) return;
  historyDrawer.classList.remove('opacity-0', 'pointer-events-none');
  historyDrawerContent.classList.remove('translate-x-full');
  setActiveTab('riwayat');
}

function closeHistoryDrawer() {
  if (!historyDrawer || !historyDrawerContent) return;
  historyDrawerContent.classList.add('translate-x-full');
  setTimeout(() => {
    historyDrawer.classList.add('opacity-0', 'pointer-events-none');
  }, 200);
  setActiveTab(activeTab);
}

// Buka & Tutup Modal Pengaturan
function openSettingsModal() {
  if (!settingsModal || !settingsModalContent) return;
  loadSettings();
  loadModelOptions();
  loadSttModelOptions();
  settingsModal.classList.remove('opacity-0', 'pointer-events-none');
  settingsModalContent.classList.remove('scale-95');
  settingsModalContent.classList.add('scale-100');
  setActiveTab('pengaturan');
}

function closeSettingsModal() {
  if (!settingsModal || !settingsModalContent) return;
  settingsModalContent.classList.remove('scale-100');
  settingsModalContent.classList.add('scale-95');
  setTimeout(() => {
    settingsModal.classList.add('opacity-0', 'pointer-events-none');
  }, 200);
  setActiveTab(activeTab);
}

// Handler Indikator Aktif Bottom Navigation Bar & Switching Tab Mode
function setActiveTab(tabName) {
  if (['home', 'voice', 'chat', 'vocab', 'dashboard'].includes(tabName)) {
    activeTab = tabName;
    
    // Switch View Visibility
    if (homeView) homeView.classList.toggle('hidden', tabName !== 'home');
    if (voiceView) voiceView.classList.toggle('hidden', tabName !== 'voice');
    if (chatViewCard) chatViewCard.classList.toggle('hidden', tabName !== 'chat');
    if (vocabView) vocabView.classList.toggle('hidden', tabName !== 'vocab');
    if (dashboardView) dashboardView.classList.toggle('hidden', tabName !== 'dashboard');

    if (tabName === 'chat') scrollChatToBottom();
    if (tabName === 'vocab') renderVocab();
  }

  const tabs = [
    { name: 'home', btn: navHomeBtn },
    { name: 'voice', btn: navVoiceBtn },
    { name: 'chat', btn: navChatBtn },
    { name: 'vocab', btn: navVocabBtn },
    { name: 'dashboard', btn: navDashboardBtn }
  ];

  tabs.forEach(tab => {
    if (!tab.btn) return;
    const iconContainer = tab.btn.querySelector('div');
    const isSelected = (tab.name === tabName || (tab.name === activeTab && tabName === 'pengaturan'));

    if (isSelected) {
      tab.btn.className = `flex flex-col items-center justify-center gap-1 py-1 px-2.5 sm:px-5 rounded-2xl text-blue-600 font-extrabold transition active:scale-95 group min-h-[44px] relative`;
      if (iconContainer) iconContainer.className = `w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 transition shadow-sm shadow-blue-500/10`;
    } else {
      tab.btn.className = `flex flex-col items-center justify-center gap-1 py-1 px-2.5 sm:px-5 rounded-2xl text-slate-400 font-medium hover:text-slate-700 transition active:scale-95 group min-h-[44px] relative`;
      if (iconContainer) iconContainer.className = `w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-200 transition`;
    }
  });
}

// ---------------------------------------------------------------------------
// Kosakata harian
// ---------------------------------------------------------------------------
function langPair() {
  return `${sourceLang}-${targetLang}`;
}

function renderVocab() {
  const list = document.getElementById('vocabList');
  const progressText = document.getElementById('vocabProgressText');
  const progressBar = document.getElementById('vocabProgressBar');
  const streakEl = document.getElementById('vocabStreak');
  const generateBtn = document.getElementById('vocabGenerateBtn');
  if (!list) return;

  if (streakEl) streakEl.textContent = VocabManager.getStreak();

  document.querySelectorAll('.vocab-count-btn').forEach((btn) => {
    const active = Number(btn.dataset.vocabCount) === vocabCount;
    btn.classList.toggle('bg-white', active);
    btn.classList.toggle('text-blue-600', active);
    btn.classList.toggle('shadow-sm', active);
    btn.classList.toggle('text-slate-500', !active);
  });

  const words = VocabManager.getToday(langPair());
  if (!words || words.length === 0) {
    list.innerHTML = `
      <div class="bg-white border border-dashed border-slate-300 rounded-[2rem] p-8 text-center space-y-2">
        <div class="text-3xl">📚</div>
        <p class="text-sm font-bold text-slate-800">Belum ada kata untuk hari ini</p>
        <p class="text-[13px] text-slate-500">Ketuk tombol di atas, AI akan memilih ${vocabCount} kata ${getLanguage(targetLang).label} untuk dipelajari.</p>
      </div>`;
    if (progressText) progressText.textContent = 'Belum ada kata hari ini';
    if (progressBar) progressBar.style.width = '0%';
    if (generateBtn) generateBtn.textContent = `✨ Buat ${vocabCount} kata hari ini`;
    return;
  }

  const learnedCount = words.filter((w) => VocabManager.isLearned(langPair(), w.word)).length;
  if (progressText) progressText.textContent = `${learnedCount} dari ${words.length} kata dikuasai`;
  if (progressBar) progressBar.style.width = `${Math.round((learnedCount / words.length) * 100)}%`;
  if (generateBtn) generateBtn.textContent = '🔄 Ganti dengan kata lain';

  list.innerHTML = words.map((word, index) => {
    const learned = VocabManager.isLearned(langPair(), word.word);
    return `
    <div class="bg-white border ${learned ? 'border-emerald-200' : 'border-slate-200/80'} rounded-[2rem] p-4 shadow-sm space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="text-xl font-extrabold text-slate-900 leading-tight">${escapeHTML(word.word)}</p>
            ${word.reading ? `<span class="text-[12px] text-slate-500">${escapeHTML(word.reading)}</span>` : ''}
          </div>
          ${word.type ? `<span class="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 rounded-md px-1.5 py-0.5">${escapeHTML(word.type)}</span>` : ''}
        </div>
        <button data-vocab-play="${index}" class="w-10 h-10 shrink-0 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition active:scale-95" title="Dengarkan" aria-label="Dengarkan">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.5.86l11.14-6.86a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z"/></svg>
        </button>
      </div>

      <p class="text-[14px] text-slate-700">${escapeHTML(word.meaning)}</p>

      ${word.example ? `
      <div class="rounded-2xl bg-slate-50 border border-slate-100 p-3 space-y-1">
        <p class="text-[13px] font-semibold text-slate-800">${escapeHTML(word.example)}</p>
        ${word.example_translation ? `<p class="text-[12px] text-slate-500">${escapeHTML(word.example_translation)}</p>` : ''}
      </div>` : ''}

      <button data-vocab-learned="${index}" class="w-full py-2.5 rounded-2xl text-[13px] font-bold transition active:scale-[0.98] min-h-[44px] ${learned ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-900 text-white'}">
        ${learned ? '✓ Sudah hafal' : 'Tandai sudah hafal'}
      </button>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-vocab-play]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const word = words[Number(btn.dataset.vocabPlay)];
      playTTS(word.example || word.word);
    });
  });
  list.querySelectorAll('[data-vocab-learned]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const word = words[Number(btn.dataset.vocabLearned)];
      const nowLearned = VocabManager.toggleLearned(langPair(), word.word);
      renderVocab();
      renderHistoryList();
      if (nowLearned) showToast(`✓ "${word.word}" ditandai hafal`);
    });
  });
}

async function generateDailyVocab() {
  const apiKey = (apiKeyInput ? apiKeyInput.value : localStorage.getItem('9router_api_key') || '').trim();
  const apiHost = (apiHostInput ? apiHostInput.value : localStorage.getItem('9router_api_host') || '').trim();
  const model = (modelSelect && modelSelect.value.trim()) || '';
  if (!ensureApiConfig(apiKey, apiHost)) return;

  const generateBtn = document.getElementById('vocabGenerateBtn');
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ AI sedang memilih kata...';
  }

  try {
    const words = await generateVocabulary(apiKey, {
      endpoint: apiHost,
      model,
      sourceLang,
      targetLang,
      count: vocabCount,
      avoid: VocabManager.getLearned(langPair())
    });
    if (words.length === 0) throw new Error('AI tidak mengembalikan kata.');

    VocabManager.saveToday(langPair(), words);
    showToast(`📚 ${words.length} kata baru siap dipelajari`);
  } catch (err) {
    console.error('Gagal membuat kosakata:', err);
    showToast(`Gagal membuat kosakata: ${err.message}`);
  } finally {
    if (generateBtn) generateBtn.disabled = false;
    renderVocab();
  }
}

// UI State Helpers
function showLoading(isLoading) {
  if (isLoading) {
    loadingState.classList.remove('hidden');
    resultCard.classList.add('hidden');
    submitBtn.disabled = true;
  } else {
    loadingState.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

// PWA Service Worker Registration
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Saat service worker versi baru mengambil alih, muat ulang sekali agar
  // halaman langsung memakai file terbaru (bukan sisa cache lama).
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => reg.update())
      .catch(err => console.error('Gagal pendaftaran Service Worker:', err));
  });
}

// PWA Install (Android: prompt bawaan, iOS: petunjuk Add to Home Screen)
let deferredInstallPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallUI() {
  const installAppBtn = document.getElementById('installAppBtn');
  const installHint = document.getElementById('installHint');
  if (!installAppBtn || !installHint) return;

  const isIOS = isIOSDevice();

  installAppBtn.classList.toggle('hidden', !deferredInstallPrompt || isStandalone());

  if (isStandalone()) {
    installHint.textContent = '✅ VerbaAI sudah terpasang di perangkat ini.';
  } else if (deferredInstallPrompt) {
    installHint.textContent = 'Tekan tombol di atas untuk memasang VerbaAI seperti aplikasi biasa.';
  } else if (isIOS) {
    installHint.innerHTML = 'Di iPhone/iPad: tekan tombol <b>Share</b> (ikon kotak dengan panah ke atas) di Safari atau Chrome, lalu pilih <b>Add to Home Screen / Tambah ke Layar Utama</b>.';
  } else {
    installHint.innerHTML = 'Buka menu browser (⋮) lalu pilih <b>Install app / Tambahkan ke layar utama</b>.';
  }
}

function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallUI();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallUI();
    showToast('📲 VerbaAI berhasil dipasang!');
  });

  const installAppBtn = document.getElementById('installAppBtn');
  if (installAppBtn) {
    installAppBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      updateInstallUI();
    });
  }

  updateInstallUI();
}

// 7. Event Listeners Setup
function attachEventListeners() {
  // Mic & Submit Voice / Text Input (Mode Voice)
  if (micBtn) micBtn.addEventListener('click', () => toggleRecording('voice'));
  if (submitBtn) submitBtn.addEventListener('click', () => handleTranslate());
  if (textInput) {
    textInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleTranslate();
      }
    });
  }

  // Panel info "cara kerja" (Mode Voice)
  const voiceInfoBtn = document.getElementById('voiceInfoBtn');
  const voiceInfoPanel = document.getElementById('voiceInfoPanel');
  if (voiceInfoBtn && voiceInfoPanel) {
    voiceInfoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = voiceInfoPanel.classList.toggle('hidden') === false;
      voiceInfoBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!voiceInfoPanel.contains(e.target)) {
        voiceInfoPanel.classList.add('hidden');
        voiceInfoBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Chat AI Practice Event Listeners (Mode Chat)
  if (chatSendBtn) chatSendBtn.addEventListener('click', () => handleSendChatMessage());
  if (chatInputText) {
    chatInputText.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendChatMessage();
      }
    });
  }
  if (chatMicBtn) chatMicBtn.addEventListener('click', () => toggleRecording('chat'));
  if (clearChatBtn) clearChatBtn.addEventListener('click', () => clearChatMessages());

  // Chat Suggestion Chips Click Handler
  const chatSuggestChips = document.querySelectorAll('.chat-suggest-chip');
  chatSuggestChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.dataset.prompt || chip.textContent.trim();
      if (chatInputText) chatInputText.value = promptText;
      handleSendChatMessage();
    });
  });

  // Tombol lihat/sembunyikan untuk semua kolom API key
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    const input = document.getElementById(btn.dataset.togglePassword);
    if (!input) return;
    btn.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Tes suara: dipicu ketukan, jadi aman untuk kebijakan audio iOS
  if (testVoiceBtn) {
    testVoiceBtn.addEventListener('click', () => playTTS(getLanguage(targetLang).sample));
  }

  // Setiap isian pengaturan langsung disimpan saat diketik/diubah, jadi tidak
  // hilang walau modal ditutup tanpa menekan Simpan atau halaman dimuat ulang.
  [apiHostInput, apiKeyInput, modelSelect, sttHostInput, sttKeyInput, sttModelInput, kokoroUrlInput, ttsModelInput, ttsVoiceInput].forEach((el) => {
    if (el) el.addEventListener('input', persistSettings);
  });
  [sttProviderSelect, ttsProviderSelect].forEach((el) => {
    if (el) el.addEventListener('change', persistSettings);
  });

  // Muat ulang daftar model saat host/key berubah (dengan jeda) atau tombol ditekan
  let modelReloadTimer = null;
  [apiHostInput, apiKeyInput].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => {
      clearTimeout(modelReloadTimer);
      modelReloadTimer = setTimeout(loadModelOptions, 900);
    });
  });
  if (refreshModelsBtn) refreshModelsBtn.addEventListener('click', loadModelOptions);
  let sttReloadTimer = null;
  [sttHostInput, sttKeyInput].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => {
      clearTimeout(sttReloadTimer);
      sttReloadTimer = setTimeout(loadSttModelOptions, 900);
    });
  });
  if (modelPicker) {
    modelPicker.addEventListener('change', () => {
      if (modelPicker.value === MANUAL_MODEL) {
        showManualModelInput(true);
        if (modelSelect) modelSelect.focus();
        return;
      }
      showManualModelInput(false);
      if (modelSelect) modelSelect.value = modelPicker.value;
      persistSettings();
      setModelStatus(`✅ Model dipilih: ${modelPicker.value}`, 'ok');
    });
  }

  // Simpan Pengaturan (9router API Key + Host Endpoint + LLM Model + Provider TTS)
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
      persistSettings();

      if (!apiHostInput || !apiHostInput.value.trim()) {
        showToast('API Host wajib diisi (alamat server 9Router / API Anda).');
        return;
      }
      if (!apiKeyInput || !apiKeyInput.value.trim()) {
        showToast('API Key wajib diisi.');
        return;
      }

      showToast('✅ Pengaturan tersimpan');
      closeSettingsModal();
    });
  }

  // Tes Koneksi API: tampilkan error apa adanya supaya mudah didiagnosa
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const testConnectionResult = document.getElementById('testConnectionResult');
  if (testConnectionBtn && testConnectionResult) {
    testConnectionBtn.addEventListener('click', async () => {
      const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
      const apiHost = apiHostInput ? apiHostInput.value.trim() : '';
      const model = (modelSelect && modelSelect.value.trim()) || '';

      const report = (ok, message) => {
        testConnectionResult.textContent = message;
        testConnectionResult.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'bg-emerald-50', 'text-emerald-700', 'bg-slate-50', 'text-slate-600');
        testConnectionResult.classList.add(...(ok === null ? ['bg-slate-50', 'text-slate-600'] : ok ? ['bg-emerald-50', 'text-emerald-700'] : ['bg-red-50', 'text-red-700']));
      };

      if (!apiHost) {
        report(false, 'API Host masih kosong. Isi alamat server 9Router / API Anda, mis. https://9router.domainanda.com');
        return;
      }
      if (!apiKey) {
        report(false, 'API Key masih kosong.');
        return;
      }
      if (!model) {
        report(false, 'Model belum dipilih. Tekan "🔄 Muat model" lalu pilih salah satu.');
        return;
      }
      const endpoint = resolveChatEndpoint(apiHost);
      if (location.protocol === 'https:' && endpoint.startsWith('http:')) {
        report(false, `Host ${endpoint} memakai http://, browser memblokirnya karena aplikasi dibuka lewat https. Pakai host https://.`);
        return;
      }

      report(null, `Menghubungi ${endpoint} ...`);
      testConnectionBtn.disabled = true;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with: OK' }], max_tokens: 5 })
        });
        const body = await response.text();
        if (!response.ok) {
          report(false, `❌ ${endpoint} → HTTP ${response.status}: ${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}`);
          return;
        }
        let reply = '';
        try { reply = JSON.parse(body).choices?.[0]?.message?.content || ''; } catch (_) { /* bukan JSON */ }
        report(true, `✅ Terhubung ke ${endpoint} (model ${model}). Balasan: ${reply || body.slice(0, 80)}`);
      } catch (err) {
        report(false, `❌ Tidak bisa menghubungi ${endpoint}. Penyebab umum: domain salah/tidak bisa diakses dari HP, atau server API tidak mengizinkan CORS dari ${location.origin}. Detail: ${err.message}`);
      } finally {
        testConnectionBtn.disabled = false;
      }
    });
  }

  // Controls Result Card (🔊 Putar Ulang & 📋 Copy)
  if (speakBtn) speakBtn.addEventListener('click', () => playTTS());
  if (copyBtn) copyBtn.addEventListener('click', () => copyToClipboard());

  // Settings Modal Controls
  if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal);
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsModal);
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }

  // Home Launcher Cards & Widget Actions
  if (quickVoiceCard) quickVoiceCard.addEventListener('click', () => setActiveTab('voice'));
  if (quickChatCard) quickChatCard.addEventListener('click', () => setActiveTab('chat'));
  if (quickDashCard) quickDashCard.addEventListener('click', () => setActiveTab('dashboard'));
  if (homeSodSpeakBtn) {
    homeSodSpeakBtn.addEventListener('click', () => {
      const textToPlay = sodEnglish ? sodEnglish.textContent.replace(/^"|"$/g, '') : 'Consistency is the secret to mastering any new language.';
      playTTS(textToPlay);
    });
  }

  // Dashboard Clear All Button
  if (dashClearAllBtn) {
    dashClearAllBtn.addEventListener('click', () => {
      const history = HistoryManager.getHistory();
      if (history.length === 0) {
        showToast('Riwayat sudah kosong.');
        return;
      }
      if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat belajar?')) {
        HistoryManager.clearHistory();
        renderHistoryList();
        showToast('🗑️ Seluruh riwayat berhasil dihapus.');
      }
    });
  }

  // Bottom Navigation Bar Controls (Native Mobile App Style)
  if (navHomeBtn) {
    navHomeBtn.addEventListener('click', () => {
      setActiveTab('home');
      closeHistoryDrawer();
      closeSettingsModal();
    });
  }

  if (navVoiceBtn) {
    navVoiceBtn.addEventListener('click', () => {
      setActiveTab('voice');
      closeHistoryDrawer();
      closeSettingsModal();
    });
  }

  if (navChatBtn) {
    navChatBtn.addEventListener('click', () => {
      setActiveTab('chat');
      closeHistoryDrawer();
      closeSettingsModal();
    });
  }

  if (navDashboardBtn) {
    navDashboardBtn.addEventListener('click', () => {
      setActiveTab('dashboard');
      closeHistoryDrawer();
      closeSettingsModal();
    });
  }

  if (navVocabBtn) {
    navVocabBtn.addEventListener('click', () => {
      setActiveTab('vocab');
      closeHistoryDrawer();
      closeSettingsModal();
    });
  }

  // Kosakata harian
  const vocabGenerateBtn = document.getElementById('vocabGenerateBtn');
  if (vocabGenerateBtn) vocabGenerateBtn.addEventListener('click', () => generateDailyVocab());
  document.querySelectorAll('.vocab-count-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      vocabCount = Number(btn.dataset.vocabCount);
      localStorage.setItem('verba_vocab_count', String(vocabCount));
      renderVocab();
    });
  });

  // History Drawer Controls
  if (openHistoryBtn) openHistoryBtn.addEventListener('click', openHistoryDrawer);
  if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeHistoryDrawer);
  
  // Close History Drawer when clicking backdrop
  if (historyDrawer) {
    historyDrawer.addEventListener('click', (e) => {
      if (e.target === historyDrawer) {
        closeHistoryDrawer();
      }
    });
  }

  // Clear All History Button
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      const history = HistoryManager.getHistory();
      if (history.length === 0) {
        showToast('Riwayat sudah kosong.');
        return;
      }
      if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat belajar?')) {
        HistoryManager.clearHistory();
        renderHistoryList();
        showToast('🗑️ Seluruh riwayat berhasil dihapus.');
      }
    });
  }
}

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
  unlockAudioPlayback
} from './backend.js?v=__BUILD__';

// DOM Elements - View Containers
const homeView = document.getElementById('homeView');
const voiceView = document.getElementById('voiceView');
const chatViewCard = document.getElementById('chatViewCard');
const dashboardView = document.getElementById('dashboardView');

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
const dashVoiceInteractions = document.getElementById('dashVoiceInteractions');
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
const navPengaturanBtn = document.getElementById('navPengaturanBtn');
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
    // Default lama localhost tidak bisa dijangkau dari HP
    kokoroUrlInput.value = /localhost/.test(ttsConfig.kokoroUrl || '') ? '' : (ttsConfig.kokoroUrl || '');
  }
  if (ttsModelInput) ttsModelInput.value = ttsConfig.serverModel || '';
  if (ttsVoiceInput) ttsVoiceInput.value = ttsConfig.serverVoice || '';

  refreshSegmentedControls();
  updateVoiceFields();
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
  recognition.lang = 'id-ID'; // Bahasa Indonesia
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
      const text = await transcribeAudio(blob, sttKey, { host: sttHost, model: sttModel, language: 'id' });
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
    showToast('Masukkan kalimat Bahasa Indonesia terlebih dahulu.');
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
    const result = await synthesizeTTS(targetText, { ...getTTSConfig(), serverHost: host, serverKey: key });
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
    showToast('📋 Teks Bahasa Inggris berhasil disalin!');
  } catch (err) {
    const tempInput = document.createElement('textarea');
    tempInput.value = targetText;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('📋 Teks Bahasa Inggris berhasil disalin!');
  }
}

// 6. Pengelolaan Drawer & Daftar Riwayat Belajar (History)
function renderHistoryList() {
  const history = HistoryManager.getHistory();

  // Update Badge Riwayat di Header & Bottom Navigation Bar & Dashboard
  const historyCount = history.length;
  if (homeTotalCount) homeTotalCount.textContent = historyCount;
  if (dashTotalSentences) dashTotalSentences.textContent = historyCount;
  if (dashVoiceInteractions) dashVoiceInteractions.textContent = historyCount > 0 ? historyCount * 2 : 0;

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
      <div class="text-center py-10 space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
        <div class="inline-flex p-3 bg-slate-100 rounded-full text-slate-400 mb-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
        </div>
        <p class="text-slate-800 text-xs font-bold">Belum Ada Riwayat Belajar</p>
        <p class="text-slate-500 text-[11px]">Hasil terjemahan & koreksi AI akan tersimpan di sini.</p>
      </div>
    `;
    return;
  }

  // Render Item Riwayat (Light Modern Card Style)
  containerEl.innerHTML = history.map(item => `
    <div class="history-item bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 hover:border-blue-400 hover:bg-white transition cursor-pointer group shadow-sm" data-id="${item.id}">
      <div class="flex items-center justify-between text-[11px] text-slate-500">
        <span class="truncate max-w-[200px] font-semibold text-slate-700">🇮🇩 ${escapeHTML(item.indonesian_input)}</span>
        <span class="text-slate-400 text-[10px]">${formatTimestamp(item.timestamp)}</span>
      </div>
      <p class="text-xs font-bold text-blue-600 group-hover:text-blue-700 transition leading-snug">🇬🇧 ${escapeHTML(item.english_text)}</p>
      
      <div class="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200">
        <button class="play-hist-btn h-7 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition active:scale-95" title="Putar Suara">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 9 0 0118 0z"/></svg>
          <span class="hidden sm:inline">Putar</span>
        </button>
        <button class="copy-hist-btn h-7 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition active:scale-95" title="Salin Teks">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          <span class="hidden sm:inline">Salin</span>
        </button>
        <button class="delete-hist-btn h-7 px-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition active:scale-95" title="Hapus Riwayat">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          <span class="hidden sm:inline">Hapus</span>
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
  userDiv.className = 'flex items-start justify-end gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300';
  userDiv.innerHTML = `
    <div class="space-y-1 max-w-[85%] sm:max-w-[78%] text-right">
      <div class="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white rounded-2xl rounded-tr-sm p-4 text-xs sm:text-sm shadow-md shadow-blue-600/20 text-left border border-blue-400/30">
        <p class="leading-relaxed whitespace-pre-wrap font-medium">${escapeHTML(text)}</p>
      </div>
      <span class="text-[10px] text-slate-400 font-semibold pr-1">${formatTimestamp(timestamp)}</span>
    </div>
    <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0 text-xs font-extrabold mt-1">
      👤
    </div>
  `;
  chatMessageList.appendChild(userDiv);
}

/**
 * Render gelembung pesan AI Tutor (dengan Grammar Correction Card, Terjemahan & Action Buttons)
 */
function appendAIMessageUI(data, timestamp = Date.now()) {
  if (!chatMessageList) return;
  const aiDiv = document.createElement('div');
  aiDiv.className = 'flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300';

  const replyText = data.reply || data.content || 'No response generated.';
  const correctionText = data.correction || '';
  const translationText = data.translation || '';

  aiDiv.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0 text-xs font-extrabold mt-1">
      🤖
    </div>
    <div class="space-y-1.5 max-w-[85%] sm:max-w-[78%]">
      <div class="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm p-4 text-xs sm:text-sm text-slate-800 shadow-sm space-y-3">
        
        <!-- Reply Text (English Highlighted) -->
        <div class="space-y-1">
          <p class="font-extrabold text-slate-900 text-sm sm:text-base leading-relaxed tracking-tight">${escapeHTML(replyText)}</p>
        </div>
        
        <!-- Grammar Correction Box (if errors found) -->
        ${correctionText ? `
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs space-y-1 shadow-inner">
          <div class="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
            <span>✏️ Catatan Tata Bahasa (Grammar):</span>
          </div>
          <p class="leading-relaxed font-medium">${escapeHTML(correctionText)}</p>
        </div>` : ''}

        <!-- Translation Box -->
        ${translationText ? `
        <div class="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 italic">
          🇮🇩 ${escapeHTML(translationText)}
        </div>` : ''}

        <!-- Actions: Quick TTS Speaker & Copy -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-200">
          <span class="text-[10px] text-slate-400 font-semibold">${formatTimestamp(timestamp)}</span>
          <div class="flex items-center gap-1.5">
            <button class="chat-speak-btn px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition active:scale-95" title="Putar Suara English">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
              <span>Putar</span>
            </button>
            <button class="chat-copy-btn px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition active:scale-95" title="Salin Teks English">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              <span>Salin</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

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
  if (['home', 'voice', 'chat', 'dashboard'].includes(tabName)) {
    activeTab = tabName;
    
    // Switch View Visibility
    if (homeView) homeView.classList.toggle('hidden', tabName !== 'home');
    if (voiceView) voiceView.classList.toggle('hidden', tabName !== 'voice');
    if (chatViewCard) chatViewCard.classList.toggle('hidden', tabName !== 'chat');
    if (dashboardView) dashboardView.classList.toggle('hidden', tabName !== 'dashboard');

    if (tabName === 'chat') {
      scrollChatToBottom();
    }
  }

  const tabs = [
    { name: 'home', btn: navHomeBtn },
    { name: 'voice', btn: navVoiceBtn },
    { name: 'chat', btn: navChatBtn },
    { name: 'dashboard', btn: navDashboardBtn },
    { name: 'pengaturan', btn: navPengaturanBtn }
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
      const promptText = chip.textContent.trim().replace(/^"|"$/g, '');
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
    testVoiceBtn.addEventListener('click', () => playTTS('Hello! I am your VerbaAI English tutor. Let us practice together.'));
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

  if (navPengaturanBtn) {
    navPengaturanBtn.addEventListener('click', () => {
      closeHistoryDrawer();
      openSettingsModal();
    });
  }

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

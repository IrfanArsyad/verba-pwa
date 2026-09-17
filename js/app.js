import { 
  processIndonesianToEnglish, 
  processChatConversation,
  synthesizeTTS, 
  HistoryManager, 
  ChatHistoryManager,
  getTTSConfig, 
  saveTTSConfig, 
  TTSProvider,
  DEFAULT_API_HOST
} from './backend.js';

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
const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility');
const apiHostInput = document.getElementById('apiHostInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const modelSelect = document.getElementById('modelSelect');
const ttsProviderSelect = document.getElementById('ttsProviderSelect');
const kokoroUrlContainer = document.getElementById('kokoroUrlContainer');
const kokoroUrlInput = document.getElementById('kokoroUrlInput');

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
let recognition = null;
let currentResult = null;
let activeTab = 'home'; // 'home' | 'voice' | 'chat' | 'dashboard'
let chatMessages = []; // Array of { role: 'user'|'assistant', content: string }

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
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

  const savedHost = localStorage.getItem('9router_api_host') || DEFAULT_API_HOST;
  if (savedHost && apiHostInput) apiHostInput.value = savedHost;

  const savedModel = localStorage.getItem('9router_model') || 'deepseek/deepseek-chat';
  if (modelSelect) modelSelect.value = savedModel;

  // Load TTS Config (Browser vs Kokoro Homelab)
  const ttsConfig = getTTSConfig();
  if (ttsProviderSelect) {
    ttsProviderSelect.value = ttsConfig.provider || TTSProvider.BROWSER;
    toggleKokoroUrlVisibility(ttsConfig.provider);
  }
  if (kokoroUrlInput) {
    kokoroUrlInput.value = ttsConfig.kokoroUrl || 'http://localhost:8880/v1/audio/speech';
  }
}

// Toggle visibility input URL Kokoro Homelab berdasarkan provider TTS yang dipilih
function toggleKokoroUrlVisibility(provider) {
  if (!kokoroUrlContainer) return;
  if (provider === TTSProvider.KOKORO_HOMELAB) {
    kokoroUrlContainer.classList.remove('hidden');
  } else {
    kokoroUrlContainer.classList.add('hidden');
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

  if (!SpeechRecognition) {
    if (micStatus) micStatus.textContent = 'Speech Recognition tidak didukung di browser ini.';
    if (micBtn) {
      micBtn.disabled = true;
      micBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (chatMicBtn) {
      chatMicBtn.disabled = true;
      chatMicBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'id-ID'; // Bahasa Indonesia
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isRecording = true;
    if (currentMicSource === 'chat') {
      if (chatMicBtn) {
        chatMicBtn.classList.add('bg-red-600', 'text-white', 'recording-glow');
        chatMicBtn.classList.remove('bg-slate-800', 'text-slate-300');
      }
      if (chatInputText) chatInputText.placeholder = 'Mendengarkan ucapan Anda...';
    } else {
      if (micBtn) micBtn.classList.add('recording-glow');
      if (waveVisualizer) {
        waveVisualizer.classList.remove('hidden');
        waveVisualizer.classList.add('flex');
      }
      if (micStatus) micStatus.textContent = 'Mendengarkan... Bicara sekarang (Bahasa Indonesia)';
    }
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    
    if (currentMicSource === 'chat') {
      if (chatInputText) chatInputText.value = transcript;
      stopRecordingUI();
      // Auto-send pesan chat setelah perekaman selesai
      handleSendChatMessage();
    } else {
      if (textInput) textInput.value = transcript;
      if (micStatus) micStatus.textContent = 'Suara berhasil ditangkap!';
      stopRecordingUI();
      // Auto-submit koreksi terjemahan setelah perekaman selesai
      handleTranslate(transcript);
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (currentMicSource === 'voice' && micStatus) {
      micStatus.textContent = `Gagal merekam: ${event.error}`;
    } else {
      showToast(`Gagal merekam suara: ${event.error}`);
    }
    stopRecordingUI();
  };

  recognition.onend = () => {
    stopRecordingUI();
  };
}

function toggleRecording(source = 'voice') {
  if (!recognition) {
    showToast('Browser Anda tidak mendukung Web Speech API.');
    return;
  }

  if (isRecording) {
    recognition.stop();
  } else {
    currentMicSource = source;
    try {
      recognition.start();
    } catch (err) {
      console.warn('Recognition already active:', err);
    }
  }
}

function stopRecordingUI() {
  isRecording = false;
  if (micBtn) micBtn.classList.remove('recording-glow');
  if (waveVisualizer) {
    waveVisualizer.classList.add('hidden');
    waveVisualizer.classList.remove('flex');
  }
  if (micStatus && micStatus.textContent === 'Mendengarkan... Bicara sekarang (Bahasa Indonesia)') {
    micStatus.textContent = 'Klik tombol mikrofon di atas untuk mulai merekam ucapan Anda';
  }

  if (chatMicBtn) {
    chatMicBtn.classList.remove('bg-red-600', 'text-white', 'recording-glow');
    chatMicBtn.classList.add('bg-slate-800', 'text-slate-300');
  }
  if (chatInputText && chatInputText.placeholder === 'Mendengarkan ucapan Anda...') {
    chatInputText.placeholder = 'Ketik atau ucapkan pesan...';
  }
}

// 2. Translaasi & Integrasi Backend API
async function handleTranslate(inputOverride) {
  const text = (inputOverride || textInput.value).trim();
  const apiKey = (apiKeyInput ? apiKeyInput.value : localStorage.getItem('9router_api_key') || '').trim();
  const apiHost = (apiHostInput ? apiHostInput.value : localStorage.getItem('9router_api_host') || DEFAULT_API_HOST).trim();
  const selectedModel = (modelSelect && modelSelect.value.trim()) || 'deepseek/deepseek-chat';

  if (!text) {
    showToast('Masukkan kalimat Bahasa Indonesia terlebih dahulu.');
    return;
  }

  if (!apiKey) {
    showToast('Isi API Key dulu di Pengaturan.');
    openSettingsModal();
    return;
  }

  // Simpan Pengaturan API Key & Model & Host
  localStorage.setItem('9router_api_key', apiKey);
  localStorage.setItem('9router_api_host', apiHost || DEFAULT_API_HOST);
  if (modelSelect) localStorage.setItem('9router_model', selectedModel);

  // Tampilkan UI Loading State
  showLoading(true);

  try {
    // Panggil Layanan Backend AI (9router API)
    const result = await processIndonesianToEnglish(text, apiKey, {
      model: selectedModel,
      endpoint: apiHost || DEFAULT_API_HOST
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
      playTTS(result.english_text);
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
  if (!text) return '<p class="text-slate-400 text-xs">Tidak ada penjelasan grammar.</p>';

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const formattedItems = lines.map(line => {
    let cleanLine = line.replace(/^[•\-\*\d+\.]\s*/, '');
    return `<li class="flex items-start gap-2 text-slate-200">
      <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5"></span>
      <span class="leading-relaxed text-xs sm:text-sm">${escapeHTML(cleanLine)}</span>
    </li>`;
  }).join('');

  return `<ul class="space-y-2.5 my-1">${formattedItems}</ul>`;
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
async function playTTS(text) {
  const targetText = text || (currentResult ? currentResult.english_text : '');
  if (!targetText) return;

  speakBtn.disabled = true;
  speakBtn.classList.add('opacity-75');

  try {
    // Menggunakan synthesizer TTS dari backend.js (otomatis memakai config tersimpan)
    const ttsConfig = getTTSConfig();
    const result = await synthesizeTTS(targetText, ttsConfig);
    if (result && result.provider === TTSProvider.KOKORO_HOMELAB) {
      showToast('🔊 Memutar audio via Kokoro Homelab TTS');
    }
  } catch (err) {
    console.error('TTS Playback Error:', err);
    showToast('Gagal memutar audio TTS.');
  } finally {
    speakBtn.disabled = false;
    speakBtn.classList.remove('opacity-75');
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
  const apiHost = (apiHostInput ? apiHostInput.value : localStorage.getItem('9router_api_host') || DEFAULT_API_HOST).trim();

  if (!text) {
    showToast('Tulis atau ucapkan pesan terlebih dahulu.');
    return;
  }

  if (!apiKey) {
    showToast('Isi API Key dulu di Pengaturan.');
    openSettingsModal();
    return;
  }

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
    const selectedModel = (modelSelect && modelSelect.value.trim()) || 'deepseek/deepseek-chat';
    const result = await processChatConversation(chatMessages, apiKey, { 
      model: selectedModel,
      endpoint: apiHost || DEFAULT_API_HOST
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
      playTTS(result.reply);
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

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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

  // Sample Prompt Buttons Click Handler (Mode Voice)
  const samplePromptBtns = document.querySelectorAll('.sample-prompt');
  samplePromptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const promptText = btn.textContent.trim().replace(/^"|"$/g, '');
      if (textInput) textInput.value = promptText;
      handleTranslate(promptText);
    });
  });

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

  // Toggle Visibility password untuk 9router API Key
  if (toggleApiKeyVisibility && apiKeyInput) {
    toggleApiKeyVisibility.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
    });
  }

  // TTS Provider Dropdown Selector Change
  if (ttsProviderSelect) {
    ttsProviderSelect.addEventListener('change', () => {
      toggleKokoroUrlVisibility(ttsProviderSelect.value);
    });
  }

  // Simpan Pengaturan (9router API Key + Host Endpoint + LLM Model + Provider TTS)
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
      const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
      const apiHost = apiHostInput ? apiHostInput.value.trim() : '';
      const selectedModel = (modelSelect && modelSelect.value.trim()) || 'deepseek/deepseek-chat';
      const selectedProvider = ttsProviderSelect ? ttsProviderSelect.value : TTSProvider.BROWSER;
      const kokoroUrl = kokoroUrlInput ? kokoroUrlInput.value.trim() : '';

      if (!apiKey) {
        showToast('API Key wajib diisi.');
        return;
      }

      // Save 9router Settings to localStorage
      localStorage.setItem('9router_api_key', apiKey);
      localStorage.setItem('9router_api_host', apiHost || DEFAULT_API_HOST);
      if (modelSelect) localStorage.setItem('9router_model', selectedModel);

      // Save TTS Config via backend.js helper
      saveTTSConfig({
        provider: selectedProvider,
        kokoroUrl: kokoroUrl || 'http://localhost:8880/v1/audio/speech'
      });

      showToast('⚙️ Pengaturan API & TTS tersimpan!');
      closeSettingsModal();
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

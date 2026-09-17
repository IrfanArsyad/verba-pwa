# 📝 TASKPLAN: AI English Tutor (PWA Version)

> **Visi Proyek:** Aplikasi PWA (Progressive Web App) interaktif untuk belajar Bahasa Inggris.
> **Flow Utama:** `Input Suara/Teks Indo` ➔ `Koreksi & Grammar via 9router (LLM)` ➔ `Output Teks & Penjelasan` ➔ `Audio Inggris (TTS)`

---

## 🎯 Strategi Pengembangan (Baby Steps)

| Fase | Fokus Utama | Target Waktu | Tingkat Kesulitan |
|---|---|---|---|
| **Fase 1** | **MVP** (Web App + Web Speech API + 9router LLM) | 1 Hari | ⭐ Sangat Mudah |
| **Fase 2** | **PWA & UI Polish** (Installable, History, Tailwind UI) | 1-2 Hari | ⭐⭐ Mudah |
| **Fase 3** | **Homelab Upgrade** (Suara AI Kokoro & Whisper Docker) | Opsional | ⭐⭐⭐ Sedang |

---

## 🏗️ Arsitektur Sistem PWA


---

## 📋 Checklist Task Roadmap

### 🚀 FASE 1: MVP (Target: 1 Hari — Paling Mudah)

*Fokus: Membangun aplikasi web sederhana yang dapat mengoreksi tata bahasa dan membacakan teks Inggris.*

- [x] **1.1 Setup Project & Environment**
  - [x] Inisialisasi proyek web (HTML + JS murni / ES Modules).
  - [x] Buat file konfigurasi variabel lingkungan / Pengaturan API Key `9ROUTER_API_KEY`.
  - [x] Jalankan local development server.

- [x] **1.2 Integrasi Speech-to-Text (STT) Browser**
  - [x] Implementasi `webkitSpeechRecognition` / `SpeechRecognition` API.
  - [x] Konfigurasi bahasa pengenalan ke `id-ID` (Bahasa Indonesia).
  - [x] Buat tombol toggle 🎤 (Start/Stop recording) dengan status real-time.

- [x] **1.3 Integrasi 9router LLM API**
  - [x] Buat modul HTTP request (`fetch`) ke `https://api.9router.com/v1/chat/completions`.
  - [x] Terapkan **System Prompt** khusus guru Bahasa Inggris.
  - [x] Kunci format respon ke **JSON Structure**:
    ```json
    {
      "indonesian_input": "...",
      "english_text": "...",
      "explanation": "..."
    }
    ```
  - [x] Tambahkan error handling & JSON parsing guard.

- [x] **1.4 Integrasi Text-to-Speech (TTS) Browser**
  - [x] Implementasi `window.speechSynthesis` API.
  - [x] Set bahasa aksen pembaca ke `en-US` atau `en-GB`.
  - [x] Buat fungsi auto-play saat hasil terjemahan selesai diproses.
  - [x] Tambahkan tombol "🔊 Putar Ulang Suara".

- [x] **1.5 UI/UX Dasar**
  - [x] Layout 1 halaman sederhana & responsif.
  - [x] Form input teks manual + tombol Rekam Suara.
  - [x] Card Tampilan Hasil:
    - 🇮🇩 Teks Asli Bahasa Indonesia.
    - 🇬🇧 Teks Inggris yang Benar (Highlight Utama).
    - 📖 Penjelasan Grammar (Poin demi poin).
  - [x] Loading state / Spinner saat menunggu respon dari 9router.

#### ✅ Milestone Fase 1:
> User bisa input ucapan Indo ➔ AI mengoreksi ke bahasa Inggris + penjelasan ➔ Browser membacakan hasilnya.

---

### 🎨 FASE 2: PWA & UI Polish (Target: 1-2 Hari)

*Fokus: Mengubah aplikasi Web biasa menjadi PWA yang bisa di-install di HP/Desktop layaknya aplikasi Native.*

- [x] **2.1 Konfigurasi PWA (Progressive Web App)**
  - [x] Buat file `manifest.json` (App Name, Short Name, Icons, Theme Color).
  - [x] Buat Service Worker (`sw.js`) untuk caching aset statis (HTML/CSS/JS).
  - [x] Daftarkan Service Worker di script utama (`index.html` / `app.js`).
  - [x] Uji fitur *"Add to Home Screen"* di HP (Android/iOS) dan Chrome Desktop.

- [x] **2.2 UI/UX Polish (Tailwind CSS / Styling)**
  - [x] Desain antarmuka modern & bersih (Clean & Accessible).
  - [x] Animasi visual saat mic sedang merekam (pulse animation).
  - [x] Fitur Dark Mode styling bawaan.
  - [x] Tombol **"📋 Copy English Text"** untuk kemudahan pengguna.

- [x] **2.3 Fitur History & Storage Lokal**
  - [x] Simpan daftar riwayat belajar pengguna ke `localStorage` (`HistoryManager`).
  - [x] Buat sidebar / drawer "Riwayat Belajar" untuk melihat kalimat-kalimat sebelumnya.
  - [x] Fitur hapus riwayat / clear all history.

- [x] **2.4 Error Handling & Fallbacks**
  - [x] Penanganan kondisi offline / koneksi terputus dengan offline banner.
  - [x] Notifikasi error ramah pengguna jika API Key 9router bermasalah.

#### ✅ Milestone Fase 2:
> App bisa di-install di HP/Desktop, tampilan modern, offline-ready untuk UI, serta menyimpan riwayat belajar.

---

### 📱 FASE 2.5: Native Mobile App Architecture & Footer Navigation

- [x] **Native Bottom Action Bar (Footer Navigasi Mobile)**
  - [x] 🏠 **Beranda (Home)**: Card Sambutan, Daily Streak Widget, Quick Launchers, & Kalimat Hari Ini (*Sentence of the Day*).
  - [x] 🎙️ **Voice (Voice Tutor)**: Modul Rekam Suara Cepat & Koreksi Tata Bahasa Instant.
  - [x] 💬 **Chat AI**: Latih percakapan dua arah interaktif real-time dengan AI Tutor.
  - [x] 📊 **Dashboard & Progress**: Statistik belajar & daftar riwayat tersimpan langsung di dalam halaman.
  - [x] ⚙️ **Akun / Pengaturan**: Konfigurasi API Key 9router, Model LLM, & Provider TTS.
- [x] **Mobile Ergonomics**:
  - [x] Thumb-zone bottom footer navigation (`pb-safe` iOS/Android support).
  - [x] Icon controls dengan label responsif.
  - [x] Quick transition antarlayar tanpa reload.


### 🏠 FASE 3: Homelab Upgrade (Opsional / Suara AI Natural)

*Fokus: Mengganti TTS bawaan browser dengan Suara AI Super Natural dari Kokoro-82M yang di-host di Homelab.*

- [ ] **3.1 Deployment Service di Homelab**
  - [ ] Jalankan Docker Container Kokoro-82M TTS:
    ```bash
    docker run -d \
      --name kokoro-tts \
      -p 8880:8880 \
      --restart always \
      ghcr.io/resemble-ai/kokoro-fastapi:latest
    ```
  - [ ] (Opsional) Jalankan Docker Container Faster-Whisper STT:
    ```bash
    docker run -d \
      --name whisper-stt \
      -p 9000:9000 \
      -e ASR_MODEL=small \
      -e ASR_ENGINE=faster_whisper \
      --restart always \
      fedirz/faster-whisper-server:latest
    ```

- [ ] **3.2 Integrasi PWA ke Homelab Endpoints**
  - [ ] Buat halaman **Settings** pada PWA:
    - Opsi Provider TTS: `Browser Default` | `Homelab Kokoro AI`.
    - Input URL Homelab: `http://192.168.x.x:8880` atau `https://tts.domainanda.com`.
  - [ ] Buat handler pengambil audio blob (`.mp3` / `.wav`) dari Kokoro API `/v1/audio/speech`.
  - [ ] Putar audio via HTML5 `<audio>` element / Web Audio API.

- [ ] **3.3 Expose via Cloudflare Tunnel (Opsional untuk Akses Luar Rumah)**
  - [ ] Hubungkan port `8880` Homelab ke Cloudflare Tunnel Domain (misal: `https://tts.mydomain.com`).
  - [ ] Uji coba akses PWA dari luar jaringan rumah (via Seluler 4G/5G).

#### ✅ Milestone Fase 3:
> PWA menghasilkan kualitas suara AI setara ElevenLabs secara gratis dari Homelab milik sendiri.

---

## 🧠 System Prompt Specification (9router)

Berikut adalah prompt baku yang dipasang pada modul 9router LLM:

```text
Kamu adalah guru Bahasa Inggris pribadi yang ramah, sabar, dan edukatif.
Pengguna akan memberikan masukan berupa kalimat dalam Bahasa Indonesia.

Tugas utama:
1. Terjemahkan dan perbaiki kalimat tersebut ke dalam Bahasa Inggris yang natural, tepat secara grammar, dan umum digunakan oleh Native Speaker.
2. Berikan penjelasan ringkas tata bahasa (grammar) dan kosakata dalam Bahasa Indonesia secara poin demi poin agar mudah dipahami.

Wajib merespons HANYA dalam format JSON valid tanpa format markdown codeblock seperti di bawah ini:
{
  "indonesian_input": "<kalimat asli pengguna>",
  "english_text": "<hasil terjemahan bahasa inggris yang benar>",
  "explanation": "<penjelasan grammar poin demi poin>"
}

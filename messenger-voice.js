/* =========================================
   GSRA - Messenger: Sprachnachrichten wie bei WhatsApp
   (Aufnahme mit Pause, Live-Wellenform, Transkript beim Aufnehmen, Abspielen mit Spulen und Tempo)
   (ergänzt messenger.js – der gemeinsame Zustand steht dort)
========================================= */

const VOICE_MAX_SECONDS = 600;
const VOICE_WAVE_BARS = 48;
const VOICE_LIVE_BARS = 40;
const voicePlayers = new Map();      // Nachrichten-ID → Wiedergabe (bleibt erhalten, wenn der Chat neu gezeichnet wird)
const voiceTranscriptsOpen = new Set();
let voiceRecording = null;

function voiceSupported() {
    return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

// Transkript beim Aufnehmen über die Spracherkennung des Browsers (Chrome, Edge, Safari am Computer).
// Auf Smartphones teilen sich Aufnahme und Spracherkennung das Mikrofon nicht zuverlässig – dort ohne Transkript.
function voiceRecognitionClass() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return Recognition && !isMobile ? Recognition : null;
}

function pickVoiceMimeType() {
    return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
        .find(type => MediaRecorder.isTypeSupported?.(type)) || "";
}

function voiceElapsedMs(rec) {
    return rec.elapsedMs + (rec.paused ? 0 : performance.now() - rec.segmentStart);
}

// Pegelverlauf auf eine feste Zahl Balken verdichten (lauteste Stelle = 1)
function compressWaveform(levels, bars) {
    if (levels.length === 0) return Array(bars).fill(0.1);
    const out = [];
    for (let i = 0; i < bars; i++) {
        const start = Math.floor(i * levels.length / bars);
        const end = Math.max(start + 1, Math.floor((i + 1) * levels.length / bars));
        out.push(Math.max(...levels.slice(start, end)));
    }
    const max = Math.max(...out) || 1;
    return out.map(v => Math.round((v / max) * 100) / 100);
}

/* ---------- Eingabeleiste: Mikrofon ↔ Senden ---------- */

function initVoiceMessages() {
    const micBtn = document.getElementById("voiceRecordBtn");
    if (!chatForm || !micBtn) return;
    if (!voiceSupported()) {
        chatForm.classList.add("no-voice");
        return;
    }
    micBtn.addEventListener("click", startVoiceRecording);

    // Angehängte Fotos/Videos: Senden statt Mikrofon anzeigen
    if (imagePreviewContainer) {
        const syncMedia = () => chatForm.classList.toggle("has-media", imagePreviewContainer.style.display !== "none");
        new MutationObserver(syncMedia).observe(imagePreviewContainer, { attributes: true, attributeFilter: ["style"] });
        syncMedia();
    }
}

/* ---------- Aufnahme ---------- */

async function startVoiceRecording() {
    if (voiceRecording || !activeChatId || !currentUser?.id || (messageInput && messageInput.disabled)) return;
    if (isOfficialForum(activeChatId) && !isAdminUser) return;

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
        showToast(err?.name === "NotAllowedError"
            ? "Bitte erlaube den Zugriff auf dein Mikrofon, um Sprachnachrichten aufzunehmen."
            : "Es wurde kein Mikrofon gefunden.", "error");
        return;
    }

    let recorder;
    const mimeType = pickVoiceMimeType();
    try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 48000 } : undefined);
    } catch (e) {
        recorder = new MediaRecorder(stream);
    }

    const rec = {
        chatId: activeChatId, stream, recorder, chunks: [], levels: [],
        paused: false, stopped: false, elapsedMs: 0, segmentStart: performance.now(),
        finalText: "", interimText: "", recognition: null, recognitionOn: false, transcriptBlocked: false,
        audioContext: null, analyser: null, timer: null, ui: null
    };
    voiceRecording = rec;
    recorder.addEventListener("dataavailable", (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); });
    recorder.start(250);

    // Pegel fürs Mikrofon messen (Live-Wellenform und Wellenform der Nachricht)
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        rec.audioContext = new AudioCtx();
        rec.analyser = rec.audioContext.createAnalyser();
        rec.analyser.fftSize = 1024;
        rec.audioContext.createMediaStreamSource(stream).connect(rec.analyser);
        rec.audioContext.resume?.();
    } catch (e) {
        rec.analyser = null;
    }

    startVoiceTranscript(rec);
    showVoiceRecorder(rec);
    rec.timer = setInterval(() => tickVoiceRecording(rec), 100);
}

function tickVoiceRecording(rec) {
    if (rec !== voiceRecording || rec.paused || rec.stopped) return;
    let level = 0;
    if (rec.analyser) {
        const data = new Uint8Array(rec.analyser.fftSize);
        rec.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const x = (data[i] - 128) / 128;
            sum += x * x;
        }
        level = Math.min(1, Math.sqrt(sum / data.length) * 4);
    }
    rec.levels.push(level);
    updateVoiceRecorder(rec);
    if (voiceElapsedMs(rec) / 1000 >= VOICE_MAX_SECONDS) {
        toggleVoicePause(rec);
        showToast("Maximale Länge erreicht (10 Minuten) – du kannst die Sprachnachricht jetzt senden.", "info");
    }
}

function startVoiceTranscript(rec) {
    const Recognition = voiceRecognitionClass();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = navigator.language || "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) rec.finalText += `${text.trim()} `;
            else interim += text;
        }
        rec.interimText = interim;
        updateVoiceRecorder(rec);
    };
    recognition.onerror = (event) => {
        if (["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "network"].includes(event.error)) {
            rec.transcriptBlocked = true;
            updateVoiceRecorder(rec);
        }
    };
    recognition.onend = () => {
        rec.recognitionOn = false;
        if (rec.onRecognitionEnd) rec.onRecognitionEnd();
        // Die Erkennung endet nach Sprechpausen von selbst – solange aufgenommen wird, geht es weiter
        if (rec === voiceRecording && !rec.paused && !rec.stopped && !rec.transcriptBlocked) startRecognition(rec);
    };
    rec.recognition = recognition;
    startRecognition(rec);
}

function startRecognition(rec) {
    if (!rec.recognition || rec.recognitionOn) return;
    try {
        rec.recognition.start();
        rec.recognitionOn = true;
    } catch (e) {
        /* läuft bereits */
    }
}

function toggleVoicePause(rec) {
    if (!rec || rec.stopped) return;
    if (rec.paused) {
        rec.paused = false;
        rec.segmentStart = performance.now();
        if (rec.recorder.state === "paused") rec.recorder.resume();
        if (!rec.transcriptBlocked) startRecognition(rec);
    } else {
        rec.elapsedMs += performance.now() - rec.segmentStart;
        rec.paused = true;
        if (rec.recorder.state === "recording") rec.recorder.pause();
        try { rec.recognition?.stop(); } catch (e) { /* schon beendet */ }
    }
    updateVoiceRecorder(rec);
}

function cleanupVoiceRecording(rec, keepUi = false) {
    clearInterval(rec.timer);
    rec.stream.getTracks().forEach(track => track.stop());
    try { rec.audioContext?.close(); } catch (e) { /* schon geschlossen */ }
    if (voiceRecording === rec) voiceRecording = null;
    if (!keepUi) removeVoiceRecorder(rec);
}

function removeVoiceRecorder(rec) {
    rec.ui?.remove();
    rec.ui = null;
    chatForm?.classList.remove("recording");
}

function cancelVoiceRecording() {
    const rec = voiceRecording;
    if (!rec) return;
    rec.stopped = true;
    try { rec.recognition?.abort(); } catch (e) { /* schon beendet */ }
    if (rec.recorder.state !== "inactive") rec.recorder.stop();
    cleanupVoiceRecording(rec);
}

// Wechsel in einen anderen Chat: laufende Aufnahme verwerfen
function cancelVoiceRecordingFor(chatId) {
    if (voiceRecording && voiceRecording.chatId !== chatId) cancelVoiceRecording();
}

// Aufnahme beenden: Audiodatei, Dauer, Wellenform und Transkript
async function finishVoiceRecording(rec) {
    const duration = voiceElapsedMs(rec) / 1000;
    rec.stopped = true;
    clearInterval(rec.timer);
    const stopped = new Promise(resolve => {
        if (rec.recorder.state === "inactive") return resolve();
        rec.recorder.addEventListener("stop", resolve, { once: true });
        rec.recorder.stop();
    });
    // Letzte Ergebnisse der Spracherkennung abwarten (höchstens 1,5 Sekunden)
    const transcriptDone = new Promise(resolve => {
        if (!rec.recognition || !rec.recognitionOn) return resolve();
        rec.onRecognitionEnd = resolve;
        try { rec.recognition.stop(); } catch (e) { resolve(); }
        setTimeout(resolve, 1500);
    });
    await Promise.all([stopped, transcriptDone]);
    cleanupVoiceRecording(rec, true);
    const type =(rec.recorder.mimeType || rec.chunks[0]?.type || "audio/webm").split(";")[0];
    return {
        blob: new Blob(rec.chunks, { type }),
        type,
        duration,
        waveform: compressWaveform(rec.levels, VOICE_WAVE_BARS),
        transcript: `${rec.finalText} ${rec.interimText}`.replace(/\s+/g, " ").trim() || null
    };
}

async function sendVoiceRecording() {
    const rec = voiceRecording;
    if (!rec || rec.sending) return;
    rec.sending = true;
    if (rec.ui) {
        rec.ui.classList.add("busy");
        rec.ui.querySelector(".voice-rec-send").innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    const supabase = window.supabaseClient || window.supabase;
    const result = await finishVoiceRecording(rec);
    if (result.duration < 1 || result.blob.size === 0) {
        removeVoiceRecorder(rec);
        showToast("Die Sprachnachricht ist zu kurz.", "info");
        return;
    }

    try {
        const ext = result.type.includes("mp4") ? "m4a" : (result.type.includes("ogg") ? "ogg" : "webm");
        const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("chat_attachments").upload(fileName, result.blob, { contentType: result.type });
        if (uploadErr) throw uploadErr;
        const { data: pubData } = supabase.storage.from("chat_attachments").getPublicUrl(fileName);

        const text = `🎤 Sprachnachricht (${formatDuration(result.duration)})`;
        const { error } = await supabase.from("messages").insert([{
            chat_id: rec.chatId,
            sender_id: currentUser.id,
            text,
            audio_url: pubData.publicUrl,
            voice_duration: Math.round(result.duration * 10) / 10,
            voice_waveform: result.waveform,
            transcript: result.transcript,
            reply_to: replyingToId || null
        }]);
        if (error) throw error;
        await supabase.from("chats").update({ last_message: text }).eq("id", rec.chatId);

        replyingToId = null;
        if (replyPreviewBanner) replyPreviewBanner.style.display = "none";
        markChatAsRead(rec.chatId);
        loadUserChats();
    } catch (err) {
        console.error("Sprachnachricht konnte nicht gesendet werden:", err);
        const notSetUp = /audio_url|voice_|transcript|schema cache/i.test(err?.message || "");
        showToast(notSetUp
            ? "Sprachnachrichten sind in der Datenbank noch nicht eingerichtet."
            : `Die Sprachnachricht konnte nicht gesendet werden: ${err?.message || "Unbekannter Fehler"}`, "error");
    } finally {
        removeVoiceRecorder(rec);
    }
}

/* ---------- Aufnahmeleiste: Löschen · Zeit · Wellenform · Pause/Mikrofon · Senden ---------- */

function showVoiceRecorder(rec) {
    const bar = document.createElement("div");
    bar.className = "voice-recorder";
    bar.innerHTML = `
        <div class="voice-rec-transcript" hidden><i class="fa-solid fa-closed-captioning"></i><span></span></div>
        <button type="button" class="voice-rec-btn voice-rec-delete" title="Aufnahme verwerfen"><i class="fa-solid fa-trash"></i></button>
        <div class="voice-rec-status"><span class="voice-rec-dot"></span><span class="voice-rec-time">0:00</span></div>
        <div class="voice-rec-wave">${"<span></span>".repeat(VOICE_LIVE_BARS)}</div>
        <button type="button" class="voice-rec-btn voice-rec-pause" title="Aufnahme pausieren"><i class="fa-solid fa-pause"></i></button>
        <button type="button" class="voice-rec-btn voice-rec-send" title="Sprachnachricht senden"><i class="fa-solid fa-paper-plane"></i></button>`;
    bar.querySelector(".voice-rec-delete").addEventListener("click", cancelVoiceRecording);
    bar.querySelector(".voice-rec-pause").addEventListener("click", () => toggleVoicePause(rec));
    bar.querySelector(".voice-rec-send").addEventListener("click", sendVoiceRecording);
    rec.ui = bar;
    chatForm.classList.add("recording");
    chatForm.appendChild(bar);
    if (emojiPickerWrapper) emojiPickerWrapper.style.display = "none";
    updateVoiceRecorder(rec);
}

function updateVoiceRecorder(rec) {
    const bar = rec.ui;
    if (!bar) return;
    bar.classList.toggle("paused", rec.paused);
    bar.querySelector(".voice-rec-time").textContent = formatDuration(voiceElapsedMs(rec) / 1000);

    const pauseBtn = bar.querySelector(".voice-rec-pause");
    pauseBtn.innerHTML = rec.paused ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-pause"></i>';
    pauseBtn.title = rec.paused ? "Aufnahme fortsetzen" : "Aufnahme pausieren";

    const recent = rec.levels.slice(-VOICE_LIVE_BARS);
    const offset = VOICE_LIVE_BARS - recent.length;
    bar.querySelectorAll(".voice-rec-wave span").forEach((span, i) => {
        const level = i >= offset ? recent[i - offset] : 0;
        span.style.height = `${Math.max(8, Math.round(level * 100))}%`;
        span.classList.toggle("empty", i < offset);
    });

    const transcriptBox = bar.querySelector(".voice-rec-transcript");
    const text = `${rec.finalText}${rec.interimText}`.trim();
    if (rec.recognition) {
        transcriptBox.hidden = false;
        transcriptBox.querySelector("span").textContent = rec.transcriptBlocked
            ? "Transkript nicht verfügbar – die Sprachnachricht wird ohne Text gesendet."
            : (text ? `…${text.slice(-90)}` : (rec.paused ? "Transkript pausiert" : "Transkript: sprich los …"));
    }
}

/* ---------- Sprachnachricht im Chat: Abspielen, Spulen, Tempo, Transkript ---------- */

function getVoicePlayer(msg) {
    let player = voicePlayers.get(String(msg.id));
    if (player && player.url === msg.audio_url) return player;
    const audio = new Audio();
    audio.preload = "none";
    audio.src = msg.audio_url;
    player = { audio, url: msg.audio_url, duration: Number(msg.voice_duration) || 0, rate: 1, ui: null };
    const refresh = () => player.ui?.();
    audio.addEventListener("timeupdate", refresh);
    audio.addEventListener("play", refresh);
    audio.addEventListener("pause", refresh);
    audio.addEventListener("loadedmetadata", () => {
        if (isFinite(audio.duration) && audio.duration > 0) player.duration = audio.duration;
        refresh();
    });
    audio.addEventListener("ended", () => {
        audio.currentTime = 0;
        refresh();
    });
    voicePlayers.set(String(msg.id), player);
    return player;
}

function renderVoiceMessage(bubble, msg) {
    const player = getVoicePlayer(msg);
    const waveform = Array.isArray(msg.voice_waveform) && msg.voice_waveform.length ? msg.voice_waveform : Array(VOICE_WAVE_BARS).fill(0.3);
    bubble.classList.add("has-voice");

    const box = document.createElement("div");
    box.className = "voice-msg";
    box.innerHTML = `
        <button type="button" class="voice-play" title="Abspielen"><i class="fa-solid fa-play"></i></button>
        <div class="voice-body">
            <div class="voice-wave" title="Zum Spulen klicken">${waveform.map(v => `<span style="height: ${Math.max(12, Math.round(Number(v) * 100) || 12)}%"></span>`).join("")}</div>
            <div class="voice-meta">
                <span class="voice-time"></span>
                <button type="button" class="voice-speed" title="Wiedergabegeschwindigkeit">1×</button>
            </div>
        </div>
        <div class="voice-badge"><i class="fa-solid fa-microphone"></i></div>`;

    const playBtn = box.querySelector(".voice-play");
    const bars = [...box.querySelectorAll(".voice-wave span")];
    const timeEl = box.querySelector(".voice-time");
    const speedBtn = box.querySelector(".voice-speed");
    const blockedBySelection = () => isMultiSelectMode;

    player.ui = () => {
        const audio = player.audio;
        const duration = player.duration || (isFinite(audio.duration) ? audio.duration : 0);
        const progress = duration ? Math.min(1, audio.currentTime / duration) : 0;
        const playing = !audio.paused && !audio.ended;
        playBtn.innerHTML = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
        playBtn.title = playing ? "Pausieren" : "Abspielen";
        bars.forEach((bar, i) => bar.classList.toggle("played", (i + 0.5) / bars.length <= progress));
        timeEl.textContent = formatDuration(playing || audio.currentTime > 0 ? audio.currentTime : duration);
        speedBtn.textContent = `${String(player.rate).replace(".", ",")}×`;
        box.classList.toggle("playing", playing);
    };
    player.ui();

    playBtn.addEventListener("click", (e) => {
        if (blockedBySelection()) return;
        e.stopPropagation();
        const audio = player.audio;
        if (!audio.paused) {
            audio.pause();
            return;
        }
        // Immer nur eine Sprachnachricht gleichzeitig
        voicePlayers.forEach(other => { if (other !== player) other.audio.pause(); });
        audio.playbackRate = player.rate;
        audio.play().catch(() => showToast("Die Sprachnachricht kann in diesem Browser nicht abgespielt werden.", "error"));
    });

    box.querySelector(".voice-wave").addEventListener("click", (e) => {
        if (blockedBySelection()) return;
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        const duration = player.duration || (isFinite(player.audio.duration) ? player.audio.duration : 0);
        if (!duration) return;
        player.audio.currentTime = fraction * duration;
        player.ui();
    });

    speedBtn.addEventListener("click", (e) => {
        if (blockedBySelection()) return;
        e.stopPropagation();
        player.rate = player.rate === 1 ? 1.5 : (player.rate === 1.5 ? 2 : 1);
        player.audio.playbackRate = player.rate;
        player.ui();
    });

    bubble.appendChild(box);

    // Transkript (beim Aufnehmen erstellt) für alle Empfänger lesbar
    if (msg.transcript) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "voice-transcript-toggle";
        const text = document.createElement("div");
        text.className = "voice-transcript";
        text.textContent = msg.transcript;
        const sync = () => {
            const open = voiceTranscriptsOpen.has(String(msg.id));
            text.hidden = !open;
            toggle.innerHTML = `<i class="fa-solid fa-closed-captioning"></i> ${open ? "Transkript ausblenden" : "Transkript anzeigen"}`;
        };
        toggle.addEventListener("click", (e) => {
            if (blockedBySelection()) return;
            e.stopPropagation();
            const id = String(msg.id);
            if (voiceTranscriptsOpen.has(id)) voiceTranscriptsOpen.delete(id);
            else voiceTranscriptsOpen.add(id);
            sync();
        });
        sync();
        bubble.appendChild(toggle);
        bubble.appendChild(text);
    }
}

document.addEventListener("DOMContentLoaded", initVoiceMessages);

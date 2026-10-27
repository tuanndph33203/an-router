"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Badge } from "@/shared/components";

interface VoiceItem {
  id: string;
  modelKey: string;
  name: string;
  gender: "Nam" | "Nữ";
  region: "Miền Bắc" | "Miền Trung" | "Miền Nam" | "Toàn quốc" | "Quốc tế";
  description: string;
  sampleText: string;
  demoAudioUrl: string;
  engine: "google" | "nghitts";
}

const PRESETS = {
  report:
    "Báo cáo ngày 27/10/2026 ghi nhận doanh thu đạt 12.500.000đ, tăng 18,5% so với quý trước nhờ ứng dụng AI và API tự động.",
  finance:
    "Hệ thống OmniRoute đã điều phối 145.200 lượt yêu cầu lúc 09:30 sáng, tỷ lệ thành công đạt 99,8% và tiết kiệm 45% chi phí.",
  story:
    "Đêm đã về khuya, ngoài hiên mưa rơi rả rích. Những kỷ niệm xưa cũ bỗng ùa về nhẹ nhàng như một thước phim quay chậm trong ký ức.",
};

export default function TtsStudioPage() {
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("google_vi");
  const [activeEngine, setActiveEngine] = useState<"google" | "nghitts">("google");
  const [text, setText] = useState<string>(PRESETS.report);
  const [normalizedPreview, setNormalizedPreview] = useState<string>("");
  const [speed, setSpeed] = useState<number>(1.0);
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterGender, setFilterGender] = useState<string>("");
  const [synthesizing, setSynthesizing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "js" | "python" | "csharp">("curl");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const mainAudioRef = useRef<HTMLAudioElement | null>(null);

  const fetchVoices = async () => {
    try {
      const res = await fetch("/api/tts/voices");
      const data = await res.json();
      if (data.voices && Array.isArray(data.voices)) {
        setVoices(data.voices);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách giọng:", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchVoices();
    void (async () => {
      try {
        const res = await fetch("/api/tts/normalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: PRESETS.report }),
        });
        if (res.ok) {
          const data = await res.json();
           
          setNormalizedPreview(data.normalizedText || "");
        }
      } catch {}
    })();
  }, []);

  async function previewNormalize(customText?: string) {
    const textToNorm = customText !== undefined ? customText : text;
    if (!textToNorm.trim()) {
      setNormalizedPreview("");
      return;
    }
    try {
      const res = await fetch("/api/tts/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToNorm }),
      });
      if (res.ok) {
        const data = await res.json();
        setNormalizedPreview(data.normalizedText || "");
      }
    } catch {}
  }

  async function handleSynthesize() {
    if (!text.trim()) return;
    setSynthesizing(true);
    setStatusMessage(
      activeEngine === "google"
        ? "Đang chuyển tiếp luồng Google TTS (siêu tốc ~150ms)..."
        : "Đang chuẩn hóa tiếng Việt và tạo sóng âm 22.050Hz qua mô hình VITS..."
    );

    try {
      const t0 = performance.now();
      const res = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceId: selectedVoiceId,
          engine: activeEngine,
          speed,
          normalize: true,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const normHeader = res.headers.get("X-Normalized-Text");
      if (normHeader) {
        setNormalizedPreview(decodeURIComponent(normHeader));
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (mainAudioRef.current) {
        mainAudioRef.current.src = url;
        mainAudioRef.current.playbackRate = speed;
        mainAudioRef.current.play().catch(() => {});
      }

      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      const source = res.headers.get("X-Tts-Source") || activeEngine;
      setStatusMessage(
        `✓ Đã tạo xong trong ${elapsed}s • Nguồn: ${source} • Dung lượng: ${(blob.size / 1024).toFixed(1)} KB`
      );
    } catch (err: any) {
      setStatusMessage(`❌ Lỗi: ${err.message}`);
    } finally {
      setSynthesizing(false);
    }
  }

  function playSelectedVoiceDemo() {
    if (mainAudioRef.current) {
      const isGoogle = selectedVoiceId.startsWith("google");
      mainAudioRef.current.src = isGoogle
        ? `/api/tts/demos/${selectedVoiceId}`
        : `/tts/demos/${selectedVoiceId}_demo.wav`;
      mainAudioRef.current.playbackRate = speed;
      mainAudioRef.current.play().catch(() => {});
      setStatusMessage(
        `Đang phát mẫu âm thanh của giọng: ${selectedVoice?.name || selectedVoiceId} (${speed}x)`
      );
    }
  }

  function handleSelectVoice(v: VoiceItem) {
    setSelectedVoiceId(v.id);
    setActiveEngine(v.engine);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleEngineSwitch(engine: "google" | "nghitts") {
    setActiveEngine(engine);
    if (engine === "google") {
      setSelectedVoiceId("google_vi");
    } else if (selectedVoiceId.startsWith("google")) {
      setSelectedVoiceId("ban_mai");
    }
  }

  function handlePresetClick(key: keyof typeof PRESETS) {
    const val = PRESETS[key];
    setText(val);
    previewNormalize(val);
  }

  const selectedVoice = voices.find((v) => v.id === selectedVoiceId) || voices[0];
  const filteredVoices = voices.filter(
    (v) =>
      (!filterRegion || v.region === filterRegion) && (!filterGender || v.gender === filterGender)
  );

  const cleanTextForCode = (text || "Xin chào").split('"').join('\\"');

  // Dynamic code snippets reflecting the selected engine, voice, and speed
  const curlSnippet =
    activeEngine === "google"
      ? `curl -X POST "http://localhost:20128/api/tts/synthesize" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "${cleanTextForCode}",
    "voiceId": "${selectedVoiceId}",
    "engine": "google",
    "speed": ${speed},
    "normalize": true
  }' \\
  --output speech_google.mp3`
      : `curl -X POST "http://localhost:20128/api/tts/synthesize" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "${cleanTextForCode}",
    "voiceId": "${selectedVoiceId}",
    "engine": "nghitts",
    "speed": ${speed},
    "normalize": true
  }' \\
  --output speech_nghitts.wav`;

  const jsSnippet = `const res = await fetch("http://localhost:20128/api/tts/synthesize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "${cleanTextForCode}",
    voiceId: "${selectedVoiceId}",
    engine: "${activeEngine}",
    speed: ${speed},
    normalize: true
  })
});
const audioBlob = await res.blob();
const audio = new Audio(URL.createObjectURL(audioBlob));
audio.playbackRate = ${speed};
audio.play();`;

  const pythonSnippet = `import requests

res = requests.post(
    "http://localhost:20128/api/tts/synthesize",
    json={
        "text": "${cleanTextForCode}",
        "voiceId": "${selectedVoiceId}",
        "engine": "${activeEngine}",
        "speed": ${speed},
        "normalize": True
    }
)

with open("speech.${activeEngine === "google" ? "mp3" : "wav"}", "wb") as f:
    f.write(res.content)`;

  const csharpSnippet = `using var client = new HttpClient();
var payload = new {
    text = "${cleanTextForCode}",
    voiceId = "${selectedVoiceId}",
    engine = "${activeEngine}",
    speed = ${speed}f,
    normalize = true
};

var response = await client.PostAsJsonAsync("http://localhost:20128/api/tts/synthesize", payload);
byte[] audioBytes = await response.Content.ReadAsByteArrayAsync();
await File.WriteAllBytesAsync("speech.${activeEngine === "google" ? "mp3" : "wav"}", audioBytes);`;

  const currentSnippet =
    activeCodeTab === "curl"
      ? curlSnippet
      : activeCodeTab === "js"
        ? jsSnippet
        : activeCodeTab === "python"
          ? pythonSnippet
          : csharpSnippet;

  async function copyCode() {
    await navigator.clipboard.writeText(currentSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="text-2xl">🎙️</span> Studio Giọng Nói AI (Google Forward & NGHI-TTS)
            </h1>
            <Badge variant="success">Dual-Engine (Google + VITS)</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Chuyển đổi văn bản thành giọng nói tiếng Việt tự nhiên • Tùy chọn Luồng Google Siêu Tốc
            (~150ms) hoặc 18 Giọng NGHI-TTS • Tùy chỉnh tốc độ đọc
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => handlePresetClick("report")}>
            Mẫu Báo cáo & Doanh thu
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handlePresetClick("finance")}>
            Mẫu Điều phối OmniRoute
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handlePresetClick("story")}>
            Mẫu Kể chuyện
          </Button>
        </div>
      </div>

      {/* Main Studio Card */}
      <Card className="p-6 border border-border shadow-sm">
        {/* Engine Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-6 rounded-xl bg-muted/60 border border-border">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>⚙️ Chọn Luồng Xử Lý (Engine):</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleEngineSwitch("google")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeEngine === "google"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-background text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              <span>⚡</span> Luồng Google TTS (Siêu tốc ~150ms)
            </button>
            <button
              type="button"
              onClick={() => handleEngineSwitch("nghitts")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeEngine === "nghitts"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              <span>🎭</span> Luồng NGHI-TTS (18 Giọng truyền cảm)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Text Input & Normalization */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Văn bản đầu vào (Tiếng Việt)
                </label>
                <span className="text-xs text-muted-foreground">{text.length} ký tự</span>
              </div>
              <textarea
                rows={5}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  previewNormalize(e.target.value);
                }}
                placeholder="Nhập văn bản tiếng Việt bất kỳ (hỗ trợ đọc số, tiền tệ, ngày tháng, từ viết tắt)..."
                className="w-full rounded-xl border border-input bg-background p-3.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>

            {/* Normalization Box */}
            <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  🔍 Chuẩn hóa Tiếng Việt (Vietnamese Normalizer)
                </span>
                <button
                  type="button"
                  onClick={() => previewNormalize()}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Làm mới chuẩn hóa
                </button>
              </div>
              <p className="text-xs text-foreground/80 italic leading-relaxed">
                {normalizedPreview || "Đang phân tích cú pháp số, ngày tháng, tiền tệ..."}
              </p>
            </div>
          </div>

          {/* Right Col: Voice selection & controls */}
          <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Chọn Giọng Đọc ({voices.length || 20} Giọng)
                </label>
                <select
                  value={selectedVoiceId}
                  onChange={(e) => {
                    const vId = e.target.value;
                    setSelectedVoiceId(vId);
                    const found = voices.find((x) => x.id === vId);
                    if (found) setActiveEngine(found.engine);
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <optgroup label="⚡ Luồng Google TTS (Forward)">
                    {voices
                      .filter((v) => v.engine === "google")
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="🎭 Luồng NGHI-TTS (18 Giọng truyền cảm)">
                    {voices
                      .filter((v) => v.engine === "nghitts")
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.gender} - {v.region})
                        </option>
                      ))}
                  </optgroup>
                </select>
                {selectedVoice && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {selectedVoice.description}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                    Tốc độ đọc
                  </span>
                  <span className="font-bold text-primary">{speed}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={speed}
                  onChange={(e) => {
                    const newSpeed = parseFloat(e.target.value);
                    setSpeed(newSpeed);
                    if (mainAudioRef.current) {
                      mainAudioRef.current.playbackRate = newSpeed;
                    }
                  }}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>0.5x (Chậm)</span>
                  <span>1.0x (Chuẩn)</span>
                  <span>1.5x (Nhanh)</span>
                  <span>2.0x</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-border/60">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={playSelectedVoiceDemo}
                  className="w-full text-xs"
                >
                  🔊 Nghe mẫu
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSynthesize}
                  disabled={synthesizing || !text.trim()}
                  className={`w-full text-xs font-semibold ${
                    activeEngine === "google"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : ""
                  }`}
                >
                  {synthesizing
                    ? "Đang xử lý..."
                    : activeEngine === "google"
                      ? "⚡ Google Phát Ngay"
                      : "⚡ Tạo Giọng Đọc"}
                </Button>
              </div>

              {statusMessage && (
                <div className="text-xs px-3 py-2 rounded-lg bg-muted text-foreground/90 font-mono">
                  {statusMessage}
                </div>
              )}

              <audio ref={mainAudioRef} controls className="w-full h-9 rounded-lg" />
            </div>
          </div>
        </div>
      </Card>

      {/* Voice Gallery */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Danh Sách Giọng Mẫu (Google & NGHI-TTS)
            </h2>
            <p className="text-xs text-muted-foreground">
              Nghe thử tức thì mẫu giọng Google Forward và 18 giọng đọc đặc trưng vùng miền
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground"
            >
              <option value="">Tất cả vùng miền</option>
              <option value="Toàn quốc">Google (Toàn quốc)</option>
              <option value="Miền Bắc">Miền Bắc</option>
              <option value="Miền Nam">Miền Nam</option>
              <option value="Miền Trung">Miền Trung</option>
            </select>
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground"
            >
              <option value="">Tất cả giới tính</option>
              <option value="Nữ">Giọng Nữ</option>
              <option value="Nam">Giọng Nam</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVoices.map((v) => (
            <Card
              key={v.id}
              className={`p-4 border flex flex-col justify-between gap-3 transition ${
                v.engine === "google" ? "border-emerald-500/50 bg-emerald-500/5" : "border-border"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    {v.engine === "google" && <span className="text-xs">⚡</span>}
                    {v.name}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {v.engine === "google" ? (
                      <Badge variant="success">Google ~150ms</Badge>
                    ) : (
                      <>
                        <Badge variant={v.gender === "Nữ" ? "error" : "primary"}>{v.gender}</Badge>
                        <Badge variant="secondary">{v.region}</Badge>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                <p className="text-xs text-foreground/80 italic mt-2.5 bg-muted/60 p-2.5 rounded-lg border border-border/70 line-clamp-2">
                  &ldquo;{v.sampleText}&rdquo;
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/70">
                <audio controls preload="none" src={v.demoAudioUrl} className="w-full h-8" />
                <div className="flex items-center justify-between">
                  <code className="text-[11px] text-primary">{`id: "${v.id}"`}</code>
                  <Button
                    variant={v.engine === "google" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => handleSelectVoice(v)}
                    className="text-xs"
                  >
                    Chọn giọng này ↑
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Interactive API Docs */}
      <Card className="p-6 border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>🔌</span> Tài Liệu Kết Nối API Giọng Nói (Google Forward & NGHI-TTS)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hỗ trợ tùy chọn tham số{" "}
              <code className="text-primary font-mono">{`"engine": "${activeEngine}"`}</code> và{" "}
              <code className="text-primary font-mono">{`"speed": ${speed}`}</code>
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={copyCode} className="text-xs">
            {copiedCode ? "✓ Đã sao chép" : "Sao chép code"}
          </Button>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 border-b border-border pb-2">
          <button
            type="button"
            onClick={() => setActiveCodeTab("curl")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeCodeTab === "curl"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            cURL (Terminal)
          </button>
          <button
            type="button"
            onClick={() => setActiveCodeTab("js")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeCodeTab === "js"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            JavaScript Fetch
          </button>
          <button
            type="button"
            onClick={() => setActiveCodeTab("python")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeCodeTab === "python"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            Python Requests
          </button>
          <button
            type="button"
            onClick={() => setActiveCodeTab("csharp")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeCodeTab === "csharp"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            C# HttpClient
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-muted/80 text-foreground font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {currentSnippet}
        </pre>
      </Card>
    </div>
  );
}

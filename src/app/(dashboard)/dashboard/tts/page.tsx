"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Badge } from "@/shared/components";

interface VoiceItem {
  id: string;
  modelKey: string;
  name: string;
  gender: "Nam" | "Nữ";
  region: "Miền Bắc" | "Miền Trung" | "Miền Nam";
  description: string;
  sampleText: string;
  demoAudioUrl: string;
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
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("ban_mai");
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
    setStatusMessage("Đang chuẩn hóa tiếng Việt và tạo sóng âm 22.050Hz...");

    try {
      const t0 = performance.now();
      const res = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceId: selectedVoiceId,
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
        mainAudioRef.current.play().catch(() => {});
      }

      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      setStatusMessage(
        `✓ Đã tạo xong trong ${elapsed}s • Kích thước: ${(blob.size / 1024).toFixed(1)} KB`
      );
    } catch (err: any) {
      setStatusMessage(`❌ Lỗi: ${err.message}`);
    } finally {
      setSynthesizing(false);
    }
  }

  function playSelectedVoiceDemo() {
    if (mainAudioRef.current) {
      mainAudioRef.current.src = `/tts/demos/${selectedVoiceId}_demo.wav`;
      mainAudioRef.current.play().catch(() => {});
      setStatusMessage(
        `Đang phát mẫu âm thanh có sẵn của giọng: ${selectedVoice?.name || selectedVoiceId}`
      );
    }
  }

  function handleSelectVoice(vId: string) {
    setSelectedVoiceId(vId);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const curlSnippet = `curl -X POST "http://localhost:20128/api/tts/synthesize" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "${cleanTextForCode}",
    "voiceId": "${selectedVoiceId}",
    "speed": ${speed},
    "normalize": true
  }' \\
  --output speech.wav`;

  const jsSnippet = `const res = await fetch("http://localhost:20128/api/tts/synthesize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "${cleanTextForCode}",
    voiceId: "${selectedVoiceId}",
    speed: ${speed},
    normalize: true
  })
});
const audioBlob = await res.blob();
const audio = new Audio(URL.createObjectURL(audioBlob));
audio.play();`;

  const pythonSnippet = `import requests

res = requests.post(
    "http://localhost:20128/api/tts/synthesize",
    json={
        "text": "${cleanTextForCode}",
        "voiceId": "${selectedVoiceId}",
        "speed": ${speed},
        "normalize": True
    }
)

with open("speech.wav", "wb") as f:
    f.write(res.content)`;

  const csharpSnippet = `using var client = new HttpClient();
var payload = new {
    text = "${cleanTextForCode}",
    voiceId = "${selectedVoiceId}",
    speed = ${speed}f,
    normalize = true
};

var response = await client.PostAsJsonAsync("http://localhost:20128/api/tts/synthesize", payload);
byte[] wavBytes = await response.Content.ReadAsByteArrayAsync();
await File.WriteAllBytesAsync("speech.wav", wavBytes);`;

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
              <span className="text-2xl">🎙️</span> Studio Giọng Nói AI Tiếng Việt
            </h1>
            <Badge variant="success">NGHI-TTS 100% Native</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Chuyển đổi văn bản thành giọng nói tiếng Việt tự nhiên • 18 Giọng Bắc - Trung - Nam •
            Chuẩn hóa số & tiền tệ tự động
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
                  Chọn Giọng Đọc ({voices.length || 18} Giọng)
                </label>
                <select
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.gender} - {v.region})
                    </option>
                  ))}
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
                  min="0.6"
                  max="1.6"
                  step="0.05"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
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
                  className="w-full text-xs font-semibold"
                >
                  {synthesizing ? "Đang xử lý..." : "⚡ Tạo Giọng Đọc"}
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

      {/* 18 Voice Gallery */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Thư Viện 18 Giọng Đọc Mẫu Tiếng Việt
            </h2>
            <p className="text-xs text-muted-foreground">
              Nghe thử tức thì 18 file âm thanh mẫu chất lượng cao 22.050Hz
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground"
            >
              <option value="">Tất cả vùng miền</option>
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
              className="p-4 border border-border flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-foreground text-sm">{v.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={v.gender === "Nữ" ? "error" : "primary"}>{v.gender}</Badge>
                    <Badge variant="secondary">{v.region}</Badge>
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
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSelectVoice(v.id)}
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
              <span>🔌</span> Tài Liệu Kết Nối API Giọng Nói (OmniRoute API)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tích hợp vào bất kỳ ứng dụng di động, web, hoặc bot AI qua HTTP REST tiêu chuẩn
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

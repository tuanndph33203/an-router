export interface VoiceInfo {
  id: string;
  name: string;
  gender: "Nam" | "Nữ";
  region: "Toàn quốc";
  description: string;
  sampleText: string;
  demoAudioUrl: string;
  engine: "google";
}

const RAW_VOICES: Omit<VoiceInfo, "sampleText" | "demoAudioUrl">[] = [
  {
    id: "google_vi",
    name: "Google Tiếng Việt",
    gender: "Nữ",
    region: "Toàn quốc",
    description: "Giọng đọc Google chuẩn xác, tự nhiên với độ trễ thấp",
    engine: "google",
  },
];

export function getAllVietnameseVoices(): VoiceInfo[] {
  return RAW_VOICES.map((v) => ({
    ...v,
    sampleText:
      "Xin chào! Đây là giọng đọc Google tiếng Việt tự nhiên được kết nối trực tiếp qua OmniRoute.",
    demoAudioUrl: `/api/tts/demos/${v.id}`,
  }));
}

export function findVoiceByIdOrName(voiceIdOrName?: string | null): VoiceInfo | null {
  const all = getAllVietnameseVoices();
  if (!voiceIdOrName || !voiceIdOrName.trim()) {
    return all[0] || null;
  }

  const query = voiceIdOrName.trim().toLowerCase();
  return (
    all.find((v) => v.id.toLowerCase() === query || v.name.toLowerCase() === query) ||
    all[0] ||
    null
  );
}

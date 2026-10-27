import fs from "node:fs";
import path from "node:path";

export interface VoiceInfo {
  id: string;
  modelKey: string;
  name: string;
  gender: "Nam" | "Nữ";
  region: "Miền Bắc" | "Miền Trung" | "Miền Nam" | "Toàn quốc";
  description: string;
  sampleText: string;
  demoAudioUrl: string;
  engine: "google" | "nghitts";
}

const RAW_VOICES: Omit<VoiceInfo, "sampleText" | "demoAudioUrl">[] = [
  // ── Google Voice Stream ─────────────────────────────────────────
  {
    id: "google_vi",
    modelKey: "Google Tiếng Việt",
    name: "Google Tiếng Việt",
    gender: "Nữ",
    region: "Toàn quốc",
    description: "Giọng đọc Google tự nhiên, phản hồi tức thì",
    engine: "google",
  },
  // ── 18 Giọng AI Tiếng Việt (Neural Engine) ────────────────
  {
    id: "ban_mai",
    modelKey: "Ban Mai",
    name: "Ban Mai",
    gender: "Nữ",
    region: "Miền Bắc",
    description: "Giọng nữ chuẩn biên tập viên truyền hình, ấm áp, rõ chữ",
    engine: "nghitts",
  },
  {
    id: "ngoc_huyen_moi",
    modelKey: "Ngọc Huyền (mới)",
    name: "Ngọc Huyền (Mới)",
    gender: "Nữ",
    region: "Miền Nam",
    description: "Giọng nữ miền Nam truyền cảm, chuyên đọc truyện và podcast",
    engine: "nghitts",
  },
  {
    id: "ngoc_ngan",
    modelKey: "Ngọc Ngạn",
    name: "Ngọc Ngạn",
    gender: "Nam",
    region: "Miền Bắc",
    description: "Giọng nam trầm ấm, kể chuyện đêm khuya giàu cảm xúc",
    engine: "nghitts",
  },
  {
    id: "tran_thanh",
    modelKey: "Trấn Thành",
    name: "Trấn Thành",
    gender: "Nam",
    region: "Miền Nam",
    description: "Giọng nam MC truyền cảm, nhấn nhá tự nhiên",
    engine: "nghitts",
  },
  {
    id: "my_tam",
    modelKey: "Mỹ Tâm",
    name: "Mỹ Tâm",
    gender: "Nữ",
    region: "Miền Trung",
    description: "Giọng nữ nhẹ nhàng, trong trẻo, tự nhiên",
    engine: "nghitts",
  },
  {
    id: "my_tam_real",
    modelKey: "Mỹ Tâm Real",
    name: "Mỹ Tâm Real",
    gender: "Nữ",
    region: "Miền Trung",
    description: "Giọng nữ cảm xúc thực tế, âm sắc rõ nét",
    engine: "nghitts",
  },
  {
    id: "viet_thao",
    modelKey: "Việt Thảo",
    name: "Việt Thảo",
    gender: "Nam",
    region: "Miền Nam",
    description: "Giọng nam kể chuyện đời thường, dí dỏm, thân thiện",
    engine: "nghitts",
  },
  {
    id: "duy_oryx",
    modelKey: "Duy Oryx",
    name: "Duy Oryx",
    gender: "Nam",
    region: "Miền Bắc",
    description: "Giọng nam trẻ trung, review công nghệ và tin tức",
    engine: "nghitts",
  },
  {
    id: "manh_dung",
    modelKey: "Mạnh Dũng",
    name: "Mạnh Dũng",
    gender: "Nam",
    region: "Miền Bắc",
    description: "Giọng nam phát thanh viên thời sự, đĩnh đạc",
    engine: "nghitts",
  },
  {
    id: "minh_quang",
    modelKey: "Minh Quang",
    name: "Minh Quang",
    gender: "Nam",
    region: "Miền Bắc",
    description: "Giọng nam thuyết minh tài liệu, báo cáo doanh nghiệp",
    engine: "nghitts",
  },
  {
    id: "mai_phuong",
    modelKey: "Mai Phương",
    name: "Mai Phương",
    gender: "Nữ",
    region: "Miền Bắc",
    description: "Giọng nữ trẻ trung, đọc thông báo và trợ lý ảo",
    engine: "nghitts",
  },
  {
    id: "chieu_thanh",
    modelKey: "Chiếu Thành",
    name: "Chiếu Thành",
    gender: "Nam",
    region: "Miền Nam",
    description: "Giọng nam trầm, đọc sách nói và tiểu thuyết",
    engine: "nghitts",
  },
  {
    id: "lac_phi",
    modelKey: "Lạc Phi",
    name: "Lạc Phi",
    gender: "Nam",
    region: "Miền Bắc",
    description: "Giọng nam review phim, tốc độ nhịp nhàng",
    engine: "nghitts",
  },
  {
    id: "thanh_phuong_viettel",
    modelKey: "Thanh Phương Viettel",
    name: "Thanh Phương",
    gender: "Nữ",
    region: "Miền Bắc",
    description: "Giọng nữ tổng đài viên CSKH tiêu chuẩn",
    engine: "nghitts",
  },
  {
    id: "phuong_trang",
    modelKey: "Phương Trang",
    name: "Phương Trang",
    gender: "Nữ",
    region: "Miền Nam",
    description: "Giọng nữ miền Nam dịu dàng, dẫn chương trình",
    engine: "nghitts",
  },
  {
    id: "thien_tam",
    modelKey: "Thiện Tâm",
    name: "Thiện Tâm",
    gender: "Nữ",
    region: "Miền Nam",
    description: "Giọng nữ đọc sách tâm linh, chữa lành, nhẹ nhàng",
    engine: "nghitts",
  },
  {
    id: "tai_an",
    modelKey: "Tài An",
    name: "Tài An",
    gender: "Nam",
    region: "Miền Bắc",
    description: "Giọng nam đọc điểm tin tài chính, kinh tế",
    engine: "nghitts",
  },
  {
    id: "minh_khang",
    modelKey: "Minh Khang",
    name: "Minh Khang",
    gender: "Nam",
    region: "Miền Nam",
    description: "Giọng nam miền Nam hiện đại, rõ ràng",
    engine: "nghitts",
  },
];

export function getAllVietnameseVoices(): VoiceInfo[] {
  const demosDir = path.join(process.cwd(), "public", "tts", "demos");

  return RAW_VOICES.map((v) => {
    let sampleText =
      v.engine === "google"
        ? `Xin chào! Đây là luồng giọng đọc Google với độ trễ thấp được forward trực tiếp qua OmniRoute.`
        : `Xin chào, đây là giọng đọc mẫu ${v.name} tích hợp trong OmniRoute.`;

    const txtPath = path.join(demosDir, `${v.id}_demo.txt`);

    if (fs.existsSync(txtPath)) {
      try {
        const content = fs.readFileSync(txtPath, "utf8").trim();
        if (content) sampleText = content;
      } catch {}
    }

    const demoAudioUrl =
      v.engine === "google" ? `/api/tts/demos/${v.id}` : `/tts/demos/${v.id}_demo.wav`;

    return {
      ...v,
      sampleText,
      demoAudioUrl,
    };
  });
}

export function findVoiceByIdOrName(voiceIdOrName?: string | null): VoiceInfo | null {
  const all = getAllVietnameseVoices();
  if (!voiceIdOrName || !voiceIdOrName.trim()) {
    return all[0] || null;
  }

  const query = voiceIdOrName.trim().toLowerCase();
  return (
    all.find(
      (v) =>
        v.id.toLowerCase() === query ||
        v.modelKey.toLowerCase() === query ||
        v.name.toLowerCase() === query
    ) ||
    all[0] ||
    null
  );
}

import fs from "node:fs";
import path from "node:path";

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

class TextNormalizerEngine {
  private acronyms = new Map<string, string>();
  private loanWords = new Map<string, string>();
  private initialized = false;

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    const baseDir = path.join(process.cwd(), "config", "tts");
    this.loadCsv(path.join(baseDir, "acronyms.csv"), this.acronyms);
    this.loadCsv(path.join(baseDir, "non-vietnamese-words.csv"), this.loanWords);
  }

  private loadCsv(filePath: string, target: Map<string, string>) {
    if (!fs.existsSync(filePath)) return;
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const commaIdx = line.indexOf(",");
        if (commaIdx <= 0 || commaIdx >= line.length - 1) continue;
        const key = line.substring(0, commaIdx).trim().toLowerCase();
        const val = line.substring(commaIdx + 1).trim();
        if (key && val) target.set(key, val);
      }
    } catch {}
  }

  public normalize(input: string): string {
    this.init();
    if (!input || !input.trim()) return "";

    const normalizedUnicode = input.normalize("NFC");
    const lines = normalizedUnicode.split("\n");
    const processedLines: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const rawTokens = this.splitTokensPreservingPunctuation(line);
      const outTokens: string[] = [];

      for (const token of rawTokens) {
        let processedToken = this.processToken(token);
        if (outTokens.length > 0) {
          const prev = outTokens[outTokens.length - 1].toLowerCase();
          if (prev === "ngày" && processedToken.toLowerCase().startsWith("ngày ")) {
            processedToken = processedToken.substring(5);
          } else if (prev === "tháng" && processedToken.toLowerCase().startsWith("tháng ")) {
            processedToken = processedToken.substring(6);
          }
        }
        outTokens.push(processedToken);
      }

      processedLines.push(this.collapseSpaces(outTokens.join(" ")));
    }

    return processedLines.join(". ");
  }

  public chunkText(text: string, maxWordsPerChunk = 32): string[] {
    const result: string[] = [];
    if (!text || !text.trim()) return result;

    const sentences = this.splitSentences(text);
    let currentChunkWords: string[] = [];

    for (const sentence of sentences) {
      const words = sentence.split(" ").filter(Boolean);
      if (words.length === 0) continue;

      if (
        currentChunkWords.length > 0 &&
        currentChunkWords.length + words.length > maxWordsPerChunk
      ) {
        result.push(currentChunkWords.join(" "));
        currentChunkWords = [];
      }

      if (words.length > maxWordsPerChunk) {
        for (let i = 0; i < words.length; i += maxWordsPerChunk) {
          result.push(words.slice(i, i + maxWordsPerChunk).join(" "));
        }
      } else {
        currentChunkWords.push(...words);
      }
    }

    if (currentChunkWords.length > 0) {
      result.push(currentChunkWords.join(" "));
    }

    return result;
  }

  private processToken(token: string): string {
    const trimmed = token.trim();
    if (!trimmed) return "";

    let prefix = "";
    let suffix = "";
    let core = trimmed;

    while (core.length > 0 && this.isPunctuation(core[0])) {
      prefix += core[0];
      core = core.substring(1);
    }

    while (core.length > 0 && this.isPunctuation(core[core.length - 1])) {
      suffix = core[core.length - 1] + suffix;
      core = core.substring(0, core.length - 1);
    }

    if (!core) return trimmed;

    const lower = core.toLowerCase();
    if (this.acronyms.has(lower)) {
      return prefix + this.acronyms.get(lower) + suffix;
    }
    if (this.loanWords.has(lower)) {
      return prefix + this.loanWords.get(lower) + suffix;
    }

    if (this.isDate(core)) {
      return prefix + this.convertDate(core) + suffix;
    }
    if (this.isTime(core)) {
      return prefix + this.convertTime(core) + suffix;
    }
    if (this.isPercentage(core)) {
      return prefix + this.convertPercentage(core) + suffix;
    }
    if (this.isCurrency(core)) {
      return prefix + this.convertCurrency(core) + suffix;
    }
    if (this.isPureNumber(core)) {
      return prefix + this.convertNumber(core) + suffix;
    }

    return prefix + core + suffix;
  }

  private splitTokensPreservingPunctuation(line: string): string[] {
    const tokens: string[] = [];
    let current = "";

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === " " || c === "\t") {
        if (current) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += c;
      }
    }
    if (current) tokens.push(current);
    return tokens;
  }

  private isPunctuation(c: string): boolean {
    return [
      ".",
      ",",
      ";",
      "!",
      "?",
      '"',
      "'",
      "(",
      ")",
      "[",
      "]",
      "{",
      "}",
      "-",
      "_",
      ":",
    ].includes(c);
  }

  private isPureNumber(s: string): boolean {
    let hasDigit = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c >= "0" && c <= "9") hasDigit = true;
      else if (c !== "." && c !== ",") return false;
    }
    return hasDigit;
  }

  private isDate(s: string): boolean {
    const parts = s.split("/");
    if (parts.length === 3 || parts.length === 2) {
      return parts.every((p) => p.length > 0 && this.isAllDigits(p));
    }
    return false;
  }

  private convertDate(s: string): string {
    const parts = s.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return `ngày ${this.convertInteger(day)} tháng ${this.convertInteger(month)} năm ${this.convertInteger(year)}`;
    }
    if (parts.length === 2) {
      const month = parseInt(parts[0], 10);
      const year = parseInt(parts[1], 10);
      return `tháng ${this.convertInteger(month)} năm ${this.convertInteger(year)}`;
    }
    return s;
  }

  private isTime(s: string): boolean {
    const parts = s.split(":");
    if (parts.length === 2 || parts.length === 3) {
      return parts.every((p) => p.length > 0 && this.isAllDigits(p));
    }
    return false;
  }

  private convertTime(s: string): string {
    const parts = s.split(":");
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    let res = `${this.convertInteger(hour)} giờ`;
    if (minute > 0) res += ` ${this.convertInteger(minute)} phút`;
    return res;
  }

  private isPercentage(s: string): boolean {
    return s.endsWith("%") && this.isPureNumber(s.substring(0, s.length - 1));
  }

  private convertPercentage(s: string): string {
    const numPart = s.substring(0, s.length - 1);
    return `${this.convertNumber(numPart)} phần trăm`;
  }

  private isCurrency(s: string): boolean {
    const lower = s.toLowerCase();
    if (lower.endsWith("đ") || lower.endsWith("vnd") || lower.startsWith("$")) {
      let num = lower;
      if (num.endsWith("vnd")) num = num.substring(0, num.length - 3);
      else if (num.endsWith("đ")) num = num.substring(0, num.length - 1);
      else if (num.startsWith("$")) num = num.substring(1);
      return this.isPureNumber(num);
    }
    return false;
  }

  private convertCurrency(s: string): string {
    const lower = s.toLowerCase();
    if (lower.startsWith("$")) {
      const num = lower.substring(1);
      return `${this.convertNumber(num)} đô la`;
    }
    if (lower.endsWith("vnd")) {
      const num = lower.substring(0, lower.length - 3);
      return `${this.convertNumber(num)} đồng`;
    }
    if (lower.endsWith("đ")) {
      const num = lower.substring(0, lower.length - 1);
      return `${this.convertNumber(num)} đồng`;
    }
    return s;
  }

  private convertNumber(s: string): string {
    if (s.includes(",") && !s.includes(".")) {
      const parts = s.split(",");
      if (parts.length === 2 && this.isAllDigits(parts[0]) && this.isAllDigits(parts[1])) {
        return `${this.convertInteger(parseInt(parts[0], 10))} phẩy ${this.convertDigitsSequence(parts[1])}`;
      }
    }

    const clean = s.split(".").join("").split(",").join("");
    if (this.isAllDigits(clean)) {
      return this.convertInteger(parseInt(clean, 10));
    }
    return s;
  }

  private convertDigitsSequence(s: string): string {
    return s
      .split("")
      .map((c) => DIGITS[parseInt(c, 10)] || c)
      .join(" ");
  }

  private convertInteger(n: number): string {
    if (n === 0) return "không";
    if (n < 0) return "âm " + this.convertInteger(-n);

    const billion = Math.floor(n / 1000000000);
    let rem = n % 1000000000;
    const million = Math.floor(rem / 1000000);
    rem = rem % 1000000;
    const thousand = Math.floor(rem / 1000);
    const unit = rem % 1000;

    const parts: string[] = [];
    if (billion > 0) parts.push(this.readThreeDigits(billion, false) + " tỷ");
    if (million > 0) parts.push(this.readThreeDigits(million, billion > 0) + " triệu");
    if (thousand > 0)
      parts.push(this.readThreeDigits(thousand, billion > 0 || million > 0) + " nghìn");
    if (unit > 0)
      parts.push(this.readThreeDigits(unit, billion > 0 || million > 0 || thousand > 0));

    return parts.join(" ").trim();
  }

  private readThreeDigits(n: number, hasHigher: boolean): string {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    const parts: string[] = [];

    if (h > 0 || hasHigher) parts.push(DIGITS[h] + " trăm");

    if (t > 1) {
      parts.push(DIGITS[t] + " mươi");
      if (u === 1) parts.push("mốt");
      else if (u === 5) parts.push("lăm");
      else if (u > 0) parts.push(DIGITS[u]);
    } else if (t === 1) {
      parts.push("mười");
      if (u === 5) parts.push("lăm");
      else if (u > 0) parts.push(DIGITS[u]);
    } else if (t === 0 && u > 0) {
      if (h > 0 || hasHigher) parts.push("lẻ");
      parts.push(DIGITS[u]);
    }

    return parts.join(" ");
  }

  private isAllDigits(s: string): boolean {
    if (!s) return false;
    for (let i = 0; i < s.length; i++) {
      if (s[i] < "0" || s[i] > "9") return false;
    }
    return true;
  }

  private splitSentences(text: string): string[] {
    const res: string[] = [];
    let cur = "";
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      cur += c;
      if (c === "." || c === "!" || c === "?" || c === "\n") {
        if (cur.trim()) res.push(cur.trim());
        cur = "";
      }
    }
    if (cur.trim()) res.push(cur.trim());
    return res;
  }

  private collapseSpaces(s: string): string {
    return s.split(" ").filter(Boolean).join(" ");
  }
}

export const vietnameseNormalizer = new TextNormalizerEngine();

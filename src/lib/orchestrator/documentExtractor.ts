import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

/**
 * Trích xuất nội dung văn bản thuần túy từ buffer file với nhiều định dạng:
 * - PDF (.pdf) -> pdftotext -layout
 * - Word (.docx) -> Python zipfile + XML parser (chuẩn, không lỗi font, giữ bảng)
 * - Word cũ (.doc) -> soffice / libreoffice
 * - Text (.md, .markdown, .txt, .json, .csv) -> Buffer toString('utf-8')
 *
 * Tuyệt đối không dùng Regex cố định.
 */
export async function extractTextFromDocumentBuffer(
  buffer: Buffer,
  fileName: string
): Promise<{ text: string; format: string }> {
  const lowerName = fileName.toLowerCase().trim();
  const tempDir = os.tmpdir();
  const safeBase = `doc_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  // 1. Định dạng Text thuần
  if (
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".csv")
  ) {
    return {
      text: buffer.toString("utf-8"),
      format: "text",
    };
  }

  // 2. Định dạng PDF
  if (lowerName.endsWith(".pdf")) {
    const tempPdfPath = path.join(tempDir, `${safeBase}.pdf`);
    try {
      fs.writeFileSync(tempPdfPath, buffer);
      // Dùng pdftotext -layout để bảo toàn bảng biểu ngang dọc
      const stdout = execFileSync("/usr/bin/pdftotext", ["-layout", tempPdfPath, "-"], {
        encoding: "utf-8",
        maxBuffer: 30 * 1024 * 1024,
        timeout: 30000,
      });
      return {
        text: stdout || "",
        format: "pdf",
      };
    } catch (err: any) {
      console.warn(`[DocumentExtractor] pdftotext failed for ${fileName}:`, err?.message || err);
      // Fallback: nếu lỗi, thử đọc chuỗi UTF-8 thông thường
      return {
        text: buffer.toString("utf-8"),
        format: "pdf_fallback",
      };
    } finally {
      if (fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath);
        } catch {}
      }
    }
  }

  // 3. Định dạng Word (.docx)
  if (lowerName.endsWith(".docx")) {
    const tempDocxPath = path.join(tempDir, `${safeBase}.docx`);
    try {
      fs.writeFileSync(tempDocxPath, buffer);
      const pythonScript = `
import zipfile, xml.etree.ElementTree as ET, sys

docx_path = sys.argv[1]
try:
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read('word/document.xml')
        root = ET.fromstring(xml_content)
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        output = []
        for p in root.iterfind('.//w:p', ns):
            texts = [t.text for t in p.iterfind('.//w:t', ns) if t.text]
            if texts:
                output.append(''.join(texts))
        print('\\n'.join(output))
except Exception as e:
    sys.exit(1)
`;
      const stdout = execFileSync("/usr/bin/python3", ["-c", pythonScript, tempDocxPath], {
        encoding: "utf-8",
        maxBuffer: 30 * 1024 * 1024,
        timeout: 30000,
      });
      return {
        text: stdout || "",
        format: "docx",
      };
    } catch (err: any) {
      console.warn(`[DocumentExtractor] docx extraction failed for ${fileName}:`, err?.message || err);
      return {
        text: buffer.toString("utf-8"),
        format: "docx_fallback",
      };
    } finally {
      if (fs.existsSync(tempDocxPath)) {
        try {
          fs.unlinkSync(tempDocxPath);
        } catch {}
      }
    }
  }

  // 4. Định dạng Word cũ (.doc)
  if (lowerName.endsWith(".doc")) {
    const tempDocPath = path.join(tempDir, `${safeBase}.doc`);
    try {
      fs.writeFileSync(tempDocPath, buffer);
      execFileSync(
        "/usr/bin/soffice",
        ["--headless", "--convert-to", "txt:Text", "--outdir", tempDir, tempDocPath],
        { timeout: 30000 }
      );
      const outputTxtPath = path.join(tempDir, `${safeBase}.txt`);
      if (fs.existsSync(outputTxtPath)) {
        const text = fs.readFileSync(outputTxtPath, "utf-8");
        try {
          fs.unlinkSync(outputTxtPath);
        } catch {}
        return { text, format: "doc" };
      }
    } catch (err: any) {
      console.warn(`[DocumentExtractor] doc conversion failed for ${fileName}:`, err?.message || err);
    } finally {
      if (fs.existsSync(tempDocPath)) {
        try {
          fs.unlinkSync(tempDocPath);
        } catch {}
      }
    }
  }

  // Mặc định
  return {
    text: buffer.toString("utf-8"),
    format: "unknown",
  };
}

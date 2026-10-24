"use client";

import { useState, useEffect, useRef } from "react";
import { Modal, Input, Button, Textarea } from "@/shared/components";
import type { AppItem } from "./AppsTable";

interface RuleBookItem {
  id: string;
  name: string;
  fileName: string;
}

interface AppConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: AppItem | null;
  ruleBooks: RuleBookItem[];
  onSaved: () => void;
  onDeleted: (deletedKey: string) => void;
}

export function AppConfigModal({
  isOpen,
  onClose,
  app,
  ruleBooks,
  onSaved,
  onDeleted,
}: AppConfigModalProps) {
  const isEditing = Boolean(app);
  const [activeTab, setActiveTab] = useState<"network" | "capabilities" | "persona">("network");

  // Form Fields
  const [name, setName] = useState("");
  const [microsoftClientKey, setMicrosoftClientKey] = useState("");
  const [baseApiUrl, setBaseApiUrl] = useState("");
  const [swaggerUrl, setSwaggerUrl] = useState("");
  const [supportsApi, setSupportsApi] = useState(true);
  const [supportsSql, setSupportsSql] = useState(false);
  const [schemaUrl, setSchemaUrl] = useState("");
  const [sqlEndpoint, setSqlEndpoint] = useState("/api/ai-report/execute-sql");
  const [ruleFiles, setRuleFiles] = useState<string[]>([]);
  const [availableRuleBooks, setAvailableRuleBooks] = useState<RuleBookItem[]>(ruleBooks);
  const [selectedRuleToAdd, setSelectedRuleToAdd] = useState("");
  const [isUploadingRules, setIsUploadingRules] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Kho Kiến thức Nghiệp vụ trong SQLite DB (dùng cho Luồng Search Nghiệp Vụ)
  const [knowledgeDocs, setKnowledgeDocs] = useState<
    Array<{
      id: string;
      folderName: string;
      docName: string;
      relativePath: string;
      chunkCount: number;
      updatedAt: string;
    }>
  >([]);
  const [knowledgeFolders, setKnowledgeFolders] = useState<string[]>([]);
  const [totalKnowledgeChunks, setTotalKnowledgeChunks] = useState(0);
  const [isUploadingKnowledgeDb, setIsUploadingKnowledgeDb] = useState(false);
  const [knowledgeDbMessage, setKnowledgeDbMessage] = useState<string | null>(null);
  const knowledgeFileInputRef = useRef<HTMLInputElement | null>(null);
  const knowledgeFolderInputRef = useRef<HTMLInputElement | null>(null);

  const splitRuleListWithoutRegex = (raw: string): string[] => {
    const out: string[] = [];
    for (const line of raw.split("\n")) {
      for (const part of line.split(",")) {
        for (const item of part.split(";")) {
          const trimmed = item.trim();
          if (trimmed) out.push(trimmed);
        }
      }
    }
    return out;
  };

  const fetchKnowledgeDbStatus = async (targetKey: string) => {
    const cleanKey = (targetKey || "").trim().toLowerCase();
    if (!cleanKey) {
      setKnowledgeDocs([]);
      setKnowledgeFolders([]);
      setTotalKnowledgeChunks(0);
      return;
    }
    try {
      const res = await fetch(`/api/orchestrator/knowledge?appId=${encodeURIComponent(cleanKey)}`);
      if (res.ok) {
        const json = await res.json();
        const data = json?.Data;
        if (data) {
          setKnowledgeDocs(Array.isArray(data.documents) ? data.documents : []);
          setKnowledgeFolders(Array.isArray(data.folders) ? data.folders : []);
          setTotalKnowledgeChunks(Number(data.totalChunks || 0));
        }
      }
    } catch {
      // ignore
    }
  };

  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [suggestions, setSuggestions] = useState("");

  // Saving / Deleting State
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Ping Swagger State
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    success: boolean;
    status?: number;
    message: string;
    totalEndpoints?: number;
    title?: string;
  } | null>(null);

  // Test Report Schema State
  const [isTestingSchema, setIsTestingSchema] = useState(false);
  const [schemaTestResult, setSchemaTestResult] = useState<{
    success: boolean;
    status?: number;
    message: string;
    tableCount?: number;
    sampleTables?: string[];
  } | null>(null);

  useEffect(() => {
    setAvailableRuleBooks(ruleBooks);
  }, [ruleBooks]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("network");
    setPingResult(null);
    setSchemaTestResult(null);
    setSaveSuccess(false);
    setUploadSuccessMessage(null);
    setSelectedRuleToAdd("");

    if (app) {
      setName(app.name);
      setMicrosoftClientKey(app.microsoftClientKey || "");
      setBaseApiUrl(app.baseApiUrl || "");
      setSwaggerUrl(app.swaggerEndpointUrl || "");
      setSupportsApi(app.capabilities?.includes("api") ?? true);
      setSupportsSql(app.capabilities?.includes("sql") ?? false);
      setSchemaUrl(app.schemaEndpointUrl || "");
      setSqlEndpoint(app.sqlExecuteEndpoint || "/api/ai-report/execute-sql");

      // Nạp danh sách file quy chuẩn từ ruleFiles hoặc rulePath
      let initialFiles: string[] = [];
      const rawRule = app.ruleFiles || app.rulePath || "";
      if (Array.isArray(rawRule)) {
        initialFiles = rawRule.map((s) => String(s).trim()).filter(Boolean);
      } else if (typeof rawRule === "string" && rawRule.trim()) {
        try {
          if (rawRule.trim().startsWith("[")) {
            initialFiles = JSON.parse(rawRule);
          } else {
            initialFiles = splitRuleListWithoutRegex(rawRule);
          }
        } catch {
          initialFiles = splitRuleListWithoutRegex(rawRule);
        }
      }
      setRuleFiles(initialFiles);
      setKnowledgeDbMessage(null);
      void fetchKnowledgeDbStatus(app.microsoftClientKey || "");

      setWelcomeMsg(app.welcomeMessage || "");
      setSuggestions(app.quickSuggestions ? app.quickSuggestions.join("\n") : "");
    } else {
      setName("");
      setMicrosoftClientKey("");
      setBaseApiUrl("http://localhost:");
      setSwaggerUrl("");
      setSupportsApi(true);
      setSupportsSql(false);
      setSchemaUrl("");
      setSqlEndpoint("/api/ai-report/execute-sql");
      setRuleFiles([]);
      setKnowledgeDocs([]);
      setKnowledgeFolders([]);
      setTotalKnowledgeChunks(0);
      setKnowledgeDbMessage(null);
      setWelcomeMsg("");
      setSuggestions("");
    }
  }, [isOpen, app]);

  // Thêm file từ danh sách có sẵn trong hệ thống
  const handleAddExistingRule = (fileNameToAdd?: string) => {
    const file = (fileNameToAdd || selectedRuleToAdd).trim();
    if (!file) return;
    if (ruleFiles.some((f) => f.toLowerCase() === file.toLowerCase())) {
      alert(`File "${file}" đã có trong danh sách.`);
      return;
    }
    setRuleFiles((prev) => [...prev, file]);
    setSelectedRuleToAdd("");
  };

  // Gỡ bỏ 1 file khỏi danh sách
  const handleRemoveRuleFile = (fileToRemove: string) => {
    setRuleFiles((prev) => prev.filter((f) => f.toLowerCase() !== fileToRemove.toLowerCase()));
  };

  // Xóa toàn bộ file
  const handleClearAllRules = () => {
    setRuleFiles([]);
  };

  // Tải file trực tiếp từ máy tính lên
  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingRules(true);
    setUploadSuccessMessage(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const res = await fetch("/api/rules/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.Message || `Lỗi tải file (HTTP ${res.status})`);
      }

      const resData = await res.json();
      const uploadedFileNames: string[] = resData?.Data?.fileNames || [];

      if (uploadedFileNames.length > 0) {
        setRuleFiles((prev) => {
          const set = new Set(prev.map((f) => f.toLowerCase()));
          const next = [...prev];
          uploadedFileNames.forEach((n) => {
            if (!set.has(n.toLowerCase())) {
              set.add(n.toLowerCase());
              next.push(n);
            }
          });
          return next;
        });

        setUploadSuccessMessage(
          `Đã tải lên và gán thành công ${uploadedFileNames.length} file quy chuẩn vào ứng dụng!`
        );

        // Đồng bộ lại danh mục Rule Books có sẵn
        try {
          const syncRes = await fetch("/api/rules?sync=true");
          if (syncRes.ok) {
            const syncJson = await syncRes.json();
            if (Array.isArray(syncJson.Data)) {
              setAvailableRuleBooks(syncJson.Data);
            }
          }
        } catch {}
      }
    } catch (err: any) {
      alert(`Không thể tải file lên: ${err?.message || err}`);
    } finally {
      setIsUploadingRules(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Nạp trực tiếp Folder hoặc File vào bảng SQLite DB Kiến thức (`knowledge_documents` & `knowledge_chunks`)
  const handleKnowledgeDbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const cleanAppKey = microsoftClientKey.trim().toLowerCase();
    if (!cleanAppKey) {
      alert(
        "Vui lòng nhập 'Định Danh Ứng Dụng (App / Client Key)' ở Tab 1 trước khi nạp kiến thức vào DB."
      );
      return;
    }

    setIsUploadingKnowledgeDb(true);
    setKnowledgeDbMessage(null);

    try {
      const formData = new FormData();
      formData.append("appId", cleanAppKey);

      Array.from(files).forEach((file: any) => {
        formData.append("files", file);
        const relPath =
          typeof file.webkitRelativePath === "string" && file.webkitRelativePath.trim()
            ? file.webkitRelativePath.trim()
            : file.name;
        formData.append("relativePaths", relPath);
      });

      const res = await fetch("/api/orchestrator/knowledge", {
        method: "POST",
        body: formData,
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson?.Message || `Lỗi nạp kiến thức vào DB (HTTP ${res.status})`);
      }

      const data = resJson?.Data;
      if (data) {
        setKnowledgeDocs(Array.isArray(data.documents) ? data.documents : []);
        setKnowledgeFolders(Array.isArray(data.folders) ? data.folders : []);
        setTotalKnowledgeChunks(Number(data.totalChunks || 0));
      }
      setKnowledgeDbMessage(
        resJson?.Message || "Đã nạp tài liệu trực tiếp vào SQLite DB Kiến thức thành công!"
      );
    } catch (err: any) {
      alert(`Không thể nạp tài liệu vào DB Kiến thức: ${err?.message || err}`);
    } finally {
      setIsUploadingKnowledgeDb(false);
      if (knowledgeFileInputRef.current) knowledgeFileInputRef.current.value = "";
      if (knowledgeFolderInputRef.current) knowledgeFolderInputRef.current.value = "";
    }
  };

  const handleDeleteKnowledgeDoc = async (docId: string) => {
    const cleanAppKey = microsoftClientKey.trim().toLowerCase();
    if (!cleanAppKey) return;
    try {
      const res = await fetch(
        `/api/orchestrator/knowledge?appId=${encodeURIComponent(cleanAppKey)}&docId=${docId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        const json = await res.json();
        const data = json?.Data;
        if (data) {
          setKnowledgeDocs(Array.isArray(data.documents) ? data.documents : []);
          setKnowledgeFolders(Array.isArray(data.folders) ? data.folders : []);
          setTotalKnowledgeChunks(Number(data.totalChunks || 0));
        }
      }
    } catch {}
  };

  const handleDeleteKnowledgeFolder = async (folderName: string) => {
    const cleanAppKey = microsoftClientKey.trim().toLowerCase();
    if (!cleanAppKey) return;
    try {
      const res = await fetch(
        `/api/orchestrator/knowledge?appId=${encodeURIComponent(cleanAppKey)}&folderName=${encodeURIComponent(folderName)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        const json = await res.json();
        const data = json?.Data;
        if (data) {
          setKnowledgeDocs(Array.isArray(data.documents) ? data.documents : []);
          setKnowledgeFolders(Array.isArray(data.folders) ? data.folders : []);
          setTotalKnowledgeChunks(Number(data.totalChunks || 0));
        }
      }
    } catch {}
  };

  const handleClearAllKnowledgeDb = async () => {
    const cleanAppKey = microsoftClientKey.trim().toLowerCase();
    if (!cleanAppKey) return;
    try {
      const res = await fetch(
        `/api/orchestrator/knowledge?appId=${encodeURIComponent(cleanAppKey)}&clearAll=true`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setKnowledgeDocs([]);
        setKnowledgeFolders([]);
        setTotalKnowledgeChunks(0);
      }
    } catch {}
  };

  const handleTestSwagger = async () => {
    if (!swaggerUrl.trim()) {
      setPingResult({
        success: false,
        message: "Vui lòng nhập Swagger / OpenAPI Endpoint URL trước khi kiểm tra.",
      });
      return;
    }

    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await fetch(swaggerUrl.trim(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        setPingResult({
          success: false,
          status: res.status,
          message: `Máy chủ phản hồi HTTP ${res.status}. Vui lòng kiểm tra lại địa chỉ cổng hoặc cấu hình CORS.`,
        });
      } else {
        const doc = await res.json();
        const pathsCount = doc.paths ? Object.keys(doc.paths).length : 0;
        setPingResult({
          success: true,
          status: res.status,
          title: doc.info?.title || name || "API Service",
          totalEndpoints: pathsCount,
          message: `Kết nối thành công! Đã định vị ${pathsCount} API endpoint sẵn sàng cho AI điều phối.`,
        });
      }
    } catch (err: any) {
      setPingResult({
        success: false,
        message: `Không thể kết nối: ${err?.message || err}. Đảm bảo backend đang chạy.`,
      });
    } finally {
      setIsPinging(false);
    }
  };

  const handleTestReportSchema = async () => {
    if (!schemaUrl.trim()) {
      setSchemaTestResult({
        success: false,
        message: "Vui lòng nhập Schema Catalog Endpoint URL trước khi kiểm tra.",
      });
      return;
    }

    setIsTestingSchema(true);
    setSchemaTestResult(null);

    try {
      const res = await fetch("/api/orchestrator/test-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaUrl: schemaUrl.trim(),
          applicationId: appId.trim() || "PRO_ERP",
        }),
      });

      const json = await res.json();
      setSchemaTestResult(json);
    } catch (err: any) {
      setSchemaTestResult({
        success: false,
        message: `Lỗi kết nối tới máy chủ báo cáo: ${err?.message || err}`,
      });
    } finally {
      setIsTestingSchema(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !microsoftClientKey.trim() || !baseApiUrl.trim()) {
      alert("Vui lòng nhập đầy đủ Tên ứng dụng, Microsoft Client Key và Base API URL.");
      return;
    }

    setIsSaving(true);
    try {
      const capabilities: Array<"api" | "sql" | "workflow"> = [];
      if (supportsApi) capabilities.push("api");
      if (supportsSql) capabilities.push("sql");

      const quickSuggestions = suggestions
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const payload = {
        name: name.trim(),
        microsoftClientKey: microsoftClientKey.trim(),
        baseApiUrl: baseApiUrl.trim(),
        swaggerEndpointUrl: swaggerUrl.trim() || undefined,
        capabilities,
        schemaEndpointUrl: supportsSql ? schemaUrl.trim() || undefined : undefined,
        sqlExecuteEndpoint: supportsSql ? sqlEndpoint.trim() || undefined : undefined,
        rulePath: ruleFiles.length > 0 ? ruleFiles.join(", ") : undefined,
        ruleFiles: ruleFiles,
        welcomeMessage: welcomeMsg.trim() || undefined,
        quickSuggestions,
      };

      const res = await fetch("/api/orchestrator/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => {
          onSaved();
          onClose();
        }, 600);
      } else {
        const err = await res.json();
        alert(`Lỗi khi lưu cấu hình: ${err?.Message || "Thất bại"}`);
      }
    } catch (err: any) {
      alert(`Lỗi hệ thống: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!app) return;
    const clientKey = app.microsoftClientKey || "";
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ứng dụng "${app.name}" (${clientKey})?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/orchestrator/apps?microsoftClientKey=${encodeURIComponent(clientKey)}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        onDeleted(clientKey);
        onClose();
      } else {
        const err = await res.json();
        alert(`Không thể xóa: ${err?.Message || "Thất bại"}`);
      }
    } catch (err: any) {
      alert(`Lỗi: ${err?.message || err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Cấu Hình Ứng Dụng: ${name || app?.name}` : "Thêm Mới Ứng Dụng Hệ Thống"}
      size="full"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {isEditing && (
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="gap-1.5 text-xs font-medium"
              >
                <span className="material-symbols-outlined text-sm">
                  {isDeleting ? "progress_activity" : "delete"}
                </span>
                {isDeleting ? "Đang xóa..." : "Xóa Ứng Dụng"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs font-medium"
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <span className="material-symbols-outlined text-sm">
                {isSaving ? "progress_activity" : saveSuccess ? "check" : "save"}
              </span>
              {isSaving ? "Đang lưu..." : saveSuccess ? "Đã lưu!" : "Lưu Cấu Hình"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="w-full space-y-6 max-w-4xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-border text-xs">
          <button
            onClick={() => setActiveTab("network")}
            className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "network"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-base">dns</span>
            Máy chủ & OpenAPI
          </button>
          <button
            onClick={() => setActiveTab("capabilities")}
            className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "capabilities"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-base">extension</span>
            Quyền năng (API & SQL)
          </button>
          <button
            onClick={() => setActiveTab("persona")}
            className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "persona"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-base">smart_toy</span>
            Quy chuẩn & Lời chào
          </button>
        </div>

        {/* TAB 1: Máy chủ & OpenAPI */}
        {activeTab === "network" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-text-main block mb-1">
                  Tên Ứng Dụng <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Ví dụ: AnPOS Bán Hàng, An CMMS Bảo Trì, ERP..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-main block mb-1">
                  Microsoft Client Key (SSO / App Key) <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Ví dụ: 232FB9D1-D0B8-413C-871C-45C280BBF94F"
                  value={microsoftClientKey}
                  disabled={isEditing}
                  onChange={(e) => setMicrosoftClientKey(e.target.value)}
                  className="font-mono text-xs uppercase"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-main block mb-1">
                Base API URL (Máy chủ Backend) <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="http://localhost:5077 hoặc http://10.8.101.99:8080"
                value={baseApiUrl}
                onChange={(e) => setBaseApiUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-main">
                  Swagger / OpenAPI Endpoint URL
                </label>
                <button
                  type="button"
                  onClick={handleTestSwagger}
                  disabled={isPinging}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isPinging ? "progress_activity" : "network_ping"}
                  </span>
                  {isPinging ? "Đang ping..." : "Kiểm tra kết nối"}
                </button>
              </div>

              <Input
                placeholder="http://localhost:5077/swagger/v1/swagger.json"
                value={swaggerUrl}
                onChange={(e) => setSwaggerUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {/* Hộp hiển thị kết quả Ping */}
            {pingResult && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  pingResult.success
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  <span className="material-symbols-outlined text-base">
                    {pingResult.success ? "check_circle" : "cancel"}
                  </span>
                  <span>{pingResult.success ? "KẾT NỐI THÀNH CÔNG" : "KẾT NỐI THẤT BẠI"}</span>
                </div>
                <p>{pingResult.message}</p>
                {pingResult.totalEndpoints !== undefined && (
                  <p className="mt-1 font-mono text-[11px]">
                    Dịch vụ: <strong>{pingResult.title}</strong> | Tổng số endpoint:{" "}
                    <strong>{pingResult.totalEndpoints}</strong>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Quyền năng (Capabilities) */}
        {activeTab === "capabilities" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Gọi API */}
              <div
                onClick={() => setSupportsApi(!supportsApi)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  supportsApi
                    ? "bg-indigo-500/5 border-indigo-500/40 ring-1 ring-indigo-500/20"
                    : "bg-surface border-border hover:border-border-hover opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500">api</span>
                    <span className="font-semibold text-xs text-text-main">
                      Điều phối OpenAPI (REST API)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={supportsApi}
                    onChange={(e) => setSupportsApi(e.target.checked)}
                    className="size-4 rounded accent-indigo-600"
                  />
                </div>
                <p className="text-[11px] text-text-muted">
                  Cho phép AI đọc tài liệu Swagger/OpenAPI để tự sinh tham số và gọi các endpoint
                  tạo, sửa, xóa dữ liệu nghiệp vụ.
                </p>
              </div>

              {/* Option 2: Truy vấn SQL */}
              <div
                onClick={() => setSupportsSql(!supportsSql)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  supportsSql
                    ? "bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/20"
                    : "bg-surface border-border hover:border-border-hover opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500">database</span>
                    <span className="font-semibold text-xs text-text-main">
                      Truy vấn Báo cáo Động (SQL DB)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={supportsSql}
                    onChange={(e) => setSupportsSql(e.target.checked)}
                    className="size-4 rounded accent-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-text-muted">
                  Cho phép AI trích xuất Schema Catalog, sinh câu lệnh SQL an toàn chỉ đọc (NOLOCK)
                  và kết xuất bảng biểu / Excel.
                </p>
              </div>
            </div>

            {/* Các trường cấu hình bổ sung khi bật SQL */}
            {supportsSql && (
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <span className="material-symbols-outlined text-base">tune</span>
                  Cấu Hình Endpoint Dành Riêng Cho Báo Cáo SQL
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-text-main">
                        Schema Catalog Endpoint URL
                      </label>
                      <button
                        type="button"
                        onClick={handleTestReportSchema}
                        disabled={isTestingSchema}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {isTestingSchema ? "progress_activity" : "database"}
                        </span>
                        {isTestingSchema ? "Đang kiểm tra..." : "Test kết nối"}
                      </button>
                    </div>
                    <Input
                      placeholder="http://localhost:5001/api/ai-report/schema"
                      value={schemaUrl}
                      onChange={(e) => setSchemaUrl(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-text-main block mb-1">
                      SQL Execution Path
                    </label>
                    <Input
                      placeholder="/api/ai-report/execute-sql"
                      value={sqlEndpoint}
                      onChange={(e) => setSqlEndpoint(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Hộp hiển thị kết quả Test Schema Báo Cáo */}
                {schemaTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      schemaTestResult.success
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <span className="material-symbols-outlined text-base">
                        {schemaTestResult.success ? "check_circle" : "cancel"}
                      </span>
                      <span>
                        {schemaTestResult.success
                          ? "KẾT NỐI BÁO CÁO THÀNH CÔNG"
                          : "KẾT NỐI BÁO CÁO THẤT BẠI"}
                      </span>
                    </div>
                    <p>{schemaTestResult.message}</p>
                    {schemaTestResult.sampleTables && schemaTestResult.sampleTables.length > 0 && (
                      <p className="mt-1 font-mono text-[11px]">
                        Bảng mẫu nhận diện:{" "}
                        <strong>{schemaTestResult.sampleTables.join(", ")}</strong>...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Quy chuẩn & Lời chào (Persona & Prompts) */}
        {activeTab === "persona" && (
          <div className="space-y-4">
            {/* TẦNG 1: RULE LUỒNG CỐ ĐỊNH (.MD - LUÔN TRUYỀN VÀO PROMPT) */}
            <div className="p-4 rounded-xl border border-border bg-surface/50 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-lg">
                    menu_book
                  </span>
                  <div>
                    <span className="text-xs font-bold text-text-main block">
                      1. Rule Luồng Cố Định (.md — Luôn Truyền Vào Prompt)
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Chỉ chứa quy tắc luồng cốt lõi luôn được truyền cố định trong mọi câu hỏi.
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    {ruleFiles.length} file .md
                  </span>
                </div>

                {/* Nút Tải File Lên Trực Tiếp Từ Máy Tính */}
                <div className="shrink-0 flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFilesUpload}
                    multiple
                    accept=".md,.markdown,.txt"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingRules}
                    className="gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  >
                    <span className="material-symbols-outlined text-base">
                      {isUploadingRules ? "progress_activity" : "upload_file"}
                    </span>
                    {isUploadingRules ? "Đang tải file lên..." : "Tải File Rule Luồng (.md)"}
                  </Button>
                </div>
              </div>

              {/* Thông báo kết quả tải file */}
              {uploadSuccessMessage && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>{uploadSuccessMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadSuccessMessage(null)}
                    className="text-text-muted hover:text-text-main"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}

              {/* Danh sách file đã được gắn */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-main">
                    Các File Rule Luồng Đang Áp Dụng:
                  </span>
                  {ruleFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllRules}
                      className="text-[11px] text-red-500 hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">delete_sweep</span>
                      Xóa toàn bộ ({ruleFiles.length})
                    </button>
                  )}
                </div>

                {ruleFiles.length === 0 ? (
                  <div className="p-3 rounded-lg border border-dashed border-border bg-surface text-center text-xs text-text-muted">
                    Chưa gắn file Rule luồng (.md) nào cho ứng dụng này.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 rounded-lg bg-surface border border-border">
                    {ruleFiles.map((file, idx) => (
                      <div
                        key={`${file}-${idx}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs group"
                      >
                        <span className="material-symbols-outlined text-sm text-indigo-500">
                          description
                        </span>
                        <span className="font-mono font-medium">{file}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRuleFile(file)}
                          className="size-4 rounded-full flex items-center justify-center hover:bg-red-500/20 hover:text-red-600 transition-colors ml-1"
                          title={`Gỡ bỏ ${file}`}
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chọn từ Rule Book có sẵn trong kho hệ thống */}
              <div className="pt-2 border-t border-border">
                <select
                  value={selectedRuleToAdd}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddExistingRule(e.target.value);
                    }
                  }}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-border bg-surface text-text-main focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  <option value="">-- Chọn file Rule luồng (.md) có sẵn từ hệ thống --</option>
                  {availableRuleBooks.map((rb) => {
                    const isAdded = ruleFiles.some(
                      (f) => f.toLowerCase() === rb.fileName.toLowerCase()
                    );
                    return (
                      <option key={rb.id} value={rb.fileName} disabled={isAdded}>
                        {isAdded ? "✓ " : ""}
                        {rb.name} ({rb.fileName})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* TẦNG 2: KHO KIẾN THỨC NGHIỆP VỤ TRONG SQLITE DB (DÙNG CHO LUỒNG SEARCH NGHIỆP VỤ) */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">
                    database
                  </span>
                  <div>
                    <span className="text-xs font-bold text-text-main block">
                      2. DB Lưu Kiến Thức Nghiệp Vụ (Phục Vụ Luồng Search Nghiệp Vụ)
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Tải nguyên Folder hoặc File tài liệu trực tiếp vào SQLite DB — tự động băm nhỏ
                      & tra cứu tại bước Search Nghiệp Vụ (giữa OpenAPI Locator và DB Table
                      Locator).
                    </span>
                  </div>
                </div>

                {/* Nút Tải Folder hoặc File trực tiếp vào SQLite DB */}
                <div className="shrink-0 flex items-center gap-2">
                  <input
                    type="file"
                    ref={knowledgeFolderInputRef}
                    onChange={handleKnowledgeDbUpload}
                    multiple
                    {...({ webkitdirectory: "", directory: "" } as any)}
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={knowledgeFileInputRef}
                    onChange={handleKnowledgeDbUpload}
                    multiple
                    accept=".md,.markdown,.txt,.json,.csv"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => knowledgeFolderInputRef.current?.click()}
                    disabled={isUploadingKnowledgeDb}
                    className="gap-1.5 text-xs font-semibold border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                  >
                    <span className="material-symbols-outlined text-base">folder_open</span>
                    Tải Folder vào DB
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => knowledgeFileInputRef.current?.click()}
                    disabled={isUploadingKnowledgeDb}
                    className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    <span className="material-symbols-outlined text-base">
                      {isUploadingKnowledgeDb ? "progress_activity" : "cloud_upload"}
                    </span>
                    {isUploadingKnowledgeDb ? "Đang nạp vào DB..." : "Tải File vào DB"}
                  </Button>
                </div>
              </div>

              {knowledgeDbMessage && (
                <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>{knowledgeDbMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKnowledgeDbMessage(null)}
                    className="text-text-muted hover:text-text-main"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}

              {/* Thống kê & Danh sách Folder / Tài liệu trong SQLite DB */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-text-main">
                    <span>
                      Đang lưu trong DB:{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {knowledgeDocs.length} tài liệu
                      </strong>{" "}
                      ({totalKnowledgeChunks} mục kiến thức)
                    </span>
                  </div>
                  {knowledgeDocs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllKnowledgeDb}
                      className="text-[11px] text-red-500 hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">delete_forever</span>
                      Xóa toàn bộ DB Kiến thức
                    </button>
                  )}
                </div>

                {/* Danh sách các Folder đã nạp vào DB */}
                {knowledgeFolders.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {knowledgeFolders.map((folder) => (
                      <span
                        key={folder}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono"
                      >
                        <span className="material-symbols-outlined text-xs">folder</span>
                        Folder: {folder}
                        <button
                          type="button"
                          onClick={() => handleDeleteKnowledgeFolder(folder)}
                          className="ml-1 hover:text-red-500"
                          title={`Xóa toàn bộ folder ${folder} khỏi DB`}
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {knowledgeDocs.length === 0 ? (
                  <div className="p-3 rounded-lg border border-dashed border-emerald-500/30 bg-surface/60 text-center text-xs text-text-muted">
                    Kho kiến thức trong DB đang trống. Hãy bấm{" "}
                    <strong>&quot;Tải Folder vào DB&quot;</strong> hoặc{" "}
                    <strong>&quot;Tải File vào DB&quot;</strong> để nạp tài liệu nghiệp vụ vào
                    SQLite DB.
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-surface divide-y divide-border">
                    {knowledgeDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between px-3 py-2 text-xs hover:bg-surface/80"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-sm text-emerald-600">
                            article
                          </span>
                          <span className="font-mono truncate text-text-main">
                            {doc.relativePath}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold shrink-0">
                            {doc.chunkCount} mục
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteKnowledgeDoc(doc.id)}
                          className="text-text-muted hover:text-red-500 ml-2 shrink-0"
                          title={`Xóa ${doc.relativePath} khỏi DB`}
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-main block mb-1">
                Lời Chào Khởi Đầu (Welcome Message)
              </label>
              <Textarea
                placeholder="Xin chào! Tôi là Trợ lý AI..."
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                rows={3}
                className="text-xs leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-text-main block mb-1">
                Gợi Ý Câu Hỏi Nhanh (Mỗi dòng 1 câu gợi ý)
              </label>
              <Textarea
                placeholder={
                  "Xem danh sách sự cố gần đây\nKiểm tra tài sản chi nhánh 1\nBáo hỏng máy tính bảng"
                }
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                rows={4}
                className="text-xs font-mono leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

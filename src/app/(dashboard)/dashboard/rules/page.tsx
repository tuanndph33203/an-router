"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Input, Modal } from "@/shared/components";
import { matchesSearch } from "@/shared/utils/turkishText";

interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  app_id?: string;
  appId?: string;
  app_name?: string;
  appName?: string;
  created_at?: string;
  createdAt?: string;
}

interface AppConfigData {
  appId: string;
  name: string;
  baseApiUrl: string;
  domainPlaybook?: string;
}

interface KeyRuleMeta {
  assignedCount: number;
  ruleNames: string[];
  appId: string;
  appName: string;
}

interface KnowledgeDocItem {
  id: string;
  appId: string;
  docName: string;
  folderName: string;
  relativePath: string;
  rawSize: number;
  chunkCount: number;
  updatedAt: string;
}

const DEFAULT_AVAILABLE_APPS = [
  { id: "his", name: "HIS Medical System (Y tế & Dịch vụ)" },
  { id: "bms", name: "BMS System (Quản trị Kinh doanh)" },
  { id: "UAT_anpos", name: "AnPOS / Uat anpos (Bán hàng & Doanh thu)" },
  { id: "PRO_ERP", name: "PRO ERP (An POS pro)" },
  { id: "cmms", name: "An CMMS (Bảo trì & Sự cố)" },
  { id: "report", name: "Dynamic Report (Báo cáo tổng hợp)" },
];

export default function RulesUnifiedPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [availableApps, setAvailableApps] =
    useState<Array<{ id: string; name: string }>>(DEFAULT_AVAILABLE_APPS);
  const [keyRuleMap, setKeyRuleMap] = useState<Record<string, KeyRuleMeta>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Kho Kiến thức trong SQLite DB theo ứng dụng đang chọn
  const [activeKnowledgeAppId, setActiveKnowledgeAppId] = useState<string>("his");
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocItem[]>([]);
  const [knowledgeFolders, setKnowledgeFolders] = useState<string[]>([]);
  const [totalKnowledgeChunks, setTotalKnowledgeChunks] = useState<number>(0);
  const [knowledgeUploadMsg, setKnowledgeUploadMsg] = useState<string | null>(null);
  const [isUploadingToDb, setIsUploadingToDb] = useState(false);

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Popup Cấu hình theo Khóa API
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeKey, setActiveKey] = useState<ApiKeyItem | null>(null);

  // State trong Popup Cấu hình
  const [activeTab, setActiveTab] = useState<"knowledge_db" | "playbook">("knowledge_db");
  const [selectedAppId, setSelectedAppId] = useState<string>("his");
  const [customAppName, setCustomAppName] = useState<string>("HIS Medical System");
  const [appConfig, setAppConfig] = useState<AppConfigData | null>(null);
  const [playbookPrompt, setPlaybookPrompt] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Modal Thêm Tài liệu / Kiến thức Nghiệp vụ Mới vào DB
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [targetAppForNewDoc, setTargetAppForNewDoc] = useState<string>("his");
  const [targetFolderForNewDoc, setTargetFolderForNewDoc] = useState<string>("");
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleFileName, setNewRuleFileName] = useState("");
  const [newRuleContent, setNewRuleContent] = useState("");
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);

  // Modal Xem chi tiết Chunks của 1 Tài liệu
  const [inspectingDoc, setInspectingDoc] = useState<KnowledgeDocItem | null>(null);
  const [inspectingDocChunks, setInspectingDocChunks] = useState<any[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Thử nghiệm Multi-Search Sandbox (Hybrid RRF + Ranker)
  const [showSearchSandbox, setShowSearchSandbox] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState("");
  const [testSearchResult, setTestSearchResult] = useState<any | null>(null);
  const [isTestingSearch, setIsTestingSearch] = useState(false);

  // Trạng thái Drag & Drop
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleInspectDocChunks = async (doc: KnowledgeDocItem) => {
    setInspectingDoc(doc);
    setInspectingDocChunks([]);
    setIsLoadingChunks(true);
    try {
      const res = await fetch(
        `/api/orchestrator/knowledge?appId=${encodeURIComponent(doc.appId || activeKnowledgeAppId)}&docId=${encodeURIComponent(doc.id)}`
      );
      if (res.ok) {
        const json = await res.json();
        setInspectingDocChunks(Array.isArray(json?.Data?.chunks) ? json.Data.chunks : []);
      }
    } catch (e) {
      console.warn("Failed to load chunks:", e);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const handleExecuteTestSearch = async () => {
    if (!testSearchQuery.trim()) return;
    setIsTestingSearch(true);
    setTestSearchResult(null);
    try {
      const appIdToUse = (selectedAppId || activeKnowledgeAppId || "his").trim().toLowerCase();
      const res = await fetch(
        `/api/orchestrator/knowledge?appId=${encodeURIComponent(appIdToUse)}&testQuery=${encodeURIComponent(testSearchQuery.trim())}`
      );
      if (res.ok) {
        const json = await res.json();
        setTestSearchResult(json?.Data || null);
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson?.Message || "Lỗi khi chạy thử nghiệm tìm kiếm.");
      }
    } catch (e: any) {
      alert(`Lỗi tìm kiếm: ${e?.message || e}`);
    } finally {
      setIsTestingSearch(false);
    }
  };

  const handleClearAllKnowledge = async () => {
    const appIdToUse = (selectedAppId || activeKnowledgeAppId || "his").trim().toLowerCase();
    if (
      !confirm(
        `Bạn có chắc chắn muốn XÓA SẠCH toàn bộ tài liệu và vector tri thức của ứng dụng '${appIdToUse.toUpperCase()}' khỏi SQLite DB?`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/orchestrator/knowledge?appId=${encodeURIComponent(appIdToUse)}&clearAll=true`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await fetchKnowledgeDbForApp(appIdToUse);
        setKnowledgeUploadMsg(
          `Đã xóa sạch toàn bộ kho kiến thức của ứng dụng '${appIdToUse.toUpperCase()}'.`
        );
      }
    } catch (e: any) {
      alert(`Lỗi xóa kho kiến thức: ${e?.message || e}`);
    }
  };

  const handleDropFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const appIdToUse = (selectedAppId || activeKnowledgeAppId || "his").trim().toLowerCase();
    setIsUploadingToDb(true);
    setKnowledgeUploadMsg(null);

    try {
      const formData = new FormData();
      formData.append("appId", appIdToUse);
      if (targetFolderForNewDoc.trim()) {
        formData.append("folderName", targetFolderForNewDoc.trim());
      }

      Array.from(files).forEach((file: File) => {
        formData.append("files", file);
        const relPath =
          typeof (file as any).webkitRelativePath === "string" &&
          (file as any).webkitRelativePath.trim()
            ? (file as any).webkitRelativePath.trim()
            : file.name;
        formData.append("relativePaths", relPath);
      });

      const res = await fetch("/api/orchestrator/knowledge", {
        method: "POST",
        body: formData,
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson?.Message || `Lỗi nạp tài liệu vào DB (HTTP ${res.status})`);
      }

      const data = resJson?.Data;
      if (data) {
        setKnowledgeDocs(Array.isArray(data.documents) ? data.documents : []);
        setKnowledgeFolders(Array.isArray(data.folders) ? data.folders : []);
        setTotalKnowledgeChunks(Number(data.totalChunks || 0));
      }
      setKnowledgeUploadMsg(
        resJson?.Message || "Đã kéo thả và nạp tài liệu trực tiếp vào SQLite DB thành công!"
      );
    } catch (err: any) {
      alert(`Không thể nạp tài liệu kéo thả: ${err?.message || err}`);
    } finally {
      setIsUploadingToDb(false);
    }
  };

  const fetchKnowledgeDbForApp = async (appId: string) => {
    const cleanId = (appId || "").trim().toLowerCase();
    if (!cleanId) return;
    try {
      const res = await fetch(`/api/orchestrator/knowledge?appId=${encodeURIComponent(cleanId)}`);
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

  // Load danh sách ban đầu
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [keysRes, appsRes] = await Promise.all([
        fetch("/api/keys"),
        fetch("/api/orchestrator/apps"),
      ]);

      let mergedApps = [...DEFAULT_AVAILABLE_APPS];
      if (appsRes.ok) {
        const appsJson = await appsRes.json();
        const dbApps = Array.isArray(appsJson.Data) ? appsJson.Data : [];
        const seen = new Set<string>();
        const list: Array<{ id: string; name: string }> = [];
        for (const a of dbApps) {
          const id = String(a.microsoftClientKey || a.appId || "").trim();
          if (id && !seen.has(id.toLowerCase())) {
            seen.add(id.toLowerCase());
            list.push({ id, name: a.name || id });
          }
        }
        for (const d of DEFAULT_AVAILABLE_APPS) {
          if (!seen.has(d.id.toLowerCase())) {
            seen.add(d.id.toLowerCase());
            list.push(d);
          }
        }
        if (list.length > 0) {
          mergedApps = list;
          setAvailableApps(list);
          if (!activeKnowledgeAppId) {
            setActiveKnowledgeAppId(list[0].id);
          }
        }
      }

      let loadedKeys: ApiKeyItem[] = [];
      if (keysRes.ok) {
        const json = await keysRes.json();
        loadedKeys = json.keys || [];
        setKeys(loadedKeys);
      }

      await fetchKnowledgeDbForApp(activeKnowledgeAppId || mergedApps[0]?.id || "his");

      // Nạp metadata rule và application cho từng key
      if (loadedKeys.length > 0) {
        const metaEntries = await Promise.all(
          loadedKeys.map(async (k) => {
            try {
              const res = await fetch(`/api/keys/${encodeURIComponent(k.id)}/rules`);
              if (res.ok) {
                const j = await res.json();
                const ids: string[] = j.Data?.assignedRuleIds || [];
                const names = (j.Data?.rules || []).map((r: any) => r.name);
                const aId = j.Data?.appId || (k as any).app_id || (k as any).appId || "his";
                const aName =
                  j.Data?.appName ||
                  (k as any).app_name ||
                  (k as any).appName ||
                  mergedApps.find((a) => a.id.toLowerCase() === aId.toLowerCase())?.name ||
                  aId;
                return [
                  k.id,
                  { assignedCount: ids.length, ruleNames: names, appId: aId, appName: aName },
                ] as const;
              }
            } catch {}
            return [
              k.id,
              { assignedCount: 0, ruleNames: [], appId: "his", appName: "HIS System" },
            ] as const;
          })
        );
        setKeyRuleMap(Object.fromEntries(metaEntries));
      }
    } catch (e) {
      console.warn("Failed to load initial data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeKnowledgeAppId) {
      void fetchKnowledgeDbForApp(activeKnowledgeAppId);
    }
  }, [activeKnowledgeAppId]);

  // Nạp Folder hoặc File trực tiếp vào SQLite DB (`knowledge_documents` & `knowledge_chunks`)
  const handleUploadFilesOrFolderToDb = async (
    e: React.ChangeEvent<HTMLInputElement>,
    overrideAppId?: string
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const appIdToUse = (overrideAppId || activeKnowledgeAppId || "his").trim().toLowerCase();
    setIsUploadingToDb(true);
    setKnowledgeUploadMsg(null);

    try {
      const formData = new FormData();
      formData.append("appId", appIdToUse);
      if (targetFolderForNewDoc.trim()) {
        formData.append("folderName", targetFolderForNewDoc.trim());
      }

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
        throw new Error(resJson?.Message || `Lỗi nạp tài liệu vào DB (HTTP ${res.status})`);
      }

      setActiveKnowledgeAppId(appIdToUse);
      const data = resJson?.Data;
      if (data) {
        setKnowledgeDocs(Array.isArray(data.documents) ? data.documents : []);
        setKnowledgeFolders(Array.isArray(data.folders) ? data.folders : []);
        setTotalKnowledgeChunks(Number(data.totalChunks || 0));
      }
      setKnowledgeUploadMsg(
        resJson?.Message || "Đã nạp tài liệu trực tiếp vào SQLite DB Kiến thức thành công!"
      );
      setShowAddRuleModal(false);
    } catch (err: any) {
      alert(`Không thể nạp tài liệu vào DB: ${err?.message || err}`);
    } finally {
      setIsUploadingToDb(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Lưu nội dung nhập trực tiếp vào SQLite DB Kiến thức
  const handleCreateManualKnowledgeInDb = async () => {
    if (!newRuleFileName.trim() && !newRuleName.trim()) {
      alert("Vui lòng nhập Tên tài liệu.");
      return;
    }
    if (!newRuleContent.trim()) {
      alert("Vui lòng nhập Nội dung tài liệu nghiệp vụ để lưu vào DB.");
      return;
    }

    setIsSubmittingRule(true);
    try {
      const appIdToUse = (targetAppForNewDoc || activeKnowledgeAppId || "his").trim().toLowerCase();
      let docFileName = (newRuleFileName || newRuleName).trim();
      if (!docFileName.endsWith(".md") && !docFileName.endsWith(".txt")) {
        docFileName = `${docFileName}.md`;
      }
      const folderPrefix = targetFolderForNewDoc.trim();
      const relPath = folderPrefix ? `${folderPrefix}/${docFileName}` : docFileName;

      const formattedContent =
        newRuleName.trim() && !newRuleContent.trim().startsWith("#")
          ? `# ${newRuleName.trim()}\n\n${newRuleContent.trim()}`
          : newRuleContent.trim();

      const res = await fetch("/api/orchestrator/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: appIdToUse,
          documents: [
            {
              relativePath: relPath,
              content: formattedContent,
              folderName: folderPrefix || undefined,
            },
          ],
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson?.Message || "Lỗi khi lưu tài liệu vào DB Kiến thức.");
      }

      setActiveKnowledgeAppId(appIdToUse);
      const data = resJson?.Data;
      if (data) {
        setKnowledgeDocs(Array.isArray(data.documents) ? data.documents : []);
        setKnowledgeFolders(Array.isArray(data.folders) ? data.folders : []);
        setTotalKnowledgeChunks(Number(data.totalChunks || 0));
      }

      setKnowledgeUploadMsg(
        resJson?.Message || `Đã lưu '${relPath}' vào SQLite DB Kiến thức thành công!`
      );
      setShowAddRuleModal(false);
      setNewRuleName("");
      setNewRuleFileName("");
      setNewRuleContent("");
    } catch (e: any) {
      alert(e?.message || "Lỗi khi lưu tài liệu vào DB");
    } finally {
      setIsSubmittingRule(false);
    }
  };

  const handleDeleteKnowledgeDoc = async (appId: string, docId: string) => {
    try {
      const res = await fetch(
        `/api/orchestrator/knowledge?appId=${encodeURIComponent(appId)}&docId=${encodeURIComponent(docId)}`,
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

  const handleDeleteKnowledgeFolder = async (appId: string, folderName: string) => {
    try {
      const res = await fetch(
        `/api/orchestrator/knowledge?appId=${encodeURIComponent(appId)}&folderName=${encodeURIComponent(folderName)}`,
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

  // Mở Popup Cấu hình cho 1 Key
  const handleOpenConfigModal = async (key: ApiKeyItem) => {
    setActiveKey(key);
    setActiveTab("knowledge_db");
    setSaveSuccessNotice(false);

    const existingMeta = keyRuleMap[key.id];
    let app = existingMeta?.appId || key.app_id || key.appId || "";
    if (!app) {
      app = matchesSearch(key.name || "", "cmms") ? "cmms" : "his";
    }
    const matchedApp = availableApps.find((a) => a.id.toLowerCase() === app.toLowerCase());
    const resolvedName =
      existingMeta?.appName || key.app_name || key.appName || matchedApp?.name || app;

    setSelectedAppId(app);
    setActiveKnowledgeAppId(app);
    setCustomAppName(resolvedName);
    await fetchKnowledgeDbForApp(app);

    try {
      const [rulesRes, configRes] = await Promise.all([
        fetch(`/api/keys/${encodeURIComponent(key.id)}/rules`),
        fetch(`/api/orchestrator/app-config?appId=${encodeURIComponent(app)}`),
      ]);

      if (rulesRes.ok) {
        const json = await rulesRes.json();
        if (json.Data?.appId) {
          setSelectedAppId(json.Data.appId);
          setActiveKnowledgeAppId(json.Data.appId);
          await fetchKnowledgeDbForApp(json.Data.appId);
        }
        if (json.Data?.appName) setCustomAppName(json.Data.appName);
      }
      if (configRes.ok) {
        const json = await configRes.json();
        setAppConfig(json.Data);
        setPlaybookPrompt(json.Data?.domainPlaybook || "");
      }
    } catch (e) {
      console.warn("Error loading key config:", e);
    }

    setShowConfigModal(true);
  };

  // Lưu cấu hình Rule cứng (Playbook)
  const handleSaveModalConfig = async () => {
    if (!activeKey) return;
    setIsSaving(true);
    try {
      await fetch("/api/orchestrator/app-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(appConfig || { appId: selectedAppId, name: customAppName, baseApiUrl: "" }),
          appId: selectedAppId,
          domainPlaybook: playbookPrompt,
        }),
      });

      setSaveSuccessNotice(true);
      await loadInitialData();
      setTimeout(() => {
        setSaveSuccessNotice(false);
      }, 1500);
    } catch (e) {
      console.warn("Failed to save modal config:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredKeys = keys.filter(
    (k) =>
      !searchQuery.trim() ||
      matchesSearch(k.name, searchQuery) ||
      matchesSearch(k.key, searchQuery) ||
      matchesSearch(k.id, searchQuery)
  );

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Input ẩn dùng chung để chọn Folder hoặc File nạp thẳng vào SQLite DB */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={(e) =>
          handleUploadFilesOrFolderToDb(e, targetAppForNewDoc || activeKnowledgeAppId)
        }
        multiple
        {...({ webkitdirectory: "", directory: "" } as any)}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) =>
          handleUploadFilesOrFolderToDb(e, targetAppForNewDoc || activeKnowledgeAppId)
        }
        multiple
        accept=".pdf,.docx,.doc,.txt,.md,.markdown,.json,.csv"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="flex items-center justify-between gap-4 bg-surface border border-border rounded-2xl px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <span className="material-symbols-outlined text-2xl">menu_book</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-text-main">
              Cấu hình Tri thức &amp; Rule AI
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Quản lý tài liệu nghiệp vụ và Rule cứng hệ thống riêng biệt cho từng dự án.
            </p>
          </div>
        </div>

        <Button
          onClick={loadInitialData}
          variant="ghost"
          className="gap-1.5 text-xs border border-border shrink-0"
        >
          <span className="material-symbols-outlined text-base">sync</span>
          Làm mới
        </Button>
      </div>

      {/* Danh sách Khóa API Full Width */}
      <Card className="w-full overflow-hidden">
        <div className="p-4 border-b border-border bg-surface/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative w-full">
              <span className="material-symbols-outlined text-text-muted text-lg absolute left-3 top-1/2 -translate-y-1/2">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên dự án, mã key hoặc ID..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-text-main focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>
              Hiển thị <strong>{filteredKeys.length}</strong> / <strong>{keys.length}</strong> dự án
            </span>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-surface/70 border-b border-border text-xs font-semibold text-text-muted">
          <div className="col-span-4">DỰ ÁN / TÊN KHÓA API</div>
          <div className="col-span-3">ỨNG DỤNG (APP)</div>
          <div className="col-span-3">MÃ X-API-KEY</div>
          <div className="col-span-2 text-right">THAO TÁC</div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-text-muted text-sm flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined animate-spin text-2xl text-indigo-500">
              progress_activity
            </span>
            <span>Đang tải danh sách dự án...</span>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-4xl text-text-muted">search_off</span>
            <p className="text-sm font-semibold text-text-main">Không tìm thấy khóa API nào</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredKeys.map((k) => {
              const meta = keyRuleMap[k.id] || {
                assignedCount: 0,
                ruleNames: [],
                appId: "his",
                appName: "HIS System",
              };
              return (
                <div
                  key={k.id}
                  className="px-6 py-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center hover:bg-surface/50 transition-colors"
                >
                  <div className="col-span-4 flex items-center gap-3.5">
                    <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                      <span className="material-symbols-outlined text-xl">vpn_key</span>
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-sm text-text-main truncate block">
                        {k.name}
                      </span>
                      <span className="text-[11px] text-text-muted font-mono bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">
                        ID: {k.id}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                      <span className="size-1.5 rounded-full bg-purple-500"></span>
                      {meta.appId}
                    </span>
                    <span className="text-xs text-text-muted font-medium truncate">
                      {meta.appName}
                    </span>
                  </div>

                  <div className="col-span-3 flex items-center">
                    <code className="text-xs font-mono text-text-muted bg-surface/90 px-2 py-1 rounded-md border border-border/80 truncate max-w-full">
                      {k.key}
                    </code>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2 w-full md:w-auto">
                    <Button
                      onClick={() => handleOpenConfigModal(k)}
                      variant="secondary"
                      className="gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 font-medium"
                    >
                      <span className="material-symbols-outlined text-base">tune</span>
                      Cấu hình
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* POPUP CẤU HÌNH CHO TỪNG DỰ ÁN */}
      <Modal
        isOpen={showConfigModal}
        title={`Cấu hình Tri thức: ${activeKey?.name || customAppName}`}
        onClose={() => setShowConfigModal(false)}
        size="full"
      >
        <div className="flex flex-col gap-4 w-full">
          {/* Thanh Tabs + Nút Thao Tác nằm gọn trên 1 hàng */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2.5">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setActiveTab("knowledge_db")}
                className={`pb-2 -mb-[11px] text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === "knowledge_db"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-text-muted hover:text-text-main"
                }`}
              >
                <span className="material-symbols-outlined text-base">database</span>
                Kho Tri Thức Nghiệp Vụ ({knowledgeDocs.length} tài liệu • {totalKnowledgeChunks}{" "}
                mục)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("playbook")}
                className={`pb-2 -mb-[11px] text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === "playbook"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-text-muted hover:text-text-main"
                }`}
              >
                <span className="material-symbols-outlined text-base">gavel</span>
                Rule Cứng Hệ Thống
              </button>
            </div>

            {activeTab === "knowledge_db" && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSearchSandbox(!showSearchSandbox)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    showSearchSandbox
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">search</span>
                  Tìm thử
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetAppForNewDoc(selectedAppId);
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploadingToDb}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  Chọn File
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetAppForNewDoc(selectedAppId);
                    folderInputRef.current?.click();
                  }}
                  disabled={isUploadingToDb}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-black/5 dark:hover:bg-white/5 text-text-main border border-border transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">folder_open</span>
                  Chọn Folder
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetAppForNewDoc(selectedAppId);
                    setShowAddRuleModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-black/5 dark:hover:bg-white/5 text-text-main border border-border transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">edit_note</span>
                  Nhập tay
                </button>

                {knowledgeDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllKnowledge}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer"
                    title="Xóa toàn bộ tài liệu"
                  >
                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                    Xóa hết
                  </button>
                )}
              </div>
            )}
          </div>

          {activeTab === "knowledge_db" && (
            <div className="space-y-3">
              {/* Thông báo tiến trình nạp */}
              {knowledgeUploadMsg && (
                <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-emerald-600">
                      check_circle
                    </span>
                    <span>{knowledgeUploadMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKnowledgeUploadMsg(null)}
                    className="text-text-muted hover:text-text-main cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}

              {/* SANDBOX THỬ NGHIỆM TÌM KIẾM */}
              {showSearchSandbox && (
                <div className="p-3.5 rounded-xl bg-surface/80 border border-indigo-500/30 space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testSearchQuery}
                      onChange={(e) => setTestSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleExecuteTestSearch();
                      }}
                      placeholder="Nhập câu hỏi nghiệp vụ cần kiểm tra kết quả trích xuất..."
                      className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-surface text-text-main focus:outline-hidden focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleExecuteTestSearch}
                      disabled={isTestingSearch}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">search</span>
                      {isTestingSearch ? "Đang tìm..." : "Kiểm tra"}
                    </button>
                  </div>

                  {testSearchResult && (
                    <div className="pt-2 border-t border-border space-y-2">
                      {testSearchResult.isGreeting ? (
                        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs">
                          👋 Phản hồi chào hỏi:{" "}
                          <em>&quot;{testSearchResult.greetingReply}&quot;</em>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {testSearchResult.topChunks?.map((chunk: any, i: number) => (
                            <div
                              key={chunk.id || i}
                              className="p-2.5 rounded-lg border border-border bg-surface text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                  #{i + 1}
                                </span>
                                <span className="font-mono text-[10px] text-text-muted truncate max-w-[200px]">
                                  {chunk.breadcrumb}
                                </span>
                              </div>
                              <h4 className="font-semibold text-text-main text-xs">
                                {chunk.heading}
                              </h4>
                              <p className="text-text-muted text-[11px] line-clamp-3 font-mono">
                                {chunk.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* VÙNG KÉO THẢ GỌN GÀNG */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDropFiles}
                className={`rounded-xl border border-dashed transition-all flex items-center justify-center text-center ${
                  knowledgeDocs.length === 0 ? "p-8 flex-col gap-2" : "px-4 py-2.5 gap-2.5"
                } ${
                  isDraggingOver
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-border bg-surface/40 hover:bg-surface/70"
                }`}
              >
                <span className="material-symbols-outlined text-xl text-emerald-600 dark:text-emerald-400">
                  {isUploadingToDb ? "sync" : "cloud_upload"}
                </span>
                <div>
                  <p className="text-xs font-medium text-text-main">
                    {isUploadingToDb
                      ? "Đang xử lý và lưu tài liệu..."
                      : knowledgeDocs.length === 0
                        ? "Chưa có tài liệu nào. Kéo thả file hoặc folder vào đây để tải lên"
                        : "Kéo thả thêm file hoặc folder vào đây để bổ sung"}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Hỗ trợ: .pdf, .docx, .doc, .md, .json, .csv, .txt
                  </p>
                </div>
              </div>

              {/* DANH SÁCH THƯ MỤC & TÀI LIỆU */}
              {knowledgeFolders.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {knowledgeFolders.map((folder) => (
                    <span
                      key={folder}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface border border-border text-text-main text-xs font-mono"
                    >
                      <span className="material-symbols-outlined text-sm text-amber-500">
                        folder
                      </span>
                      {folder}
                      <button
                        type="button"
                        onClick={() => handleDeleteKnowledgeFolder(selectedAppId, folder)}
                        className="ml-1 text-text-muted hover:text-red-500 cursor-pointer"
                        title={`Xóa folder ${folder}`}
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {knowledgeDocs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {knowledgeDocs.map((doc) => {
                    const lower = doc.relativePath.toLowerCase();
                    const isPdf = lower.endsWith(".pdf");
                    const isDocx = lower.endsWith(".docx") || lower.endsWith(".doc");

                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-surface hover:border-indigo-500/40 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`material-symbols-outlined text-lg shrink-0 ${
                              isPdf ? "text-red-500" : isDocx ? "text-blue-500" : "text-indigo-500"
                            }`}
                          >
                            {isPdf ? "picture_as_pdf" : isDocx ? "article" : "description"}
                          </span>
                          <div className="min-w-0">
                            <p
                              className="font-mono font-semibold text-text-main truncate text-xs"
                              title={doc.relativePath}
                            >
                              {doc.relativePath}
                            </p>
                            <p className="text-[11px] text-text-muted">
                              {(doc.rawSize / 1024).toFixed(1)} KB • {doc.chunkCount} mục
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleInspectDocChunks(doc)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-indigo-600 hover:bg-indigo-500/10 cursor-pointer"
                            title="Xem chi tiết các mục (Chunks)"
                          >
                            <span className="material-symbols-outlined text-base">visibility</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKnowledgeDoc(selectedAppId, doc.id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                            title="Xóa tài liệu"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "playbook" && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted">
                Rule cứng luôn được truyền cố định vào System Prompt của dự án{" "}
                <strong className="text-text-main uppercase">{selectedAppId}</strong> ở mọi lượt hội
                thoại:
              </p>
              <textarea
                value={playbookPrompt}
                onChange={(e) => setPlaybookPrompt(e.target.value)}
                placeholder="Nhập các quy tắc bắt buộc cho AI của dự án này (VD: Luôn lọc IsDeleted = 0, định dạng tiền tệ VNĐ, quy tắc ánh xạ chi nhánh)..."
                rows={11}
                className="w-full text-xs font-mono p-3.5 rounded-xl border border-border bg-surface text-text-main focus:outline-hidden focus:border-indigo-500 leading-relaxed"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-xs text-emerald-600 font-semibold">
              {saveSuccessNotice && "✓ Đã lưu Rule cứng thành công!"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowConfigModal(false)}
                variant="ghost"
                className="text-xs px-4"
              >
                Đóng
              </Button>
              {activeTab === "playbook" && (
                <button
                  type="button"
                  onClick={handleSaveModalConfig}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? "Đang lưu..." : "Lưu Rule Cứng"}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL NHẬP TAY TÀI LIỆU NGHIỆP VỤ VÀO SQLITE DB */}
      <Modal
        isOpen={showAddRuleModal}
        title={`Nhập tài liệu tri thức cho dự án: ${customAppName || selectedAppId}`}
        onClose={() => setShowAddRuleModal(false)}
        size="lg"
      >
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-main mb-1 block">
                Tiêu đề tài liệu *
              </label>
              <Input
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder="Ví dụ: Quy tắc tính Doanh thu"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-main mb-1 block">
                Tên định danh (.md) *
              </label>
              <Input
                value={newRuleFileName}
                onChange={(e) => setNewRuleFileName(e.target.value)}
                placeholder="Ví dụ: doanh_thu_dich_vu.md"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-main mb-1 block">
                Nhóm / Folder (tùy chọn)
              </label>
              <Input
                value={targetFolderForNewDoc}
                onChange={(e) => setTargetFolderForNewDoc(e.target.value)}
                placeholder="Ví dụ: doanh_thu..."
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-main mb-1 block">
              Nội dung tài liệu nghiệp vụ (Dán hoặc gõ trực tiếp Markdown / Text) *
            </label>
            <textarea
              value={newRuleContent}
              onChange={(e) => setNewRuleContent(e.target.value)}
              placeholder={
                "## 1. Quy tắc bảng SaleService và SaleServiceDetail\n- Bảng phiếu dịch vụ: SaleService (CreatedDate, BranchId, IsDeleted = 0)\n- Bảng chi tiết: SaleServiceDetail (SaleServiceId, Amount, TotalPayment)\n\n## 2. Công thức tính doanh thu thuần\n- SUM(TotalPayment)..."
              }
              rows={10}
              className="w-full text-xs font-mono p-3 rounded-xl border border-border bg-surface text-text-main focus:outline-hidden focus:border-indigo-500 leading-relaxed"
            />
          </div>

          <div className="flex gap-2.5 mt-1">
            <Button onClick={() => setShowAddRuleModal(false)} variant="ghost" fullWidth>
              Hủy
            </Button>
            <Button
              onClick={handleCreateManualKnowledgeInDb}
              fullWidth
              disabled={!newRuleContent.trim() || (!newRuleName.trim() && !newRuleFileName.trim())}
              loading={isSubmittingRule}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Lưu trực tiếp vào SQLite DB Kiến thức
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL XEM CHI TIẾT CÁC CHUNK KIẾN THỨC CỦA 1 TÀI LIỆU */}
      <Modal
        isOpen={Boolean(inspectingDoc)}
        title={
          inspectingDoc
            ? `Chi tiết các mục tri thức (Chunks) — ${inspectingDoc.docName}`
            : "Chi tiết Chunks"
        }
        onClose={() => setInspectingDoc(null)}
        size="xl"
      >
        <div className="flex flex-col gap-4 max-h-[75vh]">
          {inspectingDoc && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface border border-border text-xs">
              <div>
                <span className="text-text-muted">Đường dẫn: </span>
                <code className="font-mono font-bold text-text-main">
                  {inspectingDoc.relativePath}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                  {inspectingDoc.chunkCount} mục kiến thức
                </span>
                <span className="px-2 py-0.5 rounded-md bg-surface border border-border text-text-muted text-[11px]">
                  {(inspectingDoc.rawSize / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
          )}

          {isLoadingChunks ? (
            <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-2xl text-emerald-600">
                progress_activity
              </span>
              <span>Đang tải danh sách các chunk từ SQLite DB...</span>
            </div>
          ) : inspectingDocChunks.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted border border-dashed border-border rounded-xl">
              Không tìm thấy chunk nào cho tài liệu này.
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              {inspectingDocChunks.map((chunk, idx) => (
                <div
                  key={chunk.id || idx}
                  className="p-4 rounded-xl border border-border bg-surface/70 space-y-2 hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                        Chunk #{idx + 1}
                      </span>
                      <h4 className="font-bold text-xs text-text-main">{chunk.heading}</h4>
                    </div>
                    <span className="text-[11px] font-mono text-text-muted truncate max-w-[250px]">
                      {chunk.breadcrumb}
                    </span>
                  </div>

                  {chunk.preview && (
                    <p className="text-[11px] text-text-muted italic bg-surface p-2 rounded-lg border border-border/40">
                      💡 {chunk.preview}
                    </p>
                  )}

                  <pre className="text-[11px] font-mono p-3 rounded-lg bg-surface/90 border border-border text-text-main whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-48">
                    {chunk.content}
                  </pre>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-border">
            <Button onClick={() => setInspectingDoc(null)} variant="secondary" className="text-xs">
              Đóng
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

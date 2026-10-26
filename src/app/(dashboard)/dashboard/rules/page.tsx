"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Input, Modal, Badge, SegmentedControl, Textarea } from "@/shared/components";
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
  const [_totalKnowledgeChunks, setTotalKnowledgeChunks] = useState<number>(0);
  const [knowledgeUploadMsg, setKnowledgeUploadMsg] = useState<string | null>(null);
  const [isUploadingToDb, setIsUploadingToDb] = useState(false);

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Nạp đè tài liệu cụ thể
  const [targetDocToOverwrite, setTargetDocToOverwrite] = useState<KnowledgeDocItem | null>(null);
  const overwriteFileInputRef = useRef<HTMLInputElement | null>(null);

  // Chỉnh sửa Chunk trực tiếp
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editChunkHeading, setEditChunkHeading] = useState("");
  const [editChunkContent, setEditChunkContent] = useState("");
  const [isSavingChunk, setIsSavingChunk] = useState(false);

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

  const handleTriggerDocOverwrite = (doc: KnowledgeDocItem) => {
    setTargetDocToOverwrite(doc);
    if (overwriteFileInputRef.current) {
      overwriteFileInputRef.current.value = "";
      overwriteFileInputRef.current.click();
    }
  };

  const handleExecuteOverwriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetDocToOverwrite) return;

    const appIdToUse = (
      selectedAppId ||
      targetDocToOverwrite.appId ||
      activeKnowledgeAppId ||
      "his"
    )
      .trim()
      .toLowerCase();

    setIsUploadingToDb(true);
    setKnowledgeUploadMsg(null);

    try {
      const formData = new FormData();
      formData.append("appId", appIdToUse);
      formData.append("files", file);
      formData.append("relativePaths", targetDocToOverwrite.relativePath);

      const res = await fetch("/api/orchestrator/knowledge", {
        method: "POST",
        body: formData,
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson?.Message || `Lỗi ghi đè tài liệu (HTTP ${res.status})`);
      }

      const data = resJson?.Data;
      if (data) {
        setKnowledgeDocs(Array.isArray(data.documents) ? data.documents : []);
        setKnowledgeFolders(Array.isArray(data.folders) ? data.folders : []);
        setTotalKnowledgeChunks(Number(data.totalChunks || 0));
      }

      setKnowledgeUploadMsg(
        resJson?.Message ||
          `Đã ghi đè và cập nhật thành công tài liệu "${targetDocToOverwrite.docName}".`
      );
    } catch (err: any) {
      alert(`Không thể ghi đè tài liệu: ${err?.message || err}`);
    } finally {
      setIsUploadingToDb(false);
      setTargetDocToOverwrite(null);
    }
  };

  const handleStartEditChunk = (chunk: any) => {
    setEditingChunkId(chunk.id);
    setEditChunkHeading(chunk.heading || "");
    setEditChunkContent(chunk.content || "");
  };

  const handleCancelEditChunk = () => {
    setEditingChunkId(null);
    setEditChunkHeading("");
    setEditChunkContent("");
  };

  const handleSaveChunkEdit = async (chunk: any) => {
    if (!inspectingDoc) return;
    const appIdToUse = (inspectingDoc.appId || selectedAppId || activeKnowledgeAppId || "his")
      .trim()
      .toLowerCase();

    setIsSavingChunk(true);
    try {
      const res = await fetch("/api/orchestrator/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: appIdToUse,
          docId: inspectingDoc.id,
          chunkId: chunk.id,
          heading: editChunkHeading,
          content: editChunkContent,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson?.Message || `Lỗi lưu chunk (HTTP ${res.status})`);
      }

      // Cập nhật ngay trong inspectingDocChunks
      setInspectingDocChunks((prev) =>
        prev.map((c) =>
          c.id === chunk.id
            ? {
                ...c,
                heading: editChunkHeading,
                content: editChunkContent,
                preview: editChunkContent.slice(0, 200),
              }
            : c
        )
      );

      handleCancelEditChunk();
      setKnowledgeUploadMsg("Đã cập nhật mục tri thức và chỉ mục vector thành công!");
    } catch (e: any) {
      alert(`Không thể lưu mục tri thức: ${e?.message || e}`);
    } finally {
      setIsSavingChunk(false);
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
      {/* Input ẩn để nạp đè / cập nhật 1 tài liệu cụ thể */}
      <input
        type="file"
        ref={overwriteFileInputRef}
        onChange={handleExecuteOverwriteUpload}
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
        onClose={() => setShowConfigModal(false)}
        title={
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-xl">tune</span>
            <span>Cấu hình Tri thức: {customAppName || activeKey?.name}</span>
            <Badge variant="primary" size="sm">
              {selectedAppId}
            </Badge>
          </div>
        }
        size="full"
        className="max-w-5xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {saveSuccessNotice && (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Đã lưu thay đổi thành công!
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfigModal(false)}>
                Đóng
              </Button>
              {activeTab === "playbook" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveModalConfig}
                  loading={isSaving}
                  icon="save"
                >
                  Lưu Rule Cứng
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4 w-full">
          {/* Thanh chuyển Tab & Toolbar thao tác gộp gọn gàng trên 1 hàng duy nhất */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <SegmentedControl
              options={[
                {
                  value: "knowledge_db",
                  label: "Kho Tri Thức",
                  icon: "menu_book",
                },
                {
                  value: "playbook",
                  label: "Rule Cứng",
                  icon: "gavel",
                },
              ]}
              value={activeTab}
              onChange={(val) => setActiveTab(val as "knowledge_db" | "playbook")}
              size="sm"
            />

            {activeTab === "knowledge_db" && knowledgeDocs.length > 0 ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant={showSearchSandbox ? "primary" : "secondary"}
                  size="sm"
                  icon="search"
                  onClick={() => setShowSearchSandbox(!showSearchSandbox)}
                >
                  Tìm thử
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  icon="upload_file"
                  onClick={() => {
                    setTargetAppForNewDoc(selectedAppId);
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploadingToDb}
                >
                  Chọn File
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  icon="folder_open"
                  onClick={() => {
                    setTargetAppForNewDoc(selectedAppId);
                    folderInputRef.current?.click();
                  }}
                  disabled={isUploadingToDb}
                >
                  Chọn Folder
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  icon="edit_note"
                  onClick={() => {
                    setTargetAppForNewDoc(selectedAppId);
                    setShowAddRuleModal(true);
                  }}
                >
                  Nhập tay
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  icon="delete_sweep"
                  onClick={handleClearAllKnowledge}
                  title="Xóa toàn bộ tài liệu"
                />
              </div>
            ) : (
              <div className="text-xs text-text-muted flex items-center gap-2">
                <span>Ứng dụng:</span>
                <span className="font-mono font-bold uppercase text-text-main">
                  {selectedAppId}
                </span>
              </div>
            )}
          </div>

          {/* TAB 1: KHO TRI THỨC NGHIỆP VỤ */}
          {activeTab === "knowledge_db" && (
            <div className="space-y-4">
              {/* Thông báo kết quả nạp */}
              {knowledgeUploadMsg && (
                <div className="px-3.5 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-green-600">
                      check_circle
                    </span>
                    <span className="font-medium">{knowledgeUploadMsg}</span>
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

              {/* Hộp Thử Nghiệm Tìm Kiếm (Sandbox) */}
              {showSearchSandbox && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">
                        travel_explore
                      </span>
                      <span className="text-xs font-bold text-text-main">
                        Thử nghiệm truy vấn tri thức (Hybrid RRF + Cross-Encoder Ranker)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSearchSandbox(false)}
                      className="text-text-muted hover:text-text-main cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={testSearchQuery}
                      onChange={(e) => setTestSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleExecuteTestSearch();
                      }}
                      placeholder="Nhập câu hỏi nghiệp vụ cần kiểm tra (VD: Công thức tính chiết khấu VIP, quy định hóa đơn)..."
                      className="flex-1 text-xs"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      icon="search"
                      onClick={handleExecuteTestSearch}
                      loading={isTestingSearch}
                    >
                      Kiểm tra
                    </Button>
                  </div>

                  {testSearchResult && (
                    <div className="pt-2.5 border-t border-border space-y-2">
                      {testSearchResult.isGreeting ? (
                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs">
                          👋 <strong>Chào hỏi xã giao:</strong> AI nhận diện và sẽ phản hồi:{" "}
                          <em>&quot;{testSearchResult.greetingReply}&quot;</em>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-text-muted">
                            Tìm thấy {testSearchResult.topChunks?.length || 0} mục tri thức phù hợp:
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {testSearchResult.topChunks?.map((chunk: any, i: number) => (
                              <div
                                key={chunk.id || i}
                                className="p-3 rounded-xl border border-border bg-surface text-xs space-y-1.5 shadow-2xs"
                              >
                                <div className="flex items-center justify-between">
                                  <Badge variant="primary" size="sm">
                                    Top #{i + 1}
                                  </Badge>
                                  <span className="font-mono text-[10px] text-text-muted truncate max-w-[200px]">
                                    {chunk.breadcrumb}
                                  </span>
                                </div>
                                <h4 className="font-semibold text-text-main text-xs">
                                  {chunk.heading}
                                </h4>
                                <p className="text-text-muted text-[11px] line-clamp-3 font-mono bg-surface/50 p-1.5 rounded-lg border border-border/40">
                                  {chunk.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {/* TRƯỜNG HỢP 1: CHƯA CÓ TÀI LIỆU (EMPTY STATE CARD DÙNG COMPONENT CHUNG) */}
              {knowledgeDocs.length === 0 ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(true);
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={handleDropFiles}
                  className={`rounded-2xl border-2 border-dashed p-8 transition-all flex flex-col items-center justify-center text-center ${
                    isDraggingOver
                      ? "border-primary bg-primary/5 scale-[1.005]"
                      : "border-border bg-surface/40 hover:bg-surface/70 hover:border-primary/40"
                  }`}
                >
                  <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-3xl">
                      {isUploadingToDb ? "sync" : "cloud_upload"}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-text-main">
                    {isUploadingToDb
                      ? "Đang phân tích định dạng và nạp tri thức vào DB..."
                      : isDraggingOver
                        ? "Thả tệp hoặc thư mục vào đây để nạp ngay!"
                        : "Kéo & thả tài liệu nghiệp vụ vào đây"}
                  </h3>

                  <p className="text-xs text-text-muted mt-1 max-w-md leading-relaxed">
                    Tự động bóc tách nội dung, chia nhỏ thành các mục tri thức và nhúng vector vào
                    SQLite DB phục vụ tìm kiếm thông minh.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 my-4">
                    <Badge variant="default" size="sm">
                      PDF
                    </Badge>
                    <Badge variant="default" size="sm">
                      Word (.docx)
                    </Badge>
                    <Badge variant="default" size="sm">
                      Markdown (.md)
                    </Badge>
                    <Badge variant="default" size="sm">
                      Excel / CSV
                    </Badge>
                    <Badge variant="default" size="sm">
                      JSON / TXT
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Button
                      variant="primary"
                      size="sm"
                      icon="upload_file"
                      onClick={() => {
                        setTargetAppForNewDoc(selectedAppId);
                        fileInputRef.current?.click();
                      }}
                      disabled={isUploadingToDb}
                    >
                      Chọn File
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      icon="folder_open"
                      onClick={() => {
                        setTargetAppForNewDoc(selectedAppId);
                        folderInputRef.current?.click();
                      }}
                      disabled={isUploadingToDb}
                    >
                      Chọn Folder
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      icon="edit_note"
                      onClick={() => {
                        setTargetAppForNewDoc(selectedAppId);
                        setShowAddRuleModal(true);
                      }}
                    >
                      Nhập trực tiếp
                    </Button>
                  </div>
                </div>
              ) : (
                /* TRƯỜNG HỢP 2: ĐÃ CÓ TÀI LIỆU TRONG DB */
                <div className="space-y-3">
                  {/* Dải kéo thả bổ sung nhỏ gọn */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={handleDropFiles}
                    className={`px-4 py-2.5 rounded-xl border border-dashed transition-all flex items-center justify-center gap-2 text-center text-xs ${
                      isDraggingOver
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/80 bg-surface/30 text-text-muted hover:border-primary/40 hover:text-text-main"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base text-primary">
                      cloud_upload
                    </span>
                    <span>Kéo thả thêm tệp hoặc thư mục vào đây để bổ sung tri thức</span>
                  </div>

                  {/* Danh sách Thư mục (nếu có) */}
                  {knowledgeFolders.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-text-muted">Thư mục:</span>
                      {knowledgeFolders.map((folder) => (
                        <span
                          key={folder}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border text-text-main text-xs font-mono shadow-2xs"
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

                  {/* Danh sách Thẻ tài liệu lưới 3 cột - Không giới hạn max-h cứng để tránh scroll lồng nhau */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {knowledgeDocs.map((doc) => {
                      const lower = doc.relativePath.toLowerCase();
                      const isPdf = lower.endsWith(".pdf");
                      const isDocx = lower.endsWith(".docx") || lower.endsWith(".doc");

                      return (
                        <Card
                          key={doc.id}
                          className="flex items-center justify-between gap-2.5 p-3 hover:border-primary/40 hover:shadow-2xs transition-all text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isPdf
                                  ? "bg-red-500/10 text-red-500"
                                  : isDocx
                                    ? "bg-blue-500/10 text-blue-500"
                                    : "bg-primary/10 text-primary"
                              }`}
                            >
                              <span className="material-symbols-outlined text-lg">
                                {isPdf ? "picture_as_pdf" : isDocx ? "article" : "description"}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p
                                className="font-mono font-semibold text-text-main truncate text-xs"
                                title={doc.relativePath}
                              >
                                {doc.relativePath}
                              </p>
                              <p className="text-[11px] text-text-muted mt-0.5">
                                {(doc.rawSize / 1024).toFixed(1)} KB •{" "}
                                <span className="font-medium text-primary">
                                  {doc.chunkCount} mục
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleInspectDocChunks(doc)}
                              className="size-7 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 flex items-center justify-center cursor-pointer transition-colors"
                              title="Xem chi tiết các mục (Chunks)"
                            >
                              <span className="material-symbols-outlined text-base">
                                visibility
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTriggerDocOverwrite(doc)}
                              disabled={isUploadingToDb}
                              className="size-7 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 flex items-center justify-center cursor-pointer transition-colors"
                              title="Nạp đè / Cập nhật file mới cho tài liệu này"
                            >
                              <span className="material-symbols-outlined text-base">sync</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteKnowledgeDoc(selectedAppId, doc.id)}
                              className="size-7 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center cursor-pointer transition-colors"
                              title="Xóa tài liệu"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RULE CỨNG HỆ THỐNG (SYSTEM PROMPT OVERRIDE) */}
          {activeTab === "playbook" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-base text-amber-600 shrink-0 mt-0.5">
                  info
                </span>
                <p className="leading-relaxed">
                  Rule cứng được nạp cố định vào System Prompt ở mọi lượt hội thoại của dự án{" "}
                  <strong className="uppercase font-mono">{selectedAppId}</strong> để kiểm soát hành
                  vi AI (ví dụ: quy định lọc chi nhánh mặc định, định dạng tiền tệ VNĐ, trạng thái
                  dữ liệu bắt buộc...).
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-text-muted font-mono">
                  <span>SYSTEM_PROMPT_OVERRIDE.md</span>
                  <span>{playbookPrompt.length} ký tự</span>
                </div>
                <Textarea
                  value={playbookPrompt}
                  onChange={(e) => setPlaybookPrompt(e.target.value)}
                  placeholder={
                    "# QUY TẮC BẮT BUỘC:\n1. Luôn thêm điều kiện IsDeleted = 0 vào mệnh đề WHERE.\n2. Định dạng số tiền là VNĐ kèm phân cách hàng nghìn.\n3. Nếu người dùng không chỉ định chi nhánh, mặc định lấy chi nhánh hiện tại."
                  }
                  rows={14}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL NHẬP TAY TÀI LIỆU NGHIỆP VỤ VÀO SQLITE DB */}
      <Modal
        isOpen={showAddRuleModal}
        title={`Nhập tài liệu tri thức: ${customAppName || selectedAppId}`}
        onClose={() => setShowAddRuleModal(false)}
        size="lg"
        footer={
          <div className="flex justify-end gap-2.5 w-full">
            <Button variant="outline" size="sm" onClick={() => setShowAddRuleModal(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateManualKnowledgeInDb}
              disabled={!newRuleContent.trim() || (!newRuleName.trim() && !newRuleFileName.trim())}
              loading={isSubmittingRule}
              icon="save"
            >
              Lưu vào DB
            </Button>
          </div>
        }
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
                placeholder="Ví dụ: Quy tắc Doanh thu"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-main mb-1 block">
                Tên định danh (.md) *
              </label>
              <Input
                value={newRuleFileName}
                onChange={(e) => setNewRuleFileName(e.target.value)}
                placeholder="doanh_thu.md"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-main mb-1 block">
                Thư mục (tùy chọn)
              </label>
              <Input
                value={targetFolderForNewDoc}
                onChange={(e) => setTargetFolderForNewDoc(e.target.value)}
                placeholder="doanh_thu"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-main mb-1 block">
              Nội dung tài liệu nghiệp vụ (Markdown / Text) *
            </label>
            <Textarea
              value={newRuleContent}
              onChange={(e) => setNewRuleContent(e.target.value)}
              placeholder={
                "## 1. Quy tắc bảng SaleService\n- Bảng phiếu: SaleService (CreatedDate, BranchId, IsDeleted = 0)\n- Bảng chi tiết: SaleServiceDetail (Amount, TotalPayment)\n\n## 2. Công thức tính\n- SUM(TotalPayment)..."
              }
              rows={9}
              className="font-mono text-xs leading-relaxed"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL XEM CHI TIẾT CÁC CHUNK KIẾN THỨC CỦA 1 TÀI LIỆU */}
      <Modal
        isOpen={Boolean(inspectingDoc)}
        title={inspectingDoc ? `Chi tiết tri thức: ${inspectingDoc.docName}` : "Chi tiết Chunks"}
        onClose={() => setInspectingDoc(null)}
        size="full"
        className="max-w-4xl"
        footer={
          <div className="flex justify-end w-full">
            <Button variant="outline" size="sm" onClick={() => setInspectingDoc(null)}>
              Đóng
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3.5">
          {inspectingDoc && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface border border-border text-xs">
              <div className="min-w-0 flex-1">
                <span className="text-text-muted">Đường dẫn: </span>
                <code className="font-mono font-bold text-text-main break-all">
                  {inspectingDoc.relativePath}
                </code>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="primary" size="sm">
                  {inspectingDoc.chunkCount} mục kiến thức
                </Badge>
                <Badge variant="default" size="sm">
                  {(inspectingDoc.rawSize / 1024).toFixed(1)} KB
                </Badge>
              </div>
            </div>
          )}

          {isLoadingChunks ? (
            <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-2xl text-primary">
                progress_activity
              </span>
              <span>Đang tải danh sách các chunk từ SQLite DB...</span>
            </div>
          ) : inspectingDocChunks.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted border border-dashed border-border rounded-xl">
              Không tìm thấy chunk nào cho tài liệu này.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {inspectingDocChunks.map((chunk, idx) => (
                <div
                  key={chunk.id || idx}
                  className="p-4 rounded-xl border border-border bg-surface/70 space-y-3 hover:border-primary/40 transition-colors shadow-2xs"
                >
                  {editingChunkId === chunk.id ? (
                    /* CHẾ ĐỘ CHỈNH SỬA TRỰC TIẾP CHUNK */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="primary" size="sm">
                            Đang sửa Chunk #{idx + 1}
                          </Badge>
                          <span className="text-xs font-semibold text-text-main">
                            Chỉnh sửa quy tắc / công thức
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-text-muted truncate max-w-[200px]">
                          {chunk.breadcrumb}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-text-main block">
                          Tiêu đề mục tri thức *
                        </label>
                        <Input
                          value={editChunkHeading}
                          onChange={(e) => setEditChunkHeading(e.target.value)}
                          placeholder="Nhập tiêu đề mục..."
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-text-main block">
                          Nội dung tri thức chi tiết (Markdown / Text) *
                        </label>
                        <Textarea
                          value={editChunkContent}
                          onChange={(e) => setEditChunkContent(e.target.value)}
                          rows={6}
                          placeholder="Nội dung công thức, quy tắc..."
                          className="font-mono text-xs leading-relaxed"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEditChunk}
                          disabled={isSavingChunk}
                        >
                          Hủy
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon="save"
                          loading={isSavingChunk}
                          onClick={() => handleSaveChunkEdit(chunk)}
                          disabled={!editChunkContent.trim()}
                        >
                          Lưu mục
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* CHẾ ĐỘ XEM CHUNK BÌNH THƯỜNG */
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="primary" size="sm">
                            Chunk #{idx + 1}
                          </Badge>
                          <h4 className="font-bold text-xs text-text-main">{chunk.heading}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-text-muted truncate max-w-[220px]">
                            {chunk.breadcrumb}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartEditChunk(chunk)}
                            className="size-7 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 flex items-center justify-center cursor-pointer transition-colors"
                            title="Chỉnh sửa mục tri thức này"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                        </div>
                      </div>

                      {chunk.preview && (
                        <p className="text-[11px] text-text-muted italic bg-surface p-2 rounded-lg border border-border/40">
                          💡 {chunk.preview}
                        </p>
                      )}

                      <pre className="text-xs font-mono p-3 rounded-lg bg-surface/90 border border-border text-text-main whitespace-pre-wrap break-words leading-relaxed">
                        {chunk.content}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

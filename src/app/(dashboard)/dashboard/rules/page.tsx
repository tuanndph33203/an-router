"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Input, Modal } from "@/shared/components";

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

interface RuleBook {
  id: string;
  name: string;
  fileName: string;
  relativePath: string;
  category: string;
  description: string;
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
  const [allRuleBooks, setAllRuleBooks] = useState<RuleBook[]>([]);
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
  const [activeTab, setActiveTab] = useState<"knowledge_db" | "rules" | "playbook">("knowledge_db");
  const [selectedAppId, setSelectedAppId] = useState<string>("his");
  const [customAppName, setCustomAppName] = useState<string>("HIS Medical System");
  const [appConfig, setAppConfig] = useState<AppConfigData | null>(null);
  const [playbookPrompt, setPlaybookPrompt] = useState<string>("");
  const [assignedRuleIds, setAssignedRuleIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Modal Thêm Tài liệu / Kiến thức Nghiệp vụ Mới vào DB
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [addMode, setAddMode] = useState<"folder_or_file" | "manual_text">("folder_or_file");
  const [targetAppForNewDoc, setTargetAppForNewDoc] = useState<string>("his");
  const [targetFolderForNewDoc, setTargetFolderForNewDoc] = useState<string>("");
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleFileName, setNewRuleFileName] = useState("");
  const [newRuleContent, setNewRuleContent] = useState("");
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);

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
      const [keysRes, rulesRes, appsRes] = await Promise.all([
        fetch("/api/keys"),
        fetch("/api/rules?sync=true"),
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
      if (rulesRes.ok) {
        const json = await rulesRes.json();
        const loadedRules = Array.isArray(json.Data) ? json.Data : [];
        setAllRuleBooks(loadedRules);
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
    loadInitialData();
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
      const lowerName = (key.name || "").toLowerCase();
      app = lowerName.includes("cmms") ? "cmms" : "his";
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
        setAssignedRuleIds(json.Data?.assignedRuleIds || []);
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

  // Đổi App trong Popup
  const handleAppChange = async (appId: string) => {
    setSelectedAppId(appId);
    setActiveKnowledgeAppId(appId);
    await fetchKnowledgeDbForApp(appId);
    try {
      const res = await fetch(`/api/orchestrator/app-config?appId=${encodeURIComponent(appId)}`);
      if (res.ok) {
        const json = await res.json();
        setAppConfig(json.Data);
        setPlaybookPrompt(json.Data?.domainPlaybook || "");
      }
    } catch (e) {
      console.warn("Failed to load app config:", e);
    }
  };

  // Lưu toàn bộ cấu hình trong Popup
  const handleSaveModalConfig = async () => {
    if (!activeKey) return;
    setIsSaving(true);
    try {
      await fetch(`/api/keys/${encodeURIComponent(activeKey.id)}/rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleIds: assignedRuleIds,
          appId: selectedAppId,
          appName: customAppName,
        }),
      });

      if (appConfig) {
        await fetch("/api/orchestrator/app-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...appConfig,
            domainPlaybook: playbookPrompt,
          }),
        });
      }

      setSaveSuccessNotice(true);
      await loadInitialData();
      setTimeout(() => {
        setSaveSuccessNotice(false);
        setShowConfigModal(false);
      }, 1000);
    } catch (e) {
      console.warn("Failed to save modal config:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredKeys = keys.filter(
    (k) =>
      !searchQuery.trim() ||
      k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.id.toLowerCase().includes(searchQuery.toLowerCase())
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
        accept=".md,.markdown,.txt,.json,.csv"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-border rounded-2xl p-6 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="size-13 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-500/20">
            <span className="material-symbols-outlined text-3xl">menu_book</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-text-main">
                Tài liệu Nghiệp vụ &amp; Kho Kiến thức DB
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Knowledge DB + Rule Luồng (.md)
              </span>
            </div>
            <p className="text-sm text-text-muted mt-1.5 max-w-3xl leading-relaxed">
              Quản lý tách biệt 2 tầng: <strong>(1) DB Lưu Kiến Thức Nghiệp Vụ</strong> (nạp nguyên
              Folder hoặc File vào SQLite DB phục vụ <em>Luồng Search Nghiệp Vụ</em>) và{" "}
              <strong>(2) Rule Luồng Cố Định (.md)</strong> luôn truyền vào Prompt.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            onClick={loadInitialData}
            variant="ghost"
            className="gap-2 text-xs border border-border"
          >
            <span className="material-symbols-outlined text-base">sync</span>
            Làm mới
          </Button>
          <Button
            onClick={() => {
              setTargetAppForNewDoc(activeKnowledgeAppId || "his");
              setAddMode("folder_or_file");
              setShowAddRuleModal(true);
            }}
            className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <span className="material-symbols-outlined text-base">cloud_upload</span>+ Nạp Tài liệu
            / Folder vào DB
          </Button>
        </div>
      </div>

      {/* KHU VỰC TRỰC QUAN: KHO KIẾN THỨC NGHIỆP VỤ TRONG SQLITE DB */}
      <Card className="p-5 border border-emerald-500/30 bg-emerald-500/5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">database</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                Kho Kiến Thức Nghiệp Vụ Đang Lưu Trong SQLite DB (Phục Vụ Luồng Search Nghiệp Vụ)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Tài liệu nạp tại đây được tự động băm nhỏ vào bảng{" "}
                <code className="font-mono">knowledge_documents</code> &amp;{" "}
                <code className="font-mono">knowledge_chunks</code> để AI tìm kiếm ở bước giữa
                OpenAPI Locator và DB Table Locator.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-text-main">Ứng dụng (App):</span>
              <select
                value={activeKnowledgeAppId}
                onChange={(e) => {
                  setActiveKnowledgeAppId(e.target.value);
                  setTargetAppForNewDoc(e.target.value);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-surface text-text-main"
              >
                {availableApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.id} — {app.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setTargetAppForNewDoc(activeKnowledgeAppId);
                folderInputRef.current?.click();
              }}
              disabled={isUploadingToDb}
              className="gap-1.5 text-xs font-semibold border border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            >
              <span className="material-symbols-outlined text-base">folder_open</span>
              Chọn Folder nạp vào DB
            </Button>

            <Button
              type="button"
              onClick={() => {
                setTargetAppForNewDoc(activeKnowledgeAppId);
                fileInputRef.current?.click();
              }}
              disabled={isUploadingToDb}
              className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              Chọn File nạp vào DB
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTargetAppForNewDoc(activeKnowledgeAppId);
                setAddMode("manual_text");
                setShowAddRuleModal(true);
              }}
              className="gap-1.5 text-xs font-semibold border border-border bg-surface"
            >
              <span className="material-symbols-outlined text-base">edit_note</span>
              Nhập nội dung trực tiếp
            </Button>
          </div>
        </div>

        {knowledgeUploadMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{knowledgeUploadMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setKnowledgeUploadMsg(null)}
              className="text-text-muted hover:text-text-main"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Danh sách Folder và Tài liệu trong DB */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span>
              Ứng dụng <strong className="uppercase">{activeKnowledgeAppId}</strong> đang có:{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {knowledgeDocs.length} tài liệu
              </strong>{" "}
              ({totalKnowledgeChunks} mục kiến thức trong SQLite DB)
            </span>
          </div>

          {knowledgeFolders.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {knowledgeFolders.map((folder) => (
                <span
                  key={folder}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-mono"
                >
                  <span className="material-symbols-outlined text-sm">folder</span>
                  Folder: {folder}
                  <button
                    type="button"
                    onClick={() => handleDeleteKnowledgeFolder(activeKnowledgeAppId, folder)}
                    className="ml-1 hover:text-red-500"
                    title={`Xóa folder ${folder} khỏi DB`}
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}

          {knowledgeDocs.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-emerald-500/30 bg-surface/70 text-center text-xs text-text-muted">
              Chưa có tài liệu nào trong DB Kiến thức của ứng dụng{" "}
              <strong className="uppercase">{activeKnowledgeAppId}</strong>. Hãy bấm{" "}
              <strong>&quot;Chọn Folder nạp vào DB&quot;</strong>,{" "}
              <strong>&quot;Chọn File nạp vào DB&quot;</strong> hoặc{" "}
              <strong>&quot;Nhập nội dung trực tiếp&quot;</strong> ở góc phải phía trên.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1">
              {knowledgeDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface shadow-2xs text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">
                      description
                    </span>
                    <div className="min-w-0">
                      <p
                        className="font-mono font-semibold text-text-main truncate"
                        title={doc.relativePath}
                      >
                        {doc.relativePath}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {doc.chunkCount} mục kiến thức • {(doc.rawSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteKnowledgeDoc(activeKnowledgeAppId, doc.id)}
                    className="text-text-muted hover:text-red-500 p-1 shrink-0"
                    title="Xóa khỏi DB Kiến thức"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

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
          <div className="col-span-3">DỰ ÁN / TÊN KHÓA API</div>
          <div className="col-span-2">ỨNG DỤNG (APP)</div>
          <div className="col-span-2">MÃ X-API-KEY</div>
          <div className="col-span-3">RULE LUỒNG (.MD) ĐÃ GÁN</div>
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
                  <div className="col-span-3 flex items-center gap-3.5">
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

                  <div className="col-span-2 flex flex-col gap-1 min-w-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 w-fit">
                      <span className="size-1.5 rounded-full bg-purple-500"></span>
                      {meta.appId}
                    </span>
                    <span className="text-xs text-text-muted font-medium truncate">
                      {meta.appName}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center">
                    <code className="text-xs font-mono text-text-muted bg-surface/90 px-2 py-1 rounded-md border border-border/80 truncate max-w-full">
                      {k.key}
                    </code>
                  </div>

                  <div className="col-span-3 flex flex-wrap items-center gap-1.5">
                    {meta.assignedCount === 0 ? (
                      <span className="text-xs text-text-muted italic">
                        Dùng Rule luồng mặc định
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        {meta.assignedCount} File Rule Luồng (.md)
                      </span>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2 w-full md:w-auto">
                    <Button
                      onClick={() => handleOpenConfigModal(k)}
                      className="gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 shadow-2xs font-medium"
                    >
                      <span className="material-symbols-outlined text-base">tune</span>
                      Cấu hình Tri thức
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* POPUP CẤU HÌNH CHO TỪNG KHÓA API */}
      <Modal
        isOpen={showConfigModal}
        title={`Cấu hình Tri thức AI: ${activeKey?.name || ""}`}
        onClose={() => setShowConfigModal(false)}
        size="full"
      >
        <div className="flex flex-col gap-5 w-full">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-surface/70 border border-border text-xs">
            <div className="flex items-center gap-3">
              <span className="text-text-muted font-medium">Khóa API:</span>
              <code className="font-mono font-semibold text-text-main bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded border border-border">
                {activeKey?.key}
              </code>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-text-muted font-medium">Application ID:</span>
                <select
                  value={selectedAppId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    handleAppChange(nextId);
                    const found = availableApps.find(
                      (a) => a.id.toLowerCase() === nextId.toLowerCase()
                    );
                    if (found) setCustomAppName(found.name);
                  }}
                  className="font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface text-text-main"
                >
                  {availableApps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.id} ({app.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex border-b border-border gap-6">
            <button
              onClick={() => setActiveTab("knowledge_db")}
              className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "knowledge_db"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-text-muted hover:text-text-main"
              }`}
            >
              <span className="material-symbols-outlined text-base">database</span>
              1. DB Lưu Kiến Thức Nghiệp Vụ ({knowledgeDocs.length} tài liệu /{" "}
              {totalKnowledgeChunks} mục)
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "rules"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-text-muted hover:text-text-main"
              }`}
            >
              <span className="material-symbols-outlined text-base">menu_book</span>
              2. Rule Luồng Cố Định .md ({assignedRuleIds.length} đã gán)
            </button>
            <button
              onClick={() => setActiveTab("playbook")}
              className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "playbook"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-text-muted hover:text-text-main"
              }`}
            >
              <span className="material-symbols-outlined text-base">psychology</span>
              3. Prompt Playbook Cố Định (.md)
            </button>
          </div>

          {activeTab === "knowledge_db" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-text-muted">
                  Tài liệu lưu trong SQLite DB của ứng dụng{" "}
                  <strong className="uppercase">{selectedAppId}</strong> để phục vụ{" "}
                  <strong>Luồng Search Nghiệp Vụ</strong>:
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setTargetAppForNewDoc(selectedAppId);
                      folderInputRef.current?.click();
                    }}
                    className="gap-1.5 text-xs border border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                  >
                    <span className="material-symbols-outlined text-base">folder_open</span>
                    Tải Folder vào DB
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setTargetAppForNewDoc(selectedAppId);
                      fileInputRef.current?.click();
                    }}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <span className="material-symbols-outlined text-base">upload_file</span>
                    Tải File vào DB
                  </Button>
                </div>
              </div>

              {knowledgeDocs.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-border text-center text-xs text-text-muted">
                  Chưa có tài liệu nào trong DB Kiến thức của <strong>{selectedAppId}</strong>. Bấm{" "}
                  <strong>&quot;Tải Folder vào DB&quot;</strong> hoặc{" "}
                  <strong>&quot;Tải File vào DB&quot;</strong> để nạp ngay.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto p-1">
                  {knowledgeDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-text-main truncate">
                          {doc.relativePath}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          {doc.chunkCount} mục kiến thức trong DB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteKnowledgeDoc(selectedAppId, doc.id)}
                        className="text-text-muted hover:text-red-500 p-1"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "rules" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto p-1">
              {allRuleBooks.map((rb) => {
                const isChecked = assignedRuleIds.includes(rb.id);
                return (
                  <label
                    key={rb.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500/60"
                        : "bg-surface/60 border-border text-text-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignedRuleIds((prev) => [...prev, rb.id]);
                        } else {
                          setAssignedRuleIds((prev) => prev.filter((id) => id !== rb.id));
                        }
                      }}
                      className="mt-1 size-4"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-xs text-text-main block truncate">
                        {rb.name}
                      </span>
                      <p className="text-[11px] font-mono text-text-muted truncate mt-0.5">
                        📄 {rb.fileName}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {activeTab === "playbook" && (
            <textarea
              value={playbookPrompt}
              onChange={(e) => setPlaybookPrompt(e.target.value)}
              placeholder="Nhập Rule luồng cố định (.md) luôn được truyền vào Prompt..."
              rows={12}
              className="w-full text-xs font-mono p-4 rounded-xl border border-border bg-surface/50 text-text-main"
            />
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-xs text-emerald-600 font-semibold">
              {saveSuccessNotice && "Đã lưu cấu hình thành công!"}
            </span>
            <div className="flex gap-2.5">
              <Button onClick={() => setShowConfigModal(false)} variant="ghost" className="text-xs">
                Đóng
              </Button>
              <Button
                onClick={handleSaveModalConfig}
                loading={isSaving}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-6"
              >
                Lưu cấu hình
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL THÊM TÀI LIỆU / NẠP FOLDER VÀO SQLITE DB */}
      <Modal
        isOpen={showAddRuleModal}
        title="Nạp Tài liệu Nghiệp vụ vào SQLite DB (Phục vụ Luồng Search Nghiệp Vụ)"
        onClose={() => setShowAddRuleModal(false)}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {/* Chọn Ứng dụng đích */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-main mb-1 block">
                1. Chọn Ứng dụng (App ID) *
              </label>
              <select
                value={targetAppForNewDoc}
                onChange={(e) => setTargetAppForNewDoc(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface text-text-main font-semibold"
              >
                {availableApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.id} — {app.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-main mb-1 block">
                Nhóm / Tên Folder trong DB (tùy chọn)
              </label>
              <Input
                value={targetFolderForNewDoc}
                onChange={(e) => setTargetFolderForNewDoc(e.target.value)}
                placeholder="Ví dụ: doanh_thu, ton_kho..."
              />
            </div>
          </div>

          {/* Chuyển đổi phương thức nạp: Chọn Folder/File từ máy vs Nhập trực tiếp */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface border border-border">
            <button
              type="button"
              onClick={() => setAddMode("folder_or_file")}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                addMode === "folder_or_file"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <span className="material-symbols-outlined text-base">folder_open</span>
              Cách 1: Tải Folder / File từ máy
            </button>
            <button
              type="button"
              onClick={() => setAddMode("manual_text")}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                addMode === "manual_text"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <span className="material-symbols-outlined text-base">edit_note</span>
              Cách 2: Nhập / Dán nội dung trực tiếp
            </button>
          </div>

          {addMode === "folder_or_file" ? (
            <div className="p-6 rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 flex flex-col items-center justify-center text-center gap-3">
              <span className="material-symbols-outlined text-4xl text-emerald-600 dark:text-emerald-400">
                cloud_upload
              </span>
              <div>
                <p className="text-sm font-bold text-text-main">
                  Chọn nguyên một Folder hoặc nhiều File tài liệu (.md, .txt, .json, .csv)
                </p>
                <p className="text-xs text-text-muted mt-1 max-w-md">
                  Hệ thống sẽ tự động đọc toàn bộ file, băm nhỏ theo từng đề mục và lưu thẳng vào
                  bảng SQLite DB (<code className="font-mono">knowledge_documents</code> &amp;{" "}
                  <code className="font-mono">knowledge_chunks</code>) của ứng dụng{" "}
                  <strong className="uppercase">{targetAppForNewDoc}</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <Button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  loading={isUploadingToDb}
                  className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5"
                >
                  <span className="material-symbols-outlined text-base">folder_open</span>
                  Chọn cả Folder từ máy tính
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  loading={isUploadingToDb}
                  className="gap-2 text-xs border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 px-5 py-2.5"
                >
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  Chọn các File lẻ (.md, .txt...)
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-main mb-1 block">
                    Tiêu đề tài liệu *
                  </label>
                  <Input
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="Ví dụ: Quy tắc tính Doanh thu Dịch vụ"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-main mb-1 block">
                    Tên định danh trong DB (.md) *
                  </label>
                  <Input
                    value={newRuleFileName}
                    onChange={(e) => setNewRuleFileName(e.target.value)}
                    placeholder="Ví dụ: doanh_thu_dich_vu.md"
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
                  disabled={
                    !newRuleContent.trim() || (!newRuleName.trim() && !newRuleFileName.trim())
                  }
                  loading={isSubmittingRule}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Lưu trực tiếp vào SQLite DB Kiến thức
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

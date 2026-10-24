"use client";

import { useState, useEffect } from "react";
import { AppsHeader } from "./components/AppsHeader";
import { AppsStatsCards } from "./components/AppsStatsCards";
import { AppsTable, type AppItem } from "./components/AppsTable";
import { AppConfigModal } from "./components/AppConfigModal";

interface RuleBookItem {
  id: string;
  name: string;
  fileName: string;
}

export default function ApplicationsManagementPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [ruleBooks, setRuleBooks] = useState<RuleBookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Popup Modal Cấu Hình Toàn Diện
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [appsRes, rulesRes] = await Promise.all([
        fetch("/api/orchestrator/apps"),
        fetch("/api/rules?sync=true"),
      ]);

      if (appsRes.ok) {
        const json = await appsRes.json();
        setApps(Array.isArray(json.Data) ? json.Data : []);
      }
      if (rulesRes.ok) {
        const json = await rulesRes.json();
        setRuleBooks(Array.isArray(json.Data) ? json.Data : []);
      }
    } catch (err) {
      console.error("[AppsPage] Lỗi khi nạp dữ liệu:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOpenAddNew = () => {
    setSelectedApp(null);
    setIsModalOpen(true);
  };

  const handleOpenConfig = (app: AppItem) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  const handleAppDeleted = (deletedKey: string) => {
    setApps((prev) => prev.filter((a) => a.microsoftClientKey !== deletedKey));
  };

  const apiAppsCount = apps.filter((a) => a.capabilities?.includes("api")).length;
  const sqlAppsCount = apps.filter((a) => a.capabilities?.includes("sql")).length;

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* 1. Header & Quick Actions */}
      <AppsHeader onRefresh={fetchInitialData} onAddNew={handleOpenAddNew} />

      {/* 2. Thống kê tổng quan */}
      <AppsStatsCards
        totalApps={apps.length}
        apiAppsCount={apiAppsCount}
        sqlAppsCount={sqlAppsCount}
      />

      {/* 3. Bảng danh sách ứng dụng kết nối (Chỉ xem và bấm mở Popup) */}
      <AppsTable
        apps={apps}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenConfig={handleOpenConfig}
      />

      {/* 4. POPUP CẤU HÌNH DUY NHẤT (Thêm mới / Sửa / Test Ping / Xóa trong Modal) */}
      <AppConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        app={selectedApp}
        ruleBooks={ruleBooks}
        onSaved={fetchInitialData}
        onDeleted={handleAppDeleted}
      />
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Card, Input, Toggle } from "@/shared/components";
import ApiKeyFilterChip from "./ApiKeyFilterChip";
import type { KeyStatus, KeyType, ApiKeyCounts } from "../apiManagerPageUtils";

export interface DynamicAppFilterItem {
  id?: string;
  name: string;
  microsoftClientKey?: string;
  keyCount?: number;
}

interface ApiKeyFilterBarProps {
  counts: ApiKeyCounts;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  statusFilter: KeyStatus | null;
  onStatusChange: (s: KeyStatus | null) => void;
  typeFilter: KeyType | null;
  onTypeChange: (t: KeyType | null) => void;
  apps?: DynamicAppFilterItem[];
  appFilter?: string | null;
  onAppFilterChange?: (appId: string | null) => void;
  unassignedCount?: number;
  onClearFilters?: () => void;
  isFiltered?: boolean;
}

export default function ApiKeyFilterBar({
  counts,
  searchQuery,
  onSearchChange,
  activeOnly,
  onActiveOnlyChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  apps = [],
  appFilter = null,
  onAppFilterChange,
  unassignedCount = 0,
  onClearFilters,
  isFiltered = false,
}: ApiKeyFilterBarProps) {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");

  const statusChips: Array<{
    value: KeyStatus | null;
    label: string;
    dotColor: string | null;
    count: number;
  }> = [
    { value: null, label: t("filterAll"), dotColor: null, count: counts.total },
    {
      value: "active",
      label: t("filterStatusActive"),
      dotColor: "bg-green-500",
      count: counts.active,
    },
    {
      value: "disabled",
      label: t("filterStatusDisabled"),
      dotColor: "bg-gray-500",
      count: counts.disabled,
    },
    {
      value: "banned",
      label: t("filterStatusBanned"),
      dotColor: "bg-red-500",
      count: counts.banned,
    },
    {
      value: "expired",
      label: t("filterStatusExpired"),
      dotColor: "bg-amber-500",
      count: counts.expired,
    },
  ];

  const typeChips: Array<{
    value: KeyType | null;
    label: string;
    dotColor: string | null;
    count: number;
  }> = [
    { value: null, label: t("filterAll"), dotColor: null, count: counts.total },
    {
      value: "standard",
      label: t("filterTypeStandard"),
      dotColor: "bg-slate-500",
      count: counts.standard,
    },
    {
      value: "manage",
      label: t("filterTypeManage"),
      dotColor: "bg-rose-500",
      count: counts.manage,
    },
    {
      value: "restricted",
      label: t("filterTypeRestricted"),
      dotColor: "bg-amber-500",
      count: counts.restricted,
    },
  ];

  return (
    <Card padding="sm">
      <div className="flex flex-col gap-2.5">
        {/* Row 1: Search + Application Select + Active Only toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              icon="search"
              inputClassName={searchQuery ? "pr-9 text-xs" : "text-xs"}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-text-muted hover:text-text-primary transition-colors"
                aria-label={tc("clear")}
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {apps.length > 0 && onAppFilterChange && (
            <div className="relative min-w-[190px] max-w-[280px]">
              <select
                value={appFilter ?? ""}
                onChange={(e) => onAppFilterChange(e.target.value ? e.target.value : null)}
                className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 cursor-pointer"
                aria-label={t("filterApp")}
              >
                <option value="">
                  {t("allApps")} ({counts.total})
                </option>
                {apps.map((app) => {
                  const val = app.microsoftClientKey || app.id || app.name;
                  return (
                    <option key={val} value={val}>
                      {app.name} ({app.keyCount ?? 0})
                    </option>
                  );
                })}
                {unassignedCount > 0 && (
                  <option value="__none__">
                    {t("unassignedApp")} ({unassignedCount})
                  </option>
                )}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
                expand_more
              </span>
            </div>
          )}

          <Toggle
            size="sm"
            checked={activeOnly}
            onChange={(v) => {
              onActiveOnlyChange(v);
              if (v && statusFilter !== null && statusFilter !== "active") {
                onStatusChange(null);
              }
            }}
            label={t("activeOnly")}
            className="rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-xs shrink-0"
          />

          {isFiltered && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs text-text-muted hover:text-red-500 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-bg-subtle hover:border-red-500/30 hover:bg-red-500/5 transition-colors shrink-0"
              title={t("clearFilters")}
            >
              <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
              <span>{t("clearFilters")}</span>
            </button>
          )}
        </div>

        {/* Row 2: Status + Type + Application Filter Chips */}
        <div className="border-t border-border/70 pt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          {/* Application Chips (when <= 5 apps for instant 1-click filtering) */}
          {apps.length > 0 && apps.length <= 5 && onAppFilterChange && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mr-0.5 flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">apps</span>
                  {t("filterApp")}:
                </span>
                <ApiKeyFilterChip
                  label={t("filterAll")}
                  count={counts.total}
                  isActive={appFilter === null}
                  onClick={() => onAppFilterChange(null)}
                />
                {apps.map((app) => {
                  const val = app.microsoftClientKey || app.id || app.name;
                  const isSelected = appFilter === val;
                  return (
                    <ApiKeyFilterChip
                      key={val}
                      label={app.name}
                      count={app.keyCount}
                      isActive={isSelected}
                      dotColor="bg-indigo-500"
                      onClick={() => onAppFilterChange(isSelected ? null : val)}
                    />
                  );
                })}
              </div>
              <div aria-hidden="true" className="hidden lg:block h-4 w-px bg-border self-center" />
            </>
          )}

          {/* STATUS chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mr-0.5">
              {t("filterStatus")}:
            </span>
            {statusChips.map((chip) => (
              <ApiKeyFilterChip
                key={chip.value ?? "all"}
                label={chip.label}
                count={chip.count}
                isActive={
                  statusFilter === chip.value ||
                  (chip.value === "active" && activeOnly && statusFilter === null)
                }
                dotColor={chip.dotColor}
                onClick={() => {
                  onStatusChange(chip.value);
                  if (chip.value !== null && chip.value !== "active" && activeOnly) {
                    onActiveOnlyChange(false);
                  }
                }}
              />
            ))}
          </div>

          <div aria-hidden="true" className="hidden lg:block h-4 w-px bg-border self-center" />

          {/* TYPE chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mr-0.5">
              {t("filterType")}:
            </span>
            {typeChips.map((chip) => (
              <ApiKeyFilterChip
                key={chip.value ?? "all"}
                label={chip.label}
                count={chip.count}
                isActive={typeFilter === chip.value}
                dotColor={chip.dotColor}
                onClick={() => onTypeChange(chip.value)}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

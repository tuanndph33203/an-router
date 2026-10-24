export interface OmniChatConfig {
  microsoftClientKey?: string;
  appId?: string;
  appTitle?: string;
  appSubtitle?: string;
  logoUrl?: string;
  orchestratorUrl?: string;
  reportApiUrl?: string;
  themeColor?: string;
  apiKey?: string;
  authToken?: string | (() => string | null | undefined | Promise<string | null | undefined>);
  getContext?: () => Record<string, any> | Promise<Record<string, any>>;
  onAction?: (action: any) => void;
  welcomeMessage?: string;
  quickSuggestions?: string[];
  position?: "bottom-right" | "bottom-left";
  zIndex?: number;
}

export interface ChatAttachment {
  name: string;
  size: number;
  type: string;
  base64?: string;
}

export interface LiveStepItem {
  stepIndex: number;
  name: string;
  action?: string;
  status: "pending" | "running" | "success" | "error";
  detail?: string;
}

export interface ChartSpec {
  chartType: string;
  title?: string;
  categoryColumn?: string;
  valueColumns?: string[];
}

export interface ReportTableData {
  columns: string[];
  data: any[];
  rowCount?: number;
  executionTimeMs?: number;
  downloadUrl?: string;
  downloadFileName?: string;
  chartSpec?: ChartSpec;
}

export interface ActionPlanStep {
  step: number;
  name: string;
  action: string;
  endpoint: string;
  resolved_payload: Record<string, any>;
  missing_required_fields?: string[];
}

export interface ActionPlan {
  planId: string;
  applicationId: string;
  status: number;
  botMessage?: string;
  nextStepDetail?: ActionPlanStep;
  missingFields?: Record<string, any>;
  synthesizedData?: any;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot" | "system";
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  streamingStatus?: string;
  elapsedSeconds?: number;
  liveSteps?: LiveStepItem[];
  showSteps?: boolean;
  activeView?: "chart" | "table";
  plan?: ActionPlan;
  reportTable?: ReportTableData;
  attachments?: ChatAttachment[];
  isConfirmed?: boolean;
  userInputs?: Record<string, any>;
  heavyQuery?: {
    isHeavy: boolean;
    estimatedRows?: number;
    sql: string;
    applicationId: string;
    summary?: string;
    jobId?: string;
    hangfireJobId?: string;
    status?: string;
  };
}

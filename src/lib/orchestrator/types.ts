export enum AgentInteractionStatus {
  Completed = 0,
  NeedInput = 1,
  ConfirmationRequired = 2,
}

export interface FieldOptionItem {
  label?: string;
  value?: any;
}

export interface MissingFieldRequirement {
  field_name?: string;
  fieldName?: string;
  field_label?: string;
  fieldLabel?: string;
  field_type?: string;
  fieldType?: string;
  is_required?: boolean;
  isRequired?: boolean;
  options?: any[];
  Options?: any[];
}

export interface ActionPlanStepItem {
  stepIndex: number;
  name: string;
  action?: string;
  endpoint?: string;
  status?: "pending" | "running" | "success" | "error";
  detail?: string;
}

export interface StepMappingResult {
  step?: number;
  Step?: number;
  name?: string;
  Name?: string;
  action?: string;
  Action?: string;
  endpoint?: string;
  Endpoint?: string;
  resolved_payload?: Record<string, any>;
  ResolvedPayload?: Record<string, any>;
  missing_required_fields?: MissingFieldRequirement[];
  MissingRequiredFields?: MissingFieldRequirement[];
}

export interface ExecutionLogItem {
  time?: string;
  Time?: string;
  step?: string;
  Step?: string;
  status?: string;
  Status?: string;
  detail?: string;
  Detail?: string;
}

export interface AgentChatResponse {
  planId?: string;
  PlanId?: string;
  applicationId?: string;
  ApplicationId?: string;
  status?: AgentInteractionStatus;
  Status?: AgentInteractionStatus;
  botMessage?: string;
  BotMessage?: string;
  nextStepDetail?: StepMappingResult;
  NextStepDetail?: StepMappingResult;
  previousStepOutputs?: any[];
  PreviousStepOutputs?: any[];
  synthesizedData?: any;
  SynthesizedData?: any;
  executionLogs?: ExecutionLogItem[];
  ExecutionLogs?: ExecutionLogItem[];
}

export interface AppRegistryConfig {
  microsoftClientKey: string;
  name: string;
  appId?: string;
  baseApiUrl: string;
  capabilities?: Array<"api" | "sql">;
  rulePath?: string;
  ruleFiles?: string[];
  swaggerEndpointUrl?: string;
  schemaEndpointUrl?: string;
  sqlExecuteEndpoint?: string;
  domainPlaybook?: string;
  welcomeMessage?: string;
  quickSuggestions?: string[];
  defaultModel?: string;
}

export interface ApiResponse<T> {
  Code: number;
  Message: string;
  Data: T;
}

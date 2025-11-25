export type NodeType = 'thought' | 'action' | 'observation' | 'output' | 'system' | 'other';

export type IssueType = 
  | 'loop'
  | 'missing_observation'
  | 'suspicious_transition'
  | 'contradiction_candidate'
  | 'error_ignored'
  | 'empty_result';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface TraceIssue {
  id: string;
  type: IssueType;
  severity: 'warning' | 'error';
  nodeIds: string[];
  title: string;
  description: string;
  suggestion: string;
}

export interface TraceNode {
  id: string;
  type: NodeType;
  content: string;
  timestamp?: number;
  confidence?: number;
  parentId?: string | null;
  order?: number;
  metadata?: any;
  issues?: TraceIssue[];
  riskLevel?: RiskLevel;
  langGraphDetails?: LangGraphDetails;
}

export interface LangGraphDetails {
  nodeName?: string;
  stateBefore?: any;
  stateAfter?: any;
  config?: any;
  runId?: string;
  threadId?: string;
  checkpoint?: any;
  edges?: string[];
}

export interface TraceRun {
  id: string;
  source?: string;
  nodes: TraceNode[];
  issues?: TraceIssue[];
  riskLevel?: RiskLevel;
  riskExplanation?: string;
  issueSummary?: Record<IssueType, number>;
}

export interface Step {
  id: string;
  parent_id?: string | null;
  type: NodeType;
  content: string;
  timestamp?: string;
  raw?: any;
}

export interface FieldMapping {
  stepsPath?: string;
  idField?: string;
  parentIdField?: string;
  typeField?: string;
  contentField?: string;
  timestampField?: string;
}

export interface ParseResult {
  success: boolean;
  trace?: TraceRun;
  steps?: Step[];
  error?: string;
  warnings?: string[];
  detectedFormat?: string;
  arrayPath?: string;
}

export const KNOWN_STEP_ARRAY_KEYS = [
  'steps',
  'trace',
  'events', 
  'messages',
  'nodes',
  'intermediate_steps',
  'tool_calls',
  'runs',
  'actions',
  'history',
  'data',
  'records',
  'items',
  'results',
  'logs',
  'entries'
] as const;

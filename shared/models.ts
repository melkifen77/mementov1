export type NodeType = 'thought' | 'action' | 'observation' | 'output' | 'system' | 'other';

export interface TraceNode {
  id: string;
  type: NodeType;
  content: string;
  timestamp?: number;
  confidence?: number;
  parentId?: string | null;
  order?: number;
  metadata?: any;
}

export interface TraceRun {
  id: string;
  source?: string;
  nodes: TraceNode[];
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

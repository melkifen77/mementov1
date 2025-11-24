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

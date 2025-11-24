import { TraceAdapter } from './index';
import { TraceRun, TraceNode, NodeType } from '../models';

export class GenericAdapter implements TraceAdapter {
  id = 'generic';
  label = 'Generic JSON';

  normalize(raw: any): TraceRun {
    let steps: any[] = [];
    
    if (Array.isArray(raw)) {
      steps = raw;
    } else if (raw && Array.isArray(raw.steps)) {
      steps = raw.steps;
    } else if (raw && Array.isArray(raw.trace)) {
      steps = raw.trace;
    } else if (raw && Array.isArray(raw.nodes)) {
      steps = raw.nodes;
    } else if (raw && typeof raw === 'object') {
      const possibleArrays = Object.values(raw).filter(Array.isArray);
      if (possibleArrays.length > 0) {
        steps = possibleArrays[0] as any[];
      }
    }

    const nodes: TraceNode[] = steps.map((step, index) => {
      const type = this.normalizeType(step.type || step.kind || step.nodeType);
      
      return {
        id: step.id || step.step_id || step.nodeId || `step-${index}`,
        type,
        content: step.content || step.text || step.message || step.output || JSON.stringify(step),
        timestamp: step.timestamp || step.time || step.created_at,
        confidence: step.confidence || step.score,
        parentId: step.parentId || step.parent_id || step.parent || null,
        order: step.order !== undefined ? step.order : index,
        metadata: { ...step }
      };
    });

    return {
      id: raw.id || raw.run_id || `run-${Date.now()}`,
      source: raw.source || 'generic',
      nodes
    };
  }

  private normalizeType(rawType: any): NodeType {
    if (!rawType) return 'other';
    
    const typeStr = String(rawType).toLowerCase();
    
    if (typeStr.includes('thought') || typeStr.includes('think')) return 'thought';
    if (typeStr.includes('action') || typeStr.includes('act') || typeStr.includes('tool')) return 'action';
    if (typeStr.includes('observation') || typeStr.includes('observe') || typeStr.includes('result')) return 'observation';
    if (typeStr.includes('output') || typeStr.includes('response') || typeStr.includes('answer')) return 'output';
    if (typeStr.includes('system') || typeStr.includes('internal')) return 'system';
    
    return 'other';
  }
}

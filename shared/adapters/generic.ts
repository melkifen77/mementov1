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
    } else if (raw && Array.isArray(raw.messages)) {
      steps = raw.messages;
    } else if (raw && Array.isArray(raw.intermediate_steps)) {
      steps = raw.intermediate_steps;
    } else if (raw && Array.isArray(raw.tool_calls)) {
      steps = raw.tool_calls;
    } else if (raw && typeof raw === 'object') {
      const possibleArrays = Object.values(raw).filter(Array.isArray);
      if (possibleArrays.length > 0) {
        steps = possibleArrays[0] as any[];
      } else {
        steps = [raw];
      }
    }

    const nodes: TraceNode[] = steps.map((step, index) => {
      const type = this.detectType(step);
      const content = this.extractContent(step);
      const confidence = this.extractConfidence(step);
      
      return {
        id: this.extractId(step, index),
        type,
        content,
        timestamp: this.extractTimestamp(step),
        confidence,
        parentId: this.extractParentId(step, index, steps),
        order: step.order !== undefined ? step.order : index,
        metadata: this.sanitizeMetadata(step)
      };
    });

    return {
      id: raw.id || raw.run_id || raw.trace_id || `run-${this.generateId()}`,
      source: raw.source || raw.provider || 'generic',
      nodes
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractId(step: any, index: number): string {
    return step.id || 
           step.step_id || 
           step.nodeId || 
           step.node_id ||
           step.uuid ||
           `step-${this.generateId()}-${index}`;
  }

  private extractContent(step: any): string {
    let content = step.content || 
                  step.text || 
                  step.message || 
                  step.output || 
                  step.input ||
                  step.data ||
                  step.value;

    if (typeof content === 'object' && content !== null) {
      content = JSON.stringify(content, null, 2);
    }

    if (content === undefined || content === null) {
      const stepCopy = { ...step };
      delete stepCopy.type;
      delete stepCopy.id;
      delete stepCopy.timestamp;
      delete stepCopy.metadata;
      
      if (Object.keys(stepCopy).length > 0) {
        content = JSON.stringify(stepCopy, null, 2);
      } else {
        content = '[Empty step]';
      }
    }

    return String(content);
  }

  private extractTimestamp(step: any): number | undefined {
    const ts = step.timestamp || 
               step.time || 
               step.created_at || 
               step.createdAt ||
               step.start_time;
    
    if (ts === undefined || ts === null) return undefined;
    
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') {
      const parsed = new Date(ts).getTime();
      return isNaN(parsed) ? undefined : parsed;
    }
    
    return undefined;
  }

  private extractConfidence(step: any): number | undefined {
    const conf = step.confidence || 
                 step.score || 
                 step.probability ||
                 step.certainty;
    
    if (conf === undefined || conf === null) return undefined;
    
    const num = Number(conf);
    if (isNaN(num)) return undefined;
    
    if (num > 1) return num / 100;
    return num;
  }

  private extractParentId(step: any, index: number, allSteps: any[]): string | null {
    const explicitParent = step.parentId || 
                          step.parent_id || 
                          step.parent ||
                          step.parentNodeId;
    
    if (explicitParent) return String(explicitParent);
    
    if (index === 0) return null;
    
    const previousStep = allSteps[index - 1];
    if (previousStep) {
      return this.extractId(previousStep, index - 1);
    }
    
    return null;
  }

  private detectType(step: any): NodeType {
    const rawType = step.type || step.kind || step.nodeType || step.action || '';
    const typeStr = String(rawType).toLowerCase();
    
    const content = this.extractContent(step).toLowerCase();
    const combined = `${typeStr} ${content}`;
    
    if (combined.match(/\b(thought|thinking|reason|consider|analyze|plan)\b/i)) {
      return 'thought';
    }
    if (combined.match(/\b(action|tool|call|execute|run|fetch|search|query)\b/i)) {
      return 'action';
    }
    if (combined.match(/\b(observation|result|response|returned|found|output)\b/i)) {
      return 'observation';
    }
    if (combined.match(/\b(final|answer|recommendation|conclusion|output)\b/i)) {
      return 'output';
    }
    if (combined.match(/\b(system|internal|log|debug)\b/i)) {
      return 'system';
    }
    
    return 'other';
  }

  private sanitizeMetadata(step: any): any {
    try {
      return JSON.parse(JSON.stringify(step));
    } catch {
      return {};
    }
  }
}

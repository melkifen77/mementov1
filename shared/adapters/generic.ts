import { TraceAdapter } from './index';
import { TraceRun, TraceNode, NodeType } from '../models';

export class GenericAdapter implements TraceAdapter {
  id = 'generic';
  label = 'Generic JSON';

  normalize(raw: any): TraceRun {
    let steps: any[] = [];
    
    if (typeof raw === 'string') {
      steps = [{ type: 'other', content: raw }];
    } else if (Array.isArray(raw)) {
      steps = raw.flatMap((item, idx) => this.normalizeStep(item, idx));
    } else if (raw && Array.isArray(raw.steps)) {
      steps = raw.steps.flatMap((item: any, idx: number) => this.normalizeStep(item, idx));
    } else if (raw && Array.isArray(raw.trace)) {
      steps = raw.trace.flatMap((item: any, idx: number) => this.normalizeStep(item, idx));
    } else if (raw && Array.isArray(raw.nodes)) {
      steps = raw.nodes.flatMap((item: any, idx: number) => this.normalizeStep(item, idx));
    } else if (raw && Array.isArray(raw.messages)) {
      steps = raw.messages.flatMap((item: any, idx: number) => this.normalizeStep(item, idx));
    } else if (raw && Array.isArray(raw.intermediate_steps)) {
      steps = raw.intermediate_steps.flatMap((item: any, idx: number) => this.normalizeStep(item, idx));
    } else if (raw && Array.isArray(raw.tool_calls)) {
      steps = raw.tool_calls.flatMap((item: any, idx: number) => this.normalizeStep(item, idx));
    } else if (raw && typeof raw === 'object') {
      const possibleArrays = Object.values(raw).filter(Array.isArray);
      if (possibleArrays.length > 0) {
        steps = (possibleArrays[0] as any[]).flatMap((item: any, idx: number) => this.normalizeStep(item, idx));
      } else {
        steps = this.normalizeStep(raw, 0);
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

  private normalizeStep(step: any, index: number): any[] {
    if (typeof step === 'string') {
      return [{ type: 'other', content: step }];
    }
    
    if (typeof step !== 'object' || step === null) {
      return [{ type: 'other', content: String(step) }];
    }

    const nestedNodes: any[] = [];
    const knownKeys = ['thought', 'action', 'observation', 'output', 'final_answer', 'result'];
    
    for (const key of knownKeys) {
      if (step[key] !== undefined) {
        const value = step[key];
        const nodeData: any = { originalKey: key };
        
        if (typeof value === 'object' && value !== null) {
          nodeData.tool = value.tool || value.name || value.function;
          nodeData.content = value.tool_input || value.input || value.text || value.content || JSON.stringify(value, null, 2);
          
          if (value.tool || value.name) {
            nodeData.label = value.tool || value.name;
          }
        } else {
          nodeData.content = String(value);
        }
        
        if (step.id) nodeData.id = `${step.id}-${key}`;
        if (step.timestamp) nodeData.timestamp = step.timestamp;
        if (step.confidence) nodeData.confidence = step.confidence;
        
        nestedNodes.push(nodeData);
      }
    }

    if (nestedNodes.length > 0) {
      return nestedNodes;
    }

    return [step];
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
                  step.value ||
                  step.result;

    if (step.label && step.tool) {
      const toolInput = step.content || step.input || step.tool_input;
      if (toolInput) {
        if (typeof toolInput === 'object') {
          return `${step.label}\n${JSON.stringify(toolInput, null, 2)}`;
        }
        return `${step.label}: ${toolInput}`;
      }
      return step.label;
    }

    if (typeof content === 'object' && content !== null) {
      if (Array.isArray(content) && content.length < 5) {
        return JSON.stringify(content);
      }
      return JSON.stringify(content, null, 2);
    }

    if (content === undefined || content === null) {
      const stepCopy = { ...step };
      delete stepCopy.type;
      delete stepCopy.id;
      delete stepCopy.timestamp;
      delete stepCopy.metadata;
      delete stepCopy.originalKey;
      delete stepCopy.tool;
      delete stepCopy.label;
      delete stepCopy.order;
      delete stepCopy.parentId;
      delete stepCopy.parent_id;
      
      if (Object.keys(stepCopy).length > 0) {
        const keys = Object.keys(stepCopy);
        if (keys.length === 1) {
          const singleValue = stepCopy[keys[0]];
          if (typeof singleValue !== 'object') {
            return String(singleValue);
          }
        }
        return JSON.stringify(stepCopy, null, 2);
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
    if (step.originalKey) {
      const key = step.originalKey.toLowerCase();
      if (key === 'thought') return 'thought';
      if (key === 'action') return 'action';
      if (key === 'observation' || key === 'result') return 'observation';
      if (key === 'output' || key === 'final_answer') return 'output';
    }

    if (step.tool || step.function || step.name) {
      return 'action';
    }

    if (step.result !== undefined && !step.type) {
      return 'observation';
    }

    const rawType = step.type || step.kind || step.nodeType || '';
    const typeStr = String(rawType).toLowerCase();
    
    const content = String(step.content || step.text || step.message || '').toLowerCase();
    const combined = `${typeStr} ${content}`;
    
    if (combined.match(/\b(thought|thinking|reason|consider|analyze|plan)\b/i)) {
      return 'thought';
    }
    if (combined.match(/\b(action|tool|call|execute|run|fetch|search|query)\b/i)) {
      return 'action';
    }
    if (combined.match(/\b(observation|result|response|returned|found)\b/i)) {
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

import { TraceAdapter } from './index';
import { TraceRun, TraceNode, NodeType, Step, FieldMapping, ParseResult, KNOWN_STEP_ARRAY_KEYS, LangGraphDetails } from '../models';

export class GenericAdapter implements TraceAdapter {
  id = 'generic';
  label = 'Generic JSON';

  normalize(raw: any, mapping?: FieldMapping): TraceRun {
    const result = this.parse(raw, mapping);
    
    if (!result.success || !result.trace) {
      return {
        id: `run-${this.generateId()}`,
        source: 'generic',
        nodes: [{
          id: 'error-node',
          type: 'system',
          content: result.error || 'Failed to parse trace',
          order: 0,
          parentId: null,
          metadata: { error: true, warnings: result.warnings }
        }]
      };
    }
    
    return result.trace;
  }

  parse(raw: any, mapping?: FieldMapping): ParseResult {
    const warnings: string[] = [];
    
    try {
      if (raw === null || raw === undefined) {
        return {
          success: false,
          error: 'Input is null or undefined. Please provide valid JSON data.',
          warnings
        };
      }

      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch {
          return {
            success: false,
            error: 'Input is a string but not valid JSON. Please check the syntax.',
            warnings
          };
        }
      }

      const { steps: rawSteps, arrayPath, detectedFormat } = this.findStepArray(raw, mapping?.stepsPath);
      
      if (!rawSteps || rawSteps.length === 0) {
        const searchedKeys = KNOWN_STEP_ARRAY_KEYS.join(', ');
        const availableKeys = typeof raw === 'object' && raw !== null 
          ? Object.keys(raw).join(', ') 
          : 'none';
        
        return {
          success: false,
          error: `Could not find an array of steps in the JSON.\n\nSearched for: root array, or keys: ${searchedKeys}\n\nAvailable keys: ${availableKeys}\n\nTip: Use Custom Mapping to specify where your steps are located.`,
          warnings,
          detectedFormat
        };
      }

      const expandedSteps = this.expandSteps(rawSteps, mapping);
      
      if (expandedSteps.length === 0) {
        return {
          success: false,
          error: 'Found array but it contains no processable steps.',
          warnings,
          arrayPath,
          detectedFormat
        };
      }

      const nodeIds = expandedSteps.map((step, index) => this.extractId(step, index, mapping));
      
      const toolCallIdToNodeId = this.buildToolCallIdMap(expandedSteps, nodeIds);
      
      const nodes: TraceNode[] = expandedSteps.map((step, index) => {
        const type = this.detectType(step, mapping);
        const content = this.extractContent(step, mapping);
        const timestamp = this.extractTimestamp(step, mapping);
        const confidence = this.extractConfidence(step);
        const langGraphDetails = this.extractLangGraphDetails(step);
        
        if (content === '[Empty step]') {
          warnings.push(`Step ${index}: No content could be extracted`);
        }
        
        return {
          id: nodeIds[index],
          type,
          content,
          timestamp,
          confidence,
          parentId: this.extractParentId(step, index, nodeIds, mapping, toolCallIdToNodeId),
          order: step.order !== undefined ? step.order : index,
          metadata: this.sanitizeMetadata(step),
          langGraphDetails: Object.keys(langGraphDetails).length > 0 ? langGraphDetails : undefined
        };
      });

      const steps: Step[] = nodes.map((node, index) => ({
        id: node.id,
        parent_id: node.parentId,
        type: node.type,
        content: node.content,
        timestamp: node.timestamp ? new Date(node.timestamp).toISOString() : undefined,
        raw: expandedSteps[index]
      }));

      const trace: TraceRun = {
        id: raw.id || raw.run_id || raw.trace_id || raw.session_id || `run-${this.generateId()}`,
        source: this.detectSource(raw, detectedFormat),
        nodes
      };

      return {
        success: true,
        trace,
        steps,
        warnings: warnings.length > 0 ? warnings : undefined,
        detectedFormat,
        arrayPath
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error during parsing: ${error instanceof Error ? error.message : String(error)}`,
        warnings
      };
    }
  }

  private findStepArray(raw: any, customPath?: string): { 
    steps: any[] | null; 
    arrayPath?: string;
    detectedFormat?: string;
  } {
    if (customPath) {
      const customSteps = this.getNestedValue(raw, customPath);
      if (Array.isArray(customSteps)) {
        return { steps: customSteps, arrayPath: customPath, detectedFormat: 'custom' };
      }
    }

    if (Array.isArray(raw)) {
      return { steps: raw, arrayPath: 'root', detectedFormat: 'array' };
    }

    if (typeof raw !== 'object' || raw === null) {
      return { steps: null };
    }

    for (const key of KNOWN_STEP_ARRAY_KEYS) {
      if (Array.isArray(raw[key]) && raw[key].length > 0) {
        let format = 'generic';
        if (key === 'intermediate_steps') format = 'langchain';
        if (key === 'events' || key === 'messages') format = 'langgraph';
        if (key === 'tool_calls') format = 'openai';
        
        return { steps: raw[key], arrayPath: key, detectedFormat: format };
      }
    }

    for (const key of Object.keys(raw)) {
      if (key.toLowerCase().includes('step') || 
          key.toLowerCase().includes('trace') ||
          key.toLowerCase().includes('event') ||
          key.toLowerCase().includes('message')) {
        if (Array.isArray(raw[key]) && raw[key].length > 0) {
          return { steps: raw[key], arrayPath: key, detectedFormat: 'detected' };
        }
      }
    }

    for (const key of KNOWN_STEP_ARRAY_KEYS) {
      for (const outerKey of Object.keys(raw)) {
        const nested = raw[outerKey];
        if (nested && typeof nested === 'object' && Array.isArray(nested[key])) {
          return { 
            steps: nested[key], 
            arrayPath: `${outerKey}.${key}`, 
            detectedFormat: 'nested' 
          };
        }
      }
    }

    const allArrays = this.findAllArrays(raw, '', 3);
    if (allArrays.length > 0) {
      const sorted = allArrays.sort((a, b) => b.items.length - a.items.length);
      const best = sorted[0];
      if (best.items.length > 0 && typeof best.items[0] === 'object') {
        return { steps: best.items, arrayPath: best.path, detectedFormat: 'fallback' };
      }
    }

    return { steps: null };
  }

  private findAllArrays(obj: any, path: string, maxDepth: number): { path: string; items: any[] }[] {
    if (maxDepth <= 0) return [];
    
    const results: { path: string; items: any[] }[] = [];
    
    if (typeof obj !== 'object' || obj === null) return results;
    
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const currentPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value)) {
        results.push({ path: currentPath, items: value });
      } else if (typeof value === 'object' && value !== null) {
        results.push(...this.findAllArrays(value, currentPath, maxDepth - 1));
      }
    }
    
    return results;
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      
      if (part.includes('[')) {
        const match = part.match(/^(\w+)\[(\d+)\]$/);
        if (match) {
          current = current[match[1]]?.[parseInt(match[2])];
        } else {
          current = current[part];
        }
      } else {
        current = current[part];
      }
    }
    
    return current;
  }

  private expandSteps(steps: any[], mapping?: FieldMapping): any[] {
    const expanded: any[] = [];
    let globalIndex = 0;
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      if (typeof step === 'string') {
        expanded.push({ content: step, _originalIndex: i, _globalIndex: globalIndex++ });
        continue;
      }
      
      if (typeof step !== 'object' || step === null) {
        expanded.push({ content: String(step), _originalIndex: i, _globalIndex: globalIndex++ });
        continue;
      }

      if (Array.isArray(step) && step.length === 2) {
        const [first, second] = step;
        
        if (typeof first === 'object' && first !== null && 
            (first.tool || first.action || first.name || first.log)) {
          const actionId = `step-${i}-action`;
          const obsId = `step-${i}-observation`;
          
          const toolName = first.tool || first.action || first.name || 'tool';
          const toolInput = first.tool_input || first.input || first.args || '';
          const actionContent = first.log || 
            (typeof toolInput === 'string' ? `${toolName}: ${toolInput}` : 
             `${toolName}\n${JSON.stringify(toolInput, null, 2)}`);
          
          expanded.push({
            ...first,
            id: actionId,
            content: actionContent,
            type: 'action',
            _originalIndex: i,
            _tupleIndex: 0,
            _globalIndex: globalIndex++,
            _linkedObservationId: obsId
          });
          
          const obsContent = typeof second === 'string' ? second : 
                            (second === null || second === undefined) ? '[No result]' :
                            JSON.stringify(second, null, 2);
          expanded.push({
            id: obsId,
            content: obsContent,
            type: 'observation',
            _originalIndex: i,
            _tupleIndex: 1,
            _globalIndex: globalIndex++,
            _linkedActionId: actionId
          });
          continue;
        }
      }

      const subSteps = this.extractSubSteps(step, i);
      if (subSteps.length > 0) {
        for (const subStep of subSteps) {
          subStep._globalIndex = globalIndex++;
          expanded.push(subStep);
        }
      } else {
        expanded.push({ ...step, _originalIndex: i, _globalIndex: globalIndex++ });
      }
    }
    
    return expanded;
  }

  private extractSubSteps(step: any, originalIndex: number): any[] {
    const subSteps: any[] = [];
    const knownSubKeys = ['thought', 'action', 'observation', 'output', 'final_answer', 'result', 'tool_call', 'tool_result'];
    
    let hasSubKeys = false;
    for (const key of knownSubKeys) {
      if (step[key] !== undefined) {
        hasSubKeys = true;
        const value = step[key];
        const subStep: any = { 
          _originalKey: key,
          _originalIndex: originalIndex 
        };
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(subStep, value);
          if (!subStep.content) {
            subStep.content = value.tool_input || value.input || value.text || value.content;
          }
        } else {
          subStep.content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        }
        
        if (step.id) subStep._parentStepId = step.id;
        if (step.timestamp) subStep.timestamp = step.timestamp;
        
        subSteps.push(subStep);
      }
    }
    
    return hasSubKeys ? subSteps : [];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractId(step: any, index: number, mapping?: FieldMapping): string {
    if (mapping?.idField) {
      const customId = this.getNestedValue(step, mapping.idField);
      if (customId !== undefined && customId !== null) return String(customId);
    }
    
    const idFields = ['id', 'step_id', 'node_id', 'nodeId', 'uuid', 'event_id', 'eventId', 'message_id', 'run_id'];
    
    for (const field of idFields) {
      if (step[field] !== undefined && step[field] !== null) {
        const baseId = String(step[field]);
        if (step._tupleIndex !== undefined) {
          return `${baseId}-${step._tupleIndex}`;
        }
        if (step._originalKey) {
          return `${baseId}-${step._originalKey}`;
        }
        return baseId;
      }
    }
    
    const suffix = step._tupleIndex !== undefined ? `-${step._tupleIndex}` : 
                   step._originalKey ? `-${step._originalKey}` : '';
    
    return `step-${index}${suffix}`;
  }

  private extractContent(step: any, mapping?: FieldMapping): string {
    if (mapping?.contentField) {
      const customContent = this.getNestedValue(step, mapping.contentField);
      if (customContent !== undefined && customContent !== null) {
        return this.formatContent(customContent);
      }
    }

    const contentFields = [
      'content', 'text', 'message', 'prompt', 
      'tool_input', 'input', 'args', 'arguments',
      'observation', 'result', 'response', 'output',
      'tool_output', 'return_value', 'data', 'value',
      'answer', 'final_answer', 'completion'
    ];
    
    for (const field of contentFields) {
      if (step[field] !== undefined && step[field] !== null && step[field] !== '') {
        const value = step[field];
        
        if (step.tool || step.name || step.function || step.tool_name) {
          const toolName = step.tool || step.name || step.function || step.tool_name;
          return `${toolName}\n${this.formatContent(value)}`;
        }
        
        return this.formatContent(value);
      }
    }

    if (step.tool || step.name || step.function || step.tool_name) {
      const toolName = step.tool || step.name || step.function || step.tool_name;
      const args = step.tool_input || step.input || step.args || step.arguments;
      if (args) {
        return `${toolName}\n${this.formatContent(args)}`;
      }
      return toolName;
    }

    const stepCopy = { ...step };
    const metaKeys = ['type', 'id', 'timestamp', 'metadata', '_originalKey', '_originalIndex', 
                      '_tupleIndex', '_parentStepId', 'order', 'parentId', 'parent_id', 'parent',
                      'tool', 'name', 'function', 'tool_name', 'role', 'source'];
    
    for (const key of metaKeys) {
      delete stepCopy[key];
    }
    
    if (Object.keys(stepCopy).length > 0) {
      if (Object.keys(stepCopy).length === 1) {
        const singleValue = Object.values(stepCopy)[0];
        if (typeof singleValue !== 'object' || singleValue === null) {
          return String(singleValue);
        }
      }
      return JSON.stringify(stepCopy, null, 2);
    }
    
    return '[Empty step]';
  }

  private formatContent(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    
    try {
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        if (value.every(item => typeof item === 'string')) {
          return value.join('\n');
        }
      }
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private extractTimestamp(step: any, mapping?: FieldMapping): number | undefined {
    if (mapping?.timestampField) {
      const customTs = this.getNestedValue(step, mapping.timestampField);
      if (customTs !== undefined) return this.parseTimestamp(customTs);
    }
    
    const tsFields = ['timestamp', 'time', 'created_at', 'createdAt', 'start_time', 'startTime', 
                      'datetime', 'date', 'ts', 'event_time', 'logged_at'];
    
    for (const field of tsFields) {
      if (step[field] !== undefined && step[field] !== null) {
        const parsed = this.parseTimestamp(step[field]);
        if (parsed !== undefined) return parsed;
      }
    }
    
    return undefined;
  }

  private parseTimestamp(ts: any): number | undefined {
    if (ts === undefined || ts === null) return undefined;
    
    if (typeof ts === 'number') {
      if (ts > 1e12) return ts;
      if (ts > 1e9) return ts * 1000;
      return undefined;
    }
    
    if (typeof ts === 'string') {
      const parsed = new Date(ts).getTime();
      return isNaN(parsed) ? undefined : parsed;
    }
    
    return undefined;
  }

  private extractConfidence(step: any): number | undefined {
    const confFields = ['confidence', 'score', 'probability', 'certainty', 'weight'];
    
    for (const field of confFields) {
      if (step[field] !== undefined && step[field] !== null) {
        const num = Number(step[field]);
        if (!isNaN(num)) {
          return num > 1 ? num / 100 : num;
        }
      }
    }
    
    return undefined;
  }

  private buildToolCallIdMap(steps: any[], nodeIds: string[]): Map<string, string> {
    const map = new Map<string, string>();
    
    steps.forEach((step, index) => {
      if (step.tool_calls && Array.isArray(step.tool_calls)) {
        for (const tc of step.tool_calls) {
          if (tc.id) {
            map.set(tc.id, nodeIds[index]);
          }
          if (tc.function?.id) {
            map.set(tc.function.id, nodeIds[index]);
          }
        }
      }
      
      if (step.function_call) {
        if (step.function_call.id) {
          map.set(step.function_call.id, nodeIds[index]);
        }
        if (step.function_call.name) {
          map.set(`func:${step.function_call.name}`, nodeIds[index]);
        }
      }

      if (step._linkedObservationId && step.tool_calls) {
        for (const tc of step.tool_calls) {
          if (tc.id) {
            map.set(tc.id, nodeIds[index]);
          }
        }
      }
    });
    
    return map;
  }

  private extractParentId(
    step: any, 
    index: number, 
    nodeIds: string[], 
    mapping?: FieldMapping,
    toolCallIdMap?: Map<string, string>
  ): string | null {
    if (mapping?.parentIdField) {
      const customParent = this.getNestedValue(step, mapping.parentIdField);
      if (customParent !== undefined && customParent !== null) return String(customParent);
    }

    if (step._linkedActionId) {
      return step._linkedActionId;
    }

    if (step.tool_call_id && toolCallIdMap) {
      const parentId = toolCallIdMap.get(step.tool_call_id);
      if (parentId) return parentId;
    }
    
    const parentFields = ['parentId', 'parent_id', 'parent', 'parentNodeId', 'source', 'from', 'prev'];
    
    for (const field of parentFields) {
      if (step[field] !== undefined && step[field] !== null) {
        return String(step[field]);
      }
    }

    if (step.edges && Array.isArray(step.edges)) {
      const incomingEdge = step.edges.find((e: any) => e.target === step.id || e.to === step.id);
      if (incomingEdge) {
        return incomingEdge.source || incomingEdge.from;
      }
    }
    
    if (index === 0) return null;
    
    return nodeIds[index - 1] || null;
  }

  private detectType(step: any, mapping?: FieldMapping): NodeType {
    if (step.type === 'action') return 'action';
    if (step.type === 'observation') return 'observation';
    if (step.type === 'thought') return 'thought';
    if (step.type === 'output') return 'output';
    if (step.type === 'system') return 'system';
    
    if (mapping?.typeField) {
      const customType = this.getNestedValue(step, mapping.typeField);
      if (customType) {
        const normalized = this.normalizeType(String(customType).toLowerCase());
        if (normalized !== 'other') return normalized;
      }
    }

    if (step._originalKey) {
      const key = step._originalKey.toLowerCase();
      if (key === 'thought' || key === 'thinking' || key === 'reasoning') return 'thought';
      if (key === 'action' || key === 'tool_call') return 'action';
      if (key === 'observation' || key === 'result' || key === 'tool_result') return 'observation';
      if (key === 'output' || key === 'final_answer' || key === 'answer') return 'output';
    }

    if (step.role === 'tool' || step.role === 'function') {
      return 'observation';
    }

    if (step.role === 'system') {
      return 'system';
    }

    if (step.tool_call_id && step.content !== undefined) {
      return 'observation';
    }

    if (step.type !== undefined && step.type !== null) {
      const normalized = this.normalizeType(String(step.type).toLowerCase());
      if (normalized !== 'other') return normalized;
    }

    if (step.tool || step.tool_name || step.function_call || step.function || 
        step.action || step.tool_input || step.tool_calls) {
      return 'action';
    }

    if (step.observation !== undefined || step.result !== undefined || 
        step.response !== undefined || step.tool_output !== undefined ||
        step.return_value !== undefined) {
      return 'observation';
    }

    if (step.final_answer !== undefined || step.answer !== undefined || 
        step.completion !== undefined || step.output_text !== undefined ||
        step.is_final === true || step.finished === true) {
      return 'output';
    }

    if (step.role === 'assistant') {
      const content = String(step.content || step.text || step.message || '').toLowerCase();
      
      if (content.match(/\b(plan|planning|checking|analyzing|considering|thinking|let me|i will|i'll|first|next|then)\b/i)) {
        return 'thought';
      }
      
      if (step.tool_calls || step.function_call) {
        return 'action';
      }
    }

    if (step.role === 'tool' || step.role === 'function') {
      return 'observation';
    }

    if (step.role === 'system') {
      return 'system';
    }

    const typeFields = ['kind', 'nodeType', 'node_type', 'step_type', 'event_type', 'category'];
    for (const field of typeFields) {
      if (step[field]) {
        const normalized = this.normalizeType(String(step[field]).toLowerCase());
        if (normalized !== 'other') return normalized;
      }
    }

    const content = String(step.content || step.text || step.message || '').toLowerCase();
    
    if (content.match(/\b(error|failed|exception|traceback)\b/i)) {
      return 'system';
    }
    
    if (content.match(/\b(calling|executing|running|invoking|fetching|searching|querying)\s+\w+/i)) {
      return 'action';
    }
    
    if (content.match(/\b(returned|received|got|found|result|response)\s*:/i)) {
      return 'observation';
    }
    
    if (content.match(/\b(final\s+answer|in\s+conclusion|therefore|the\s+answer\s+is)\b/i)) {
      return 'output';
    }
    
    return 'other';
  }

  private normalizeType(typeStr: string): NodeType {
    const typeMap: Record<string, NodeType> = {
      'thought': 'thought',
      'thinking': 'thought',
      'reasoning': 'thought',
      'plan': 'thought',
      'planning': 'thought',
      'chain_of_thought': 'thought',
      'cot': 'thought',
      
      'action': 'action',
      'tool': 'action',
      'tool_call': 'action',
      'function': 'action',
      'function_call': 'action',
      'execute': 'action',
      'call': 'action',
      'invoke': 'action',
      
      'observation': 'observation',
      'result': 'observation',
      'response': 'observation',
      'tool_result': 'observation',
      'function_result': 'observation',
      'return': 'observation',
      'output': 'observation',
      
      'final': 'output',
      'final_answer': 'output',
      'answer': 'output',
      'completion': 'output',
      'finish': 'output',
      'done': 'output',
      'end': 'output',
      
      'system': 'system',
      'log': 'system',
      'debug': 'system',
      'internal': 'system',
      'error': 'system',
      'warning': 'system',
      
      'ai_message': 'thought',
      'human_message': 'other',
      'ai': 'thought',
      'human': 'other',
      'user': 'other',
      'assistant': 'thought'
    };
    
    return typeMap[typeStr] || 'other';
  }

  private extractLangGraphDetails(step: any): LangGraphDetails {
    const details: LangGraphDetails = {};
    
    if (step.node || step.node_name) {
      details.nodeName = step.node || step.node_name;
    }
    if (step.name && !details.nodeName) {
      details.nodeName = step.name;
    }
    
    if (step.state) {
      details.stateBefore = step.state;
    }
    if (step.state_before) {
      details.stateBefore = step.state_before;
    }
    if (step.state_after) {
      details.stateAfter = step.state_after;
    }
    if (step.values) {
      details.stateAfter = step.values;
    }
    
    if (step.config) {
      details.config = step.config;
    }
    if (step.configurable) {
      details.config = step.configurable;
    }
    
    if (step.run_id) {
      details.runId = step.run_id;
    }
    if (step.thread_id) {
      details.threadId = step.thread_id;
    }
    
    if (step.checkpoint) {
      details.checkpoint = step.checkpoint;
    }
    if (step.checkpoint_id) {
      details.checkpoint = { id: step.checkpoint_id };
    }
    
    if (step.edges && Array.isArray(step.edges)) {
      details.edges = step.edges.map((e: any) => 
        typeof e === 'string' ? e : (e.target || e.to || e.name || String(e))
      );
    }
    if (step.next && Array.isArray(step.next)) {
      details.edges = step.next;
    }
    if (typeof step.next === 'string') {
      details.edges = [step.next];
    }
    
    return details;
  }

  private detectSource(raw: any, detectedFormat?: string): string {
    if (raw.source) return raw.source;
    if (raw.provider) return raw.provider;
    if (raw.framework) return raw.framework;
    if (raw.agent_type) return raw.agent_type;
    
    if (raw.langgraph_version || raw.graph_id || detectedFormat === 'langgraph') {
      return 'langgraph';
    }
    if (raw.langchain_version || raw.lc_id || detectedFormat === 'langchain') {
      return 'langchain';
    }
    if (raw.model?.startsWith('gpt') || raw.choices || detectedFormat === 'openai') {
      return 'openai';
    }
    if (raw.model?.startsWith('claude') || raw.anthropic_version) {
      return 'anthropic';
    }
    
    return detectedFormat || 'generic';
  }

  private sanitizeMetadata(step: any): any {
    try {
      const sanitized = { ...step };
      delete sanitized._originalIndex;
      delete sanitized._tupleIndex;
      delete sanitized._originalKey;
      delete sanitized._parentStepId;
      return JSON.parse(JSON.stringify(sanitized));
    } catch {
      return {};
    }
  }
}

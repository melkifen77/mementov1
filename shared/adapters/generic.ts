import { TraceAdapter } from './index';
import { TraceRun, TraceNode, NodeType, Step, FieldMapping, ParseResult, KNOWN_STEP_ARRAY_KEYS, LangGraphDetails, NodeMetrics, TokenUsage } from '../models';

const SLOW_THRESHOLD_MS = 3000;
const HEAVY_TOKEN_THRESHOLD = 2000;

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

      // STRICT FORMAT DETECTION - Priority order: LangGraph → LangChain → Array → Generic
      const detectedFormat = this.detectFormatStrict(raw);
      const { steps: rawSteps, arrayPath } = this.findStepArrayForFormat(raw, detectedFormat, mapping?.stepsPath);
      
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

      let expandedSteps = this.expandSteps(rawSteps, mapping);
      
      // For LangChain traces, include initial thought (from steps array) and final output
      if (detectedFormat === 'langchain') {
        const supplementary = this.extractLangChainSupplementaryNodes(raw, expandedSteps.length);
        if (supplementary.initialThought) {
          expandedSteps = [supplementary.initialThought, ...expandedSteps];
        }
        // Only add final output if there isn't already an output node in expanded steps
        const hasExistingOutput = expandedSteps.some(s => 
          s.type === 'output' || s._originalKey === 'output' || s._originalKey === 'final_answer'
        );
        if (supplementary.finalOutput && !hasExistingOutput) {
          expandedSteps = [...expandedSteps, supplementary.finalOutput];
        }
      }
      
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
        
        const metrics = this.extractMetrics(step);
        
        return {
          id: nodeIds[index],
          type,
          content,
          timestamp,
          confidence,
          parentId: this.extractParentId(step, index, nodeIds, mapping, toolCallIdToNodeId),
          order: step.order !== undefined ? step.order : index,
          metadata: this.sanitizeMetadata(step),
          langGraphDetails: Object.keys(langGraphDetails).length > 0 ? langGraphDetails : undefined,
          metrics: Object.keys(metrics).length > 0 ? metrics : undefined
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

  /**
   * STRICT FORMAT DETECTION
   * Priority order: LangGraph → LangChain → OpenAI → Array → Generic
   * 
   * This runs BEFORE step extraction to ensure consistent detection.
   */
  private detectFormatStrict(raw: any): string {
    // 1. Check for LangGraph markers (highest priority)
    if (this.isLangGraphFormat(raw)) {
      return 'langgraph';
    }
    
    // 2. Check for LangChain markers
    if (this.isLangChainFormat(raw)) {
      return 'langchain';
    }
    
    // 3. Check for OpenAI format
    if (this.isOpenAIFormat(raw)) {
      return 'openai';
    }
    
    // 4. Check for array of steps
    if (Array.isArray(raw)) {
      return this.detectArrayFormat(raw);
    }
    
    // 5. Generic object fallback
    return 'generic';
  }

  private isLangGraphFormat(raw: any): boolean {
    if (typeof raw !== 'object' || raw === null) return false;
    
    // LangGraph structural markers
    if (raw.langgraph_version !== undefined) return true;
    if (raw.graph_id !== undefined) return true;
    if (raw.thread_id !== undefined && raw.checkpoint !== undefined) return true;
    
    // Check for events with node/langgraph markers
    const events = raw.events || raw.messages || raw.runs;
    if (Array.isArray(events) && events.length > 0) {
      const hasLangGraphEvent = events.some((e: any) => 
        e?.node !== undefined || 
        e?.langgraph_node !== undefined ||
        e?.graph_id !== undefined ||
        e?.checkpoint !== undefined
      );
      if (hasLangGraphEvent) return true;
    }
    
    return false;
  }

  private isLangChainFormat(raw: any): boolean {
    if (typeof raw !== 'object' || raw === null) return false;
    
    // LangChain structural markers
    if (raw.langchain_version !== undefined) return true;
    if (raw.lc_id !== undefined) return true;
    
    // Check for intermediate_steps (most common LangChain pattern)
    if (Array.isArray(raw.intermediate_steps) && raw.intermediate_steps.length > 0) {
      return true;
    }
    
    // Check for structured tool_calls with LangChain patterns
    if (Array.isArray(raw.steps)) {
      const hasLangChainStructure = raw.steps.some((s: any) =>
        (s?.action !== undefined && s?.tool_input !== undefined) ||
        (s?.observation !== undefined) ||
        (s?.thought !== undefined && s?.action !== undefined)
      );
      if (hasLangChainStructure) return true;
    }
    
    // Check for LangChain output patterns
    if (raw.output !== undefined && (raw.intermediate_steps !== undefined || raw.steps !== undefined)) {
      return true;
    }
    
    // Check for root-level array with LangChain schema
    if (Array.isArray(raw)) {
      return this.detectArrayFormat(raw) === 'langchain';
    }
    
    return false;
  }

  private isOpenAIFormat(raw: any): boolean {
    if (typeof raw !== 'object' || raw === null) return false;
    
    // OpenAI API response markers
    if (raw.choices !== undefined) return true;
    if (raw.model?.startsWith('gpt')) return true;
    if (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) {
      const hasOpenAIToolCall = raw.tool_calls.some((tc: any) =>
        tc?.id !== undefined && tc?.function !== undefined
      );
      if (hasOpenAIToolCall) return true;
    }
    
    return false;
  }

  /**
   * Find step array based on already-detected format
   */
  private findStepArrayForFormat(raw: any, format: string, customPath?: string): { 
    steps: any[] | null; 
    arrayPath?: string;
  } {
    if (customPath) {
      const customSteps = this.getNestedValue(raw, customPath);
      if (Array.isArray(customSteps)) {
        return { steps: customSteps, arrayPath: customPath };
      }
    }

    if (Array.isArray(raw)) {
      return { steps: raw, arrayPath: 'root' };
    }

    if (typeof raw !== 'object' || raw === null) {
      return { steps: null };
    }

    // Format-specific step array extraction
    switch (format) {
      case 'langchain':
        // LangChain: prioritize intermediate_steps
        if (Array.isArray(raw.intermediate_steps) && raw.intermediate_steps.length > 0) {
          return { steps: raw.intermediate_steps, arrayPath: 'intermediate_steps' };
        }
        if (Array.isArray(raw.steps) && raw.steps.length > 0) {
          return { steps: raw.steps, arrayPath: 'steps' };
        }
        break;
        
      case 'langgraph':
        // LangGraph: prioritize events or messages
        if (Array.isArray(raw.events) && raw.events.length > 0) {
          return { steps: raw.events, arrayPath: 'events' };
        }
        if (Array.isArray(raw.messages) && raw.messages.length > 0) {
          return { steps: raw.messages, arrayPath: 'messages' };
        }
        if (Array.isArray(raw.runs) && raw.runs.length > 0) {
          return { steps: raw.runs, arrayPath: 'runs' };
        }
        break;
        
      case 'openai':
        // OpenAI: look for tool_calls or messages
        if (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) {
          return { steps: raw.tool_calls, arrayPath: 'tool_calls' };
        }
        if (Array.isArray(raw.messages) && raw.messages.length > 0) {
          return { steps: raw.messages, arrayPath: 'messages' };
        }
        break;
    }

    // Generic fallback - search known keys
    for (const key of KNOWN_STEP_ARRAY_KEYS) {
      if (Array.isArray(raw[key]) && raw[key].length > 0) {
        return { steps: raw[key], arrayPath: key };
      }
    }

    // Search for step-like keys
    for (const key of Object.keys(raw)) {
      if (key.toLowerCase().includes('step') || 
          key.toLowerCase().includes('trace') ||
          key.toLowerCase().includes('event') ||
          key.toLowerCase().includes('message')) {
        if (Array.isArray(raw[key]) && raw[key].length > 0) {
          return { steps: raw[key], arrayPath: key };
        }
      }
    }

    // Nested search
    for (const key of KNOWN_STEP_ARRAY_KEYS) {
      for (const outerKey of Object.keys(raw)) {
        const nested = raw[outerKey];
        if (nested && typeof nested === 'object' && Array.isArray(nested[key])) {
          return { 
            steps: nested[key], 
            arrayPath: `${outerKey}.${key}`
          };
        }
      }
    }

    // Fallback: find largest array
    const allArrays = this.findAllArrays(raw, '', 3);
    if (allArrays.length > 0) {
      const sorted = allArrays.sort((a, b) => b.items.length - a.items.length);
      const best = sorted[0];
      if (best.items.length > 0 && typeof best.items[0] === 'object') {
        return { steps: best.items, arrayPath: best.path };
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
    
    // Detect LangChain intermediate_steps format: separate action/observation objects
    const isLangChainFormat = this.detectLangChainFormat(steps);
    
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

      // Handle LangChain tuple format: [[action, observation], ...]
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

      // Handle LangChain separate objects format: {action, tool_input} or {observation}
      if (isLangChainFormat) {
        const langChainNode = this.extractLangChainNode(step, i, globalIndex, expanded);
        if (langChainNode) {
          langChainNode._globalIndex = globalIndex++;
          expanded.push(langChainNode);
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
    
    // Link LangChain action nodes to their following observation nodes
    if (isLangChainFormat) {
      this.linkLangChainNodes(expanded);
    }
    
    return expanded;
  }

  /**
   * Deterministic format detection for root-level arrays
   * Uses presence of action/observation fields and schema patterns
   */
  private detectArrayFormat(steps: any[]): string {
    if (!Array.isArray(steps) || steps.length === 0) return 'array';
    
    let actionCount = 0;
    let observationCount = 0;
    let hasLangChainSchema = false;
    let hasTuples = false;
    let hasLangGraphSchema = false;
    
    for (const step of steps) {
      // Check for LangChain tuple format: [[action, observation], ...]
      if (Array.isArray(step) && step.length === 2) {
        const [first] = step;
        if (typeof first === 'object' && first !== null && 
            (first.tool || first.action || first.log)) {
          hasTuples = true;
        }
      }
      
      if (typeof step !== 'object' || step === null || Array.isArray(step)) continue;
      
      // LangChain action schema: { action: string, tool_input: any }
      if (step.action !== undefined && typeof step.action === 'string') {
        actionCount++;
        if (step.tool_input !== undefined) {
          hasLangChainSchema = true;
        }
      }
      
      // LangChain observation schema: { observation: any }
      if (step.observation !== undefined) {
        observationCount++;
        hasLangChainSchema = true;
      }
      
      // LangGraph schema: has node, graph_id, or langgraph markers
      if (step.node !== undefined || step.graph_id !== undefined || 
          step.langgraph_node !== undefined || step.checkpoint !== undefined) {
        hasLangGraphSchema = true;
      }
    }
    
    // Deterministic detection priority:
    // 1. LangChain tuple format
    if (hasTuples) {
      return 'langchain';
    }
    
    // 2. LangChain separate action/observation format
    if (hasLangChainSchema && actionCount > 0 && observationCount > 0) {
      return 'langchain';
    }
    
    // 3. LangGraph format
    if (hasLangGraphSchema) {
      return 'langgraph';
    }
    
    // 4. Generic array with action/observation fields (still LangChain-like)
    if (actionCount > 0 && observationCount > 0) {
      return 'langchain';
    }
    
    return 'array';
  }

  // Detect LangChain intermediate_steps format with separate action/observation objects
  private detectLangChainFormat(steps: any[]): boolean {
    if (!Array.isArray(steps) || steps.length === 0) return false;
    
    let hasAction = false;
    let hasObservation = false;
    
    for (const step of steps) {
      if (typeof step !== 'object' || step === null || Array.isArray(step)) continue;
      
      // LangChain action format: { action: "tool_name", tool_input: {...} }
      if (step.action !== undefined && (step.tool_input !== undefined || typeof step.action === 'string')) {
        hasAction = true;
      }
      // LangChain observation format: { observation: {...} } or { observation: "result" }
      if (step.observation !== undefined) {
        hasObservation = true;
      }
    }
    
    return hasAction && hasObservation;
  }

  // Extract a LangChain-formatted node (action or observation)
  private extractLangChainNode(step: any, originalIndex: number, currentGlobalIndex: number, expandedSoFar: any[]): any | null {
    // Handle LangChain action: { action: "tool_name", tool_input: {...} }
    if (step.action !== undefined) {
      const toolName = typeof step.action === 'string' ? step.action : 
                       step.action?.tool || step.action?.name || 'tool';
      const toolInput = step.tool_input || step.input || step.args || {};
      
      const actionContent = typeof toolInput === 'string' 
        ? `${toolName}: ${toolInput}`
        : `${toolName}\n${JSON.stringify(toolInput, null, 2)}`;
      
      return {
        ...step,
        id: `step-${originalIndex}-action`,
        content: actionContent,
        type: 'action',
        _originalIndex: originalIndex,
        _langChainAction: true,
        tool: toolName,
        tool_input: toolInput
      };
    }
    
    // Handle LangChain observation: { observation: {...} } or { observation: "result" }
    if (step.observation !== undefined) {
      const obsValue = step.observation;
      const obsContent = typeof obsValue === 'string' ? obsValue :
                         (obsValue === null || obsValue === undefined) ? '[No result]' :
                         JSON.stringify(obsValue, null, 2);
      
      return {
        ...step,
        id: `step-${originalIndex}-observation`,
        content: obsContent,
        type: 'observation',
        _originalIndex: originalIndex,
        _langChainObservation: true
      };
    }
    
    // Handle thought/reasoning nodes
    if (step.thought !== undefined || step.thinking !== undefined || step.reasoning !== undefined) {
      const thoughtContent = step.thought || step.thinking || step.reasoning;
      return {
        ...step,
        id: `step-${originalIndex}-thought`,
        content: typeof thoughtContent === 'string' ? thoughtContent : JSON.stringify(thoughtContent, null, 2),
        type: 'thought',
        _originalIndex: originalIndex
      };
    }
    
    // Handle output/final_answer nodes
    if (step.output !== undefined || step.final_answer !== undefined) {
      const outputContent = step.output || step.final_answer;
      return {
        ...step,
        id: `step-${originalIndex}-output`,
        content: typeof outputContent === 'string' ? outputContent : JSON.stringify(outputContent, null, 2),
        type: 'output',
        _originalIndex: originalIndex
      };
    }
    
    return null;
  }

  // Link action nodes to their following observation nodes
  private linkLangChainNodes(expanded: any[]): void {
    for (let i = 0; i < expanded.length - 1; i++) {
      const current = expanded[i];
      const next = expanded[i + 1];
      
      // Link action to following observation
      if (current._langChainAction && next._langChainObservation) {
        current._linkedObservationId = next.id;
        next._linkedActionId = current.id;
      }
    }
  }

  // Extract initial thought from steps array and final output from top-level fields for LangChain traces
  private extractLangChainSupplementaryNodes(raw: any, intermediateStepsCount: number): { 
    initialThought: any | null; 
    finalOutput: any | null;
  } {
    let initialThought: any | null = null;
    let finalOutput: any | null = null;
    
    // Extract initial thought from steps array (separate from intermediate_steps)
    if (Array.isArray(raw.steps) && raw.steps.length > 0) {
      const firstStep = raw.steps[0];
      if (typeof firstStep === 'object' && firstStep !== null) {
        // Check if it's a thought/thinking step
        const thoughtContent = firstStep.thought || firstStep.thinking || firstStep.reasoning || 
                               firstStep.content || firstStep.text || firstStep.message;
        const stepType = firstStep.type;
        
        if (thoughtContent || stepType === 'thought') {
          const computedContent = typeof thoughtContent === 'string' ? thoughtContent : 
                                  thoughtContent ? JSON.stringify(thoughtContent, null, 2) : 
                                  '[Initial thought]';
          initialThought = {
            ...firstStep,
            id: 'initial-thought',
            type: 'thought',
            content: computedContent,
            _originalIndex: -1,
            _globalIndex: -1
          };
        }
      }
    }
    
    // Extract final output from top-level output/final_answer fields
    // Only if it's not already included in intermediate_steps
    const outputContent = raw.output || raw.final_answer || raw.result || raw.answer;
    if (outputContent !== undefined && outputContent !== null) {
      finalOutput = {
        id: 'final-output',
        type: 'output',
        content: typeof outputContent === 'string' ? outputContent : 
                 JSON.stringify(outputContent, null, 2),
        _originalIndex: intermediateStepsCount,
        _globalIndex: intermediateStepsCount + (initialThought ? 1 : 0)
      };
    }
    
    return { initialThought, finalOutput };
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

  private extractMetrics(step: any): NodeMetrics {
    const metrics: NodeMetrics = {};

    const startTime = this.extractTimingField(step, ['start_time', 'start', 'started_at', 'begin_time']);
    const endTime = this.extractTimingField(step, ['end_time', 'end', 'ended_at', 'finish_time']);
    
    if (startTime !== undefined) {
      metrics.startTime = startTime;
    }
    if (endTime !== undefined) {
      metrics.endTime = endTime;
    }

    const durationFields = ['duration', 'duration_ms', 'execution_time', 'elapsed_ms', 'latency', 'latency_ms'];
    for (const field of durationFields) {
      if (step[field] !== undefined && step[field] !== null) {
        const duration = Number(step[field]);
        if (!isNaN(duration) && duration >= 0) {
          metrics.durationMs = duration;
          break;
        }
      }
    }

    if (metrics.durationMs === undefined && metrics.startTime !== undefined && metrics.endTime !== undefined) {
      metrics.durationMs = metrics.endTime - metrics.startTime;
    }

    const tokenUsage = this.extractTokenUsage(step);
    if (tokenUsage && (tokenUsage.prompt !== undefined || tokenUsage.completion !== undefined || tokenUsage.total !== undefined)) {
      metrics.tokenUsage = tokenUsage;
    }

    const modelFields = ['model', 'model_name', 'llm_name', 'model_id', 'modelName', 'modelId'];
    for (const field of modelFields) {
      if (step[field] !== undefined && step[field] !== null && typeof step[field] === 'string') {
        metrics.modelName = step[field];
        break;
      }
    }

    const errorInfo = this.extractErrorInfo(step);
    if (errorInfo.hasError) {
      metrics.hasError = true;
      if (errorInfo.errorMessage) {
        metrics.errorMessage = errorInfo.errorMessage;
      }
    }

    if (metrics.durationMs !== undefined && metrics.durationMs > SLOW_THRESHOLD_MS) {
      metrics.isSlow = true;
    }

    if (metrics.tokenUsage?.total !== undefined && metrics.tokenUsage.total > HEAVY_TOKEN_THRESHOLD) {
      metrics.isTokenHeavy = true;
    }

    return metrics;
  }

  private extractTimingField(step: any, fields: string[]): number | undefined {
    for (const field of fields) {
      if (step[field] !== undefined && step[field] !== null) {
        const parsed = this.parseTimestamp(step[field]);
        if (parsed !== undefined) {
          return parsed;
        }
      }
    }
    return undefined;
  }

  private extractTokenUsage(step: any): TokenUsage | undefined {
    const usage: TokenUsage = {};

    const usageContainers = ['usage', 'token_usage', 'tokens', 'tokenUsage'];
    let usageObj: any = null;
    
    for (const container of usageContainers) {
      if (step[container] && typeof step[container] === 'object') {
        usageObj = step[container];
        break;
      }
    }

    if (usageObj) {
      const promptFields = ['prompt_tokens', 'promptTokens', 'input_tokens', 'inputTokens', 'token_count_input'];
      for (const field of promptFields) {
        if (usageObj[field] !== undefined) {
          const val = Number(usageObj[field]);
          if (!isNaN(val)) {
            usage.prompt = val;
            break;
          }
        }
      }

      const completionFields = ['completion_tokens', 'completionTokens', 'output_tokens', 'outputTokens', 'token_count_output'];
      for (const field of completionFields) {
        if (usageObj[field] !== undefined) {
          const val = Number(usageObj[field]);
          if (!isNaN(val)) {
            usage.completion = val;
            break;
          }
        }
      }

      const totalFields = ['total_tokens', 'totalTokens', 'token_count', 'total'];
      for (const field of totalFields) {
        if (usageObj[field] !== undefined) {
          const val = Number(usageObj[field]);
          if (!isNaN(val)) {
            usage.total = val;
            break;
          }
        }
      }
    }

    const directPromptFields = ['token_count_input', 'input_tokens', 'prompt_tokens'];
    for (const field of directPromptFields) {
      if (usage.prompt === undefined && step[field] !== undefined) {
        const val = Number(step[field]);
        if (!isNaN(val)) {
          usage.prompt = val;
          break;
        }
      }
    }

    const directCompletionFields = ['token_count_output', 'output_tokens', 'completion_tokens'];
    for (const field of directCompletionFields) {
      if (usage.completion === undefined && step[field] !== undefined) {
        const val = Number(step[field]);
        if (!isNaN(val)) {
          usage.completion = val;
          break;
        }
      }
    }

    const directTotalFields = ['total_tokens', 'token_count'];
    for (const field of directTotalFields) {
      if (usage.total === undefined && step[field] !== undefined) {
        const val = Number(step[field]);
        if (!isNaN(val)) {
          usage.total = val;
          break;
        }
      }
    }

    if (usage.total === undefined && usage.prompt !== undefined && usage.completion !== undefined) {
      usage.total = usage.prompt + usage.completion;
    }

    return (usage.prompt !== undefined || usage.completion !== undefined || usage.total !== undefined) 
      ? usage 
      : undefined;
  }

  private extractErrorInfo(step: any): { hasError: boolean; errorMessage?: string } {
    const errorFields = ['error', 'error_message', 'exception', 'failure', 'errorMessage'];
    
    for (const field of errorFields) {
      if (step[field] !== undefined && step[field] !== null) {
        const value = step[field];
        if (typeof value === 'string' && value.length > 0) {
          return { hasError: true, errorMessage: value };
        }
        if (typeof value === 'object' && value !== null) {
          const msg = value.message || value.msg || value.description || JSON.stringify(value);
          return { hasError: true, errorMessage: msg };
        }
        if (value === true) {
          return { hasError: true };
        }
      }
    }

    if (step.status === 'error' || step.status === 'failed' || step.status === 'failure') {
      return { hasError: true, errorMessage: `Status: ${step.status}` };
    }

    if (step.success === false) {
      return { hasError: true, errorMessage: 'success: false' };
    }

    return { hasError: false };
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

  /**
   * DETERMINISTIC NODE TYPE DETECTION
   * 
   * Normalization rules (applied consistently across all formats):
   * - thought: reasoning, chain-of-thought, planning, thinking
   * - action: tool call, function call, external API invocation
   * - observation: tool result, function return, structured data response
   * - output: final answer, completion, user-facing response
   * - system: logs, errors, internal messages
   */
  private detectType(step: any, mapping?: FieldMapping): NodeType {
    // Priority 1: Explicit type field with exact match
    if (step.type === 'action') return 'action';
    if (step.type === 'observation') return 'observation';
    if (step.type === 'thought') return 'thought';
    if (step.type === 'output') return 'output';
    if (step.type === 'system') return 'system';
    
    // Priority 2: Custom mapping
    if (mapping?.typeField) {
      const customType = this.getNestedValue(step, mapping.typeField);
      if (customType) {
        const normalized = this.normalizeType(String(customType).toLowerCase());
        if (normalized !== 'other') return normalized;
      }
    }

    // Priority 3: LangChain internal markers (from expandSteps)
    if (step._langChainAction) return 'action';
    if (step._langChainObservation) return 'observation';

    // Priority 4: Original key from sub-step expansion
    if (step._originalKey) {
      const key = step._originalKey.toLowerCase();
      if (key === 'thought' || key === 'thinking' || key === 'reasoning') return 'thought';
      if (key === 'action' || key === 'tool_call') return 'action';
      if (key === 'observation' || key === 'result' || key === 'tool_result') return 'observation';
      if (key === 'output' || key === 'final_answer' || key === 'answer') return 'output';
    }

    // Priority 5: OpenAI/Anthropic role-based detection
    if (step.role === 'tool' || step.role === 'function') {
      return 'observation';
    }
    if (step.role === 'system') {
      return 'system';
    }
    if (step.tool_call_id && step.content !== undefined) {
      return 'observation';
    }

    // Priority 6: Normalize string type values
    if (step.type !== undefined && step.type !== null) {
      const normalized = this.normalizeType(String(step.type).toLowerCase());
      if (normalized !== 'other') return normalized;
    }

    // Priority 7: LangChain schema detection
    // ACTION: has tool/function call indicators
    if (step.action !== undefined && step.tool_input !== undefined) {
      return 'action';
    }
    if (step.tool || step.tool_name || step.function_call || step.function || step.tool_calls) {
      return 'action';
    }

    // OBSERVATION: has result/response data
    if (step.observation !== undefined) {
      return 'observation';
    }
    if (step.result !== undefined || step.response !== undefined || 
        step.tool_output !== undefined || step.return_value !== undefined) {
      return 'observation';
    }

    // OUTPUT: final answer markers
    if (step.final_answer !== undefined || step.answer !== undefined || 
        step.completion !== undefined || step.output_text !== undefined ||
        step.is_final === true || step.finished === true) {
      return 'output';
    }
    
    // Special case: LangChain output field at step level (not top-level)
    if (step.output !== undefined && step._originalIndex !== undefined) {
      // Check if this looks like a final output vs an observation
      const outputContent = String(step.output || '').toLowerCase();
      if (outputContent.match(/\b(final|answer|conclusion|result|here\s+is|here\s+are)\b/i)) {
        return 'output';
      }
      // If it's structured data, it's likely an observation
      if (typeof step.output === 'object' && step.output !== null) {
        return 'observation';
      }
    }

    // Priority 8: Role-based with content analysis
    if (step.role === 'assistant') {
      // Check for tool calls first
      if (step.tool_calls || step.function_call) {
        return 'action';
      }
      
      // Default assistant messages are thoughts
      return 'thought';
    }

    // Priority 9: Check additional type fields
    const typeFields = ['kind', 'nodeType', 'node_type', 'step_type', 'event_type', 'category'];
    for (const field of typeFields) {
      if (step[field]) {
        const normalized = this.normalizeType(String(step[field]).toLowerCase());
        if (normalized !== 'other') return normalized;
      }
    }

    // Priority 10: Content-based heuristics (last resort)
    const content = String(step.content || step.text || step.message || '').toLowerCase();
    
    // Error content → system
    if (content.match(/\b(error|failed|exception|traceback|stack\s*trace)\b/i)) {
      return 'system';
    }
    
    // Action indicators
    if (content.match(/\b(calling|executing|running|invoking|fetching|searching|querying)\s+\w+/i)) {
      return 'action';
    }
    
    // Observation indicators
    if (content.match(/\b(returned|received|got|found|result|response)\s*:/i)) {
      return 'observation';
    }
    
    // Output indicators
    if (content.match(/\b(final\s+answer|in\s+conclusion|therefore|the\s+answer\s+is|here\s+is\s+the|here\s+are\s+the)\b/i)) {
      return 'output';
    }
    
    // Thought indicators
    if (content.match(/\b(i\s+need\s+to|let\s+me|i\s+will|i'll|thinking|planning|considering|analyzing)\b/i)) {
      return 'thought';
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
      // Remove all internal/private fields (prefixed with underscore)
      const internalFields = [
        '_originalIndex',
        '_tupleIndex', 
        '_originalKey',
        '_parentStepId',
        '_globalIndex',
        '_linkedObservationId',
        '_linkedActionId',
        '_langChainAction',
        '_langChainObservation'
      ];
      
      for (const field of internalFields) {
        delete sanitized[field];
      }
      
      return JSON.parse(JSON.stringify(sanitized));
    } catch {
      return {};
    }
  }
}

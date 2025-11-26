/**
 * Trace Analyzer - Smart rule-based failure detection for agent execution traces
 * 
 * Detects critical agent failures:
 * - Guessing after error: API fails, agent hallucinates instead of handling
 * - Commit after empty: Empty results but agent proceeds with commit action
 * - Unhandled error: Error occurs but trace ends with confident success
 * - Missing observations: Action without corresponding tool result
 * - Error ignored: Flow continues after error without handling
 * - Empty results: Tool returned empty but agent continued
 * - Loops: Repeated similar actions
 * - Suspicious transitions: Unexpected step sequences
 * - Contradictions: Conflicting statements in trace
 */

import { TraceNode, TraceRun, TraceIssue, IssueType, RiskLevel } from '../models';

// ============================================================================
// STEP LABELS - Derive boolean labels for each step
// ============================================================================

interface StepLabels {
  isErrorObservation: boolean;
  isEmptyResult: boolean;
  isCommitAction: boolean;
  isSpeculativeText: boolean;
  isSuccessOutput: boolean;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
}

const ERROR_PATTERNS = [
  /\berror\b/i, /\bfailed\b/i, /\bfailure\b/i, /\bexception\b/i,
  /\bquota\s*(exceeded|limit)/i, /\btimeout\b/i, /\brefused\b/i,
  /\bunauthorized\b/i, /\bforbidden\b/i, /\bdenied\b/i,
  /\bunable\s+to\b/i, /\bcould\s+not\b/i, /\bcannot\b/i,
  /\b4\d{2}\b/, /\b5\d{2}\b/, // HTTP 4xx/5xx codes
  /\brate\s*limit/i, /\bapi\s*(key\s*)?(invalid|expired|missing)/i,
  /\bconnection\s*(refused|reset|timeout)/i,
  /\bnetwork\s+error/i, /\brequest\s+failed/i
];

const EMPTY_RESULT_PATTERNS = [
  /^\s*\[\s*\]\s*$/,  // []
  /^\s*\{\s*\}\s*$/,  // {}
  /^(null|undefined|none|nil)$/i,
  /\bno\s+(results?|flights?|data|items?|records?|matches?)\s*(found|returned|available)?/i,
  /\bempty\s+(response|result|data|list|array|set)/i,
  /\bnothing\s+(found|returned|available|here)/i,
  /\b0\s+(results?|items?|records?|matches?)/i,
  /flights?:\s*\[\s*\]/i,
  /results?:\s*\[\s*\]/i,
  /data:\s*\[\s*\]/i,
  /items?:\s*\[\s*\]/i
];

const COMMIT_TOOLS = [
  'payment', 'pay', 'charge', 'purchase', 'buy',
  'book', 'booking', 'reserve', 'reservation',
  'create', 'insert', 'add', 'post',
  'update', 'put', 'patch', 'modify', 'edit',
  'delete', 'remove', 'destroy',
  'send', 'submit', 'confirm', 'finalize',
  'write', 'save', 'store',
  'order', 'checkout', 'complete',
  'payment_api', 'booking_api', 'order_api',
  'db_write', 'db_insert', 'db_update', 'db_delete',
  'stripe', 'paypal', 'square'
];

const SPECULATIVE_PATTERNS = [
  /\bi('ll)?\s*(just\s+)?(guess|assume|suppose|imagine)/i,
  /\bprobably\b/i, /\blikely\b/i, /\bmaybe\b/i, /\bperhaps\b/i,
  /\bi\s+think\b/i, /\bi\s+believe\b/i, /\bi('ll)?\s+estimate/i,
  /\bbased\s+on\s+(season|time|experience|general)/i,
  /\bwithout\s+(the\s+)?(data|results?|information)/i,
  /\bmaking\s+(an?\s+)?assumption/i,
  /\bguessing\b/i, /\bassuming\b/i,
  /\blet\s*('s|me)\s+(just\s+)?guess/i,
  /\bI\s+don't\s+have\s+(the\s+)?(actual|real)/i
];

const SUCCESS_OUTPUT_PATTERNS = [
  /\bsuccessfully\b/i, /\bsuccess\b/i, /\bcompleted?\b/i,
  /\bbooked\b/i, /\bpurchased\b/i, /\bordered\b/i,
  /\bcreated\b/i, /\bconfirmed\b/i, /\bfinalized\b/i,
  /\bpayment\s+(processed|complete|successful)/i,
  /\breservation\s+(confirmed|complete)/i,
  /\bflight\s+booked/i, /\bhotel\s+reserved/i,
  /\byour\s+(order|booking|reservation)\s+(is|has\s+been)/i,
  /\bdone\b/i, /\bfinished\b/i
];

function extractToolName(node: TraceNode): string | undefined {
  const metadata = node.metadata || {};
  const raw = node.metadata?.raw || {};
  return metadata.tool || metadata.tool_name || metadata.function || 
         metadata.name || metadata.action || 
         raw.tool || raw.tool_name || raw.function_name || raw.action ||
         undefined;
}

function extractToolInput(node: TraceNode): any {
  const metadata = node.metadata || {};
  return metadata.tool_input || metadata.input || metadata.args || 
         metadata.arguments || metadata.query || 
         metadata.raw?.tool_input || metadata.raw?.input || undefined;
}

function extractToolOutput(node: TraceNode): any {
  const metadata = node.metadata || {};
  return metadata.tool_output || metadata.output || metadata.result || 
         metadata.response || metadata.raw?.output || metadata.raw?.result || undefined;
}

function isEmptyValue(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

function deriveStepLabels(node: TraceNode): StepLabels {
  const content = node.content || '';
  const toolOutput = extractToolOutput(node);
  const outputStr = typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput || '');
  const combinedContent = `${content} ${outputStr}`;
  
  const isErrorObservation = (node.type === 'observation' || node.metadata?.error) && (
    ERROR_PATTERNS.some(p => p.test(combinedContent)) ||
    node.metadata?.error === true ||
    node.metadata?.status === 'error' ||
    node.metadata?.status === 'failed' ||
    !!node.metadata?.exception
  );
  
  const hasEmptyPatternMatch = EMPTY_RESULT_PATTERNS.some(p => p.test(combinedContent));
  const hasEmptyArraySyntax = content.trim() === '[]' || content.trim() === '{}';
  const hasEmptyStructuredOutput = isEmptyValue(toolOutput);
  
  const isEmptyResult = node.type === 'observation' && (
    hasEmptyPatternMatch ||
    hasEmptyArraySyntax ||
    (hasEmptyStructuredOutput && toolOutput !== undefined)
  );
  
  const toolName = extractToolName(node);
  const isCommitAction = node.type === 'action' && (
    COMMIT_TOOLS.some(t => toolName?.toLowerCase().includes(t)) ||
    COMMIT_TOOLS.some(t => content.toLowerCase().includes(t))
  );
  
  const isSpeculativeText = (node.type === 'thought' || node.type === 'output') &&
    SPECULATIVE_PATTERNS.some(p => p.test(content));
  
  const isSuccessOutput = node.type === 'output' &&
    SUCCESS_OUTPUT_PATTERNS.some(p => p.test(content));
  
  return {
    isErrorObservation,
    isEmptyResult,
    isCommitAction,
    isSpeculativeText,
    isSuccessOutput,
    toolName,
    toolInput: extractToolInput(node),
    toolOutput
  };
}

// ============================================================================
// ISSUE SUGGESTIONS
// ============================================================================

const ISSUE_SUGGESTIONS: Record<IssueType, string> = {
  guessing_after_error: 'Return an explicit error to the user instead of guessing. Add error handling that catches API failures and provides appropriate fallback behavior.',
  commit_after_empty: 'Add a guardrail that validates data exists before committing. Check that required fields are non-empty before proceeding with payment, booking, or writes.',
  unhandled_error: 'Surface the error to the user instead of proceeding as if successful. Add error handling that detects failures and communicates them clearly.',
  missing_observation: 'Check that tool responses are being logged as observations. Ensure error handling captures failures.',
  error_ignored: 'Add error handling to catch failures and prevent the flow from continuing with bad data.',
  empty_result: 'Add a verification step to handle empty or partial tool outputs before proceeding.',
  loop: 'Consider adding a max-retries guard or a fallback branch to prevent infinite loops.',
  suspicious_transition: 'Review the flow logic - this transition may indicate a missed step or error handling issue.',
  contradiction_candidate: 'The trace contains potentially conflicting information. Add validation steps to catch inconsistencies.'
};

function generateIssueId(): string {
  return `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// RULE-BASED DETECTORS
// ============================================================================

/**
 * GUESSING AFTER ERROR (High Severity)
 * Pattern: error observation → speculative thought/output
 * "API failed. I'll just guess based on season."
 */
export function detectGuessingAfterError(nodes: TraceNode[], labels: Map<string, StepLabels>): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i];
    const nodeLabels = labels.get(node.id)!;
    
    if (nodeLabels.isErrorObservation) {
      // Look at the next 1-3 steps for speculative text
      for (let j = i + 1; j < Math.min(i + 4, nodes.length); j++) {
        const nextNode = nodes[j];
        const nextLabels = labels.get(nextNode.id)!;
        
        if (nextLabels.isSpeculativeText) {
          const toolName = nodeLabels.toolName || 'API';
          issues.push({
            id: generateIssueId(),
            type: 'guessing_after_error',
            severity: 'error',
            nodeIds: [node.id, nextNode.id],
            title: `Guessing after ${toolName} error`,
            description: `The ${toolName} call failed, but instead of handling the error, the agent guessed or made assumptions. This can produce hallucinated or incorrect results.`,
            suggestion: ISSUE_SUGGESTIONS.guessing_after_error
          });
          break;
        }
      }
    }
  }
  
  return issues;
}

/**
 * COMMIT AFTER EMPTY (High Severity)
 * Pattern: empty result observation → commit action OR success output
 * "flights: []" → payment_api → "Flight booked successfully!"
 */
export function detectCommitAfterEmpty(nodes: TraceNode[], labels: Map<string, StepLabels>): TraceIssue[] {
  const issues: TraceIssue[] = [];
  const emptyResultNodes: { node: TraceNode; index: number }[] = [];
  
  // Find all empty result observations
  for (let i = 0; i < nodes.length; i++) {
    const nodeLabels = labels.get(nodes[i].id)!;
    if (nodeLabels.isEmptyResult) {
      emptyResultNodes.push({ node: nodes[i], index: i });
    }
  }
  
  // For each empty result, check if there's a commit action or success output after it
  for (const { node: emptyNode, index: emptyIndex } of emptyResultNodes) {
    for (let j = emptyIndex + 1; j < nodes.length; j++) {
      const laterNode = nodes[j];
      const laterLabels = labels.get(laterNode.id)!;
      
      if (laterLabels.isCommitAction) {
        const toolName = laterLabels.toolName || 'commit action';
        issues.push({
          id: generateIssueId(),
          type: 'commit_after_empty',
          severity: 'error',
          nodeIds: [emptyNode.id, laterNode.id],
          title: `${toolName} called with empty data`,
          description: `An empty result was received (no data available), but the agent proceeded to call ${toolName}. This may result in invalid operations or data corruption.`,
          suggestion: `Add a guardrail that checks for non-empty data before calling ${toolName}. For example: if flights.length === 0, return an error instead of proceeding.`
        });
        break;
      }
      
      if (laterLabels.isSuccessOutput && laterNode.type === 'output') {
        issues.push({
          id: generateIssueId(),
          type: 'commit_after_empty',
          severity: 'error',
          nodeIds: [emptyNode.id, laterNode.id],
          title: 'Success claimed with empty data',
          description: `The agent claimed success (e.g., "booked", "completed") even though required data was empty or missing. This is likely a hallucinated success.`,
          suggestion: ISSUE_SUGGESTIONS.commit_after_empty
        });
        break;
      }
    }
  }
  
  return issues;
}

/**
 * UNHANDLED ERROR (Medium Severity)
 * Pattern: error observation exists, but trace ends with confident output (no error surfaced)
 */
export function detectUnhandledError(nodes: TraceNode[], labels: Map<string, StepLabels>): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  // Find all error observations
  const errorNodes: TraceNode[] = [];
  for (const node of nodes) {
    const nodeLabels = labels.get(node.id)!;
    if (nodeLabels.isErrorObservation) {
      errorNodes.push(node);
    }
  }
  
  if (errorNodes.length === 0) return issues;
  
  // Check if the trace ends with a confident output
  const lastNodes = nodes.slice(-3);
  const outputNode = lastNodes.find(n => n.type === 'output');
  
  if (outputNode) {
    const outputLabels = labels.get(outputNode.id)!;
    const outputContent = outputNode.content.toLowerCase();
    
    // Check if output mentions the error or is successful-sounding
    const mentionsError = /error|failed|sorry|couldn't|unable|problem/i.test(outputNode.content);
    
    if (!mentionsError && (outputLabels.isSuccessOutput || !outputLabels.isSpeculativeText)) {
      // Check if the error was properly handled (e.g., followed by a recovery action)
      for (const errorNode of errorNodes) {
        const toolName = labels.get(errorNode.id)!.toolName || 'tool';
        issues.push({
          id: generateIssueId(),
          type: 'unhandled_error',
          severity: 'warning',
          nodeIds: [errorNode.id, outputNode.id],
          title: `Error from ${toolName} not surfaced`,
          description: `An error occurred with ${toolName}, but the final output doesn't mention it. The user may not know that something went wrong.`,
          suggestion: ISSUE_SUGGESTIONS.unhandled_error
        });
      }
    }
  }
  
  return issues;
}

/**
 * MISSING OBSERVATION (Medium Severity)
 * Pattern: action with no observation for that tool in the rest of the trace
 */
export function detectMissingObservations(nodes: TraceNode[], labels: Map<string, StepLabels>): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== 'action') continue;
    
    const nextNode = nodes[i + 1];
    
    // Action at end of trace with no result
    if (!nextNode) {
      const toolName = labels.get(node.id)!.toolName || 'unknown';
      issues.push({
        id: generateIssueId(),
        type: 'missing_observation',
        severity: 'warning',
        nodeIds: [node.id],
        title: `No result for ${toolName}`,
        description: `Tool call "${toolName}" has no following observation or result. The result may be missing or not logged.`,
        suggestion: ISSUE_SUGGESTIONS.missing_observation
      });
    } 
    // Action followed by something other than observation/output
    else if (nextNode.type !== 'observation' && nextNode.type !== 'output') {
      const toolName = labels.get(node.id)!.toolName || 'unknown';
      issues.push({
        id: generateIssueId(),
        type: 'missing_observation',
        severity: 'warning',
        nodeIds: [node.id, nextNode.id],
        title: `Missing result for ${toolName}`,
        description: `Tool call "${toolName}" is followed by a ${nextNode.type} instead of an observation. The result may not have been captured.`,
        suggestion: ISSUE_SUGGESTIONS.missing_observation
      });
    }
  }
  
  return issues;
}

/**
 * ERROR IGNORED (Medium Severity)
 * Pattern: error observation → another action (without error handling)
 */
export function detectErrorsIgnored(nodes: TraceNode[], labels: Map<string, StepLabels>): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i];
    const nodeLabels = labels.get(node.id)!;
    
    if (nodeLabels.isErrorObservation) {
      const nextNode = nodes[i + 1];
      
      // Check if next node is an action (not error handling)
      if (nextNode && nextNode.type === 'action') {
        const errorToolName = nodeLabels.toolName || 'tool';
        const nextToolName = labels.get(nextNode.id)!.toolName || 'another tool';
        
        // Skip if it looks like a retry of the same tool
        if (errorToolName === nextToolName) continue;
        
        issues.push({
          id: generateIssueId(),
          type: 'error_ignored',
          severity: 'warning',
          nodeIds: [node.id, nextNode.id],
          title: `Error from ${errorToolName} ignored`,
          description: `An error occurred with ${errorToolName}, but the agent proceeded to call ${nextToolName} without apparent error handling.`,
          suggestion: ISSUE_SUGGESTIONS.error_ignored
        });
      }
    }
  }
  
  return issues;
}

/**
 * EMPTY RESULT USED (Low Severity)
 * Pattern: empty observation → thought or action continues
 * (Lower severity than commit_after_empty)
 */
export function detectEmptyResults(nodes: TraceNode[], labels: Map<string, StepLabels>): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i];
    const nodeLabels = labels.get(node.id)!;
    
    if (nodeLabels.isEmptyResult) {
      const nextNode = nodes[i + 1];
      const nextLabels = labels.get(nextNode.id)!;
      
      // Skip if already caught by commit_after_empty
      if (nextLabels.isCommitAction) continue;
      
      if (nextNode && (nextNode.type === 'action' || nextNode.type === 'thought')) {
        issues.push({
          id: generateIssueId(),
          type: 'empty_result',
          severity: 'warning',
          nodeIds: [node.id, nextNode.id],
          title: 'Continuing with empty result',
          description: 'An empty or null result was received, but the flow continued without validation or fallback.',
          suggestion: ISSUE_SUGGESTIONS.empty_result
        });
      }
    }
  }
  
  return issues;
}

/**
 * LOOPS (Medium Severity)
 * Pattern: 3+ consecutive similar tool calls
 */
export function detectLoops(nodes: TraceNode[], labels: Map<string, StepLabels>): TraceIssue[] {
  const issues: TraceIssue[] = [];
  const actionNodes = nodes.filter(n => n.type === 'action');
  
  if (actionNodes.length < 3) return issues;
  
  let consecutiveCount = 1;
  let lastSimilarStart = 0;
  
  for (let i = 1; i < actionNodes.length; i++) {
    const prevLabels = labels.get(actionNodes[i - 1].id)!;
    const currLabels = labels.get(actionNodes[i].id)!;
    
    if (prevLabels.toolName && currLabels.toolName && prevLabels.toolName === currLabels.toolName) {
      consecutiveCount++;
    } else {
      if (consecutiveCount >= 3) {
        const loopNodes = actionNodes.slice(lastSimilarStart, i);
        const toolName = labels.get(loopNodes[0].id)!.toolName || 'action';
        issues.push({
          id: generateIssueId(),
          type: 'loop',
          severity: consecutiveCount >= 5 ? 'error' : 'warning',
          nodeIds: loopNodes.map(n => n.id),
          title: `Repeated ${toolName} (${consecutiveCount}x)`,
          description: `The same tool was called ${consecutiveCount} times in succession. This may indicate an infinite loop or retry storm.`,
          suggestion: ISSUE_SUGGESTIONS.loop
        });
      }
      consecutiveCount = 1;
      lastSimilarStart = i;
    }
  }
  
  if (consecutiveCount >= 3) {
    const loopNodes = actionNodes.slice(lastSimilarStart);
    const toolName = labels.get(loopNodes[0].id)!.toolName || 'action';
    issues.push({
      id: generateIssueId(),
      type: 'loop',
      severity: consecutiveCount >= 5 ? 'error' : 'warning',
      nodeIds: loopNodes.map(n => n.id),
      title: `Repeated ${toolName} (${consecutiveCount}x)`,
      description: `The same tool was called ${consecutiveCount} times in succession. This may indicate an infinite loop or retry storm.`,
      suggestion: ISSUE_SUGGESTIONS.loop
    });
  }
  
  return issues;
}

/**
 * SUSPICIOUS TRANSITIONS (Low Severity)
 * Pattern: Unexpected step sequences with better heuristics
 * 
 * Improved heuristics:
 * - Content length mismatch: Very short action with very long observation (or vice versa)
 * - Missing arguments: Action with no tool_input or arguments
 * - Missing tool response: Action followed by output with no observation
 * - Skip false positives for common valid patterns
 */
export function detectSuspiciousTransitions(nodes: TraceNode[], labels: Map<string, StepLabels>): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  // Valid transition patterns - be more permissive to avoid false positives
  const validTransitions: Record<string, string[]> = {
    thought: ['action', 'thought', 'output', 'observation', 'system'],
    action: ['observation', 'output', 'thought', 'action', 'system'],
    observation: ['thought', 'action', 'output', 'observation', 'system'],
    output: ['thought', 'action', 'output', 'system'],
    system: ['thought', 'action', 'output', 'system', 'observation'],
    other: ['thought', 'action', 'observation', 'output', 'system', 'other']
  };
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    const currentLabels = labels.get(current.id);
    const nextLabels = labels.get(next.id);
    
    // Check 1: Action → Output without observation (might be missing tool response)
    // Only flag if action has a tool name (not just a generic thought)
    if (current.type === 'action' && next.type === 'output') {
      const toolName = currentLabels?.toolName;
      if (toolName && toolName !== 'unknown') {
        // Check if action has meaningful input that would expect a response
        const toolInput = currentLabels?.toolInput;
        const hasInput = toolInput !== undefined && toolInput !== null && 
                        (typeof toolInput !== 'object' || Object.keys(toolInput).length > 0);
        
        if (hasInput) {
          issues.push({
            id: generateIssueId(),
            type: 'suspicious_transition',
            severity: 'warning',
            nodeIds: [current.id, next.id],
            title: `Action "${toolName}" → Output without observation`,
            description: `Tool "${toolName}" was called but there's no observation/result before the output. The tool response may not have been logged.`,
            suggestion: ISSUE_SUGGESTIONS.suspicious_transition
          });
        }
      }
      continue;
    }
    
    // Check 2: Action without arguments (missing tool_input)
    if (current.type === 'action') {
      const toolName = currentLabels?.toolName;
      const toolInput = currentLabels?.toolInput;
      const hasNoInput = toolInput === undefined || toolInput === null ||
                        (typeof toolInput === 'object' && Object.keys(toolInput).length === 0);
      
      // Only flag if it's a tool that would typically need arguments
      const toolsNeedingArgs = ['search', 'query', 'fetch', 'get', 'post', 'api', 'call'];
      const needsArgs = toolName && toolsNeedingArgs.some(t => toolName.toLowerCase().includes(t));
      
      if (needsArgs && hasNoInput) {
        issues.push({
          id: generateIssueId(),
          type: 'suspicious_transition',
          severity: 'warning',
          nodeIds: [current.id],
          title: `Action "${toolName}" missing arguments`,
          description: `Tool "${toolName}" was called without input arguments. This may indicate incomplete logging or a misconfigured tool call.`,
          suggestion: 'Verify that tool inputs are being logged correctly.'
        });
      }
    }
    
    // Check 3: Content length mismatch (very short action, very long observation)
    // This could indicate a parsing issue or corrupted data
    if (current.type === 'action' && next.type === 'observation') {
      const actionLen = current.content?.length || 0;
      const obsLen = next.content?.length || 0;
      
      // Flag extreme mismatches (action < 10 chars, observation > 5000 chars)
      // or (action > 5000 chars, observation < 10 chars)
      const extremeShort = 10;
      const extremeLong = 5000;
      
      if ((actionLen < extremeShort && obsLen > extremeLong) ||
          (actionLen > extremeLong && obsLen < extremeShort)) {
        // Don't flag if observation is an error (errors can be short)
        if (!nextLabels?.isErrorObservation) {
          issues.push({
            id: generateIssueId(),
            type: 'suspicious_transition',
            severity: 'warning',
            nodeIds: [current.id, next.id],
            title: 'Content length mismatch',
            description: `Unusual content length difference between action (${actionLen} chars) and observation (${obsLen} chars). This may indicate a parsing or logging issue.`,
            suggestion: 'Review the raw data to ensure content is being extracted correctly.'
          });
        }
      }
    }
    
    // Check 4: Unexpected transition types (only for truly unusual patterns)
    // Skip this check as the above heuristics are more specific and useful
  }
  
  return issues;
}

/**
 * CONTRADICTIONS (Low Severity)
 * Pattern: Conflicting statements in trace
 */
export function detectContradictions(nodes: TraceNode[]): TraceIssue[] {
  const issues: TraceIssue[] = [];
  const observations = nodes.filter(n => n.type === 'observation' || n.type === 'output');
  
  const negationPairs = [
    [/no\s+(results?|flights?|data|items?)\s*(found|returned|available)?/i, /(found|have|got)\s+\d+\s+(results?|flights?|items?)/i],
    [/\[\s*\]|empty/i, /contains?\s+\d+/i],
    [/failed|error/i, /success/i],
    [/unavailable/i, /available/i]
  ];
  
  for (let i = 0; i < observations.length; i++) {
    for (let j = i + 1; j < observations.length; j++) {
      const earlier = observations[i];
      const later = observations[j];
      
      for (const [negPattern, affirmPattern] of negationPairs) {
        if (negPattern.test(earlier.content) && affirmPattern.test(later.content)) {
          issues.push({
            id: generateIssueId(),
            type: 'contradiction_candidate',
            severity: 'warning',
            nodeIds: [earlier.id, later.id],
            title: 'Potential contradiction',
            description: 'These observations may contain conflicting information. Review the logic.',
            suggestion: ISSUE_SUGGESTIONS.contradiction_candidate
          });
          break;
        }
      }
    }
  }
  
  return issues;
}

// ============================================================================
// RISK SCORING
// ============================================================================

/**
 * Risk scoring rules:
 * - HIGH: Any unhandled error (error nodes present) OR critical issues (guessing_after_error, commit_after_empty)
 * - MEDIUM: Suspicious transitions, loops, missing observations
 * - LOW: Clean trace with no issues
 */

export function calculateRiskLevel(
  issues: TraceIssue[], 
  errorNodeCount: number = 0
): { level: RiskLevel; explanation: string } {
  // HIGH risk: Any error nodes present OR critical behavioral issues
  const criticalIssues = ['guessing_after_error', 'commit_after_empty', 'unhandled_error', 'error_ignored'];
  const hasCriticalIssue = issues.some(i => criticalIssues.includes(i.type));
  
  if (errorNodeCount > 0 || hasCriticalIssue) {
    const reasons: string[] = [];
    if (errorNodeCount > 0) {
      reasons.push(`${errorNodeCount} error(s) detected`);
    }
    const guessingCount = issues.filter(i => i.type === 'guessing_after_error').length;
    const commitEmptyCount = issues.filter(i => i.type === 'commit_after_empty').length;
    const unhandledCount = issues.filter(i => i.type === 'unhandled_error').length;
    const errorIgnoredCount = issues.filter(i => i.type === 'error_ignored').length;
    
    if (guessingCount > 0) reasons.push(`${guessingCount} case(s) of guessing after error`);
    if (commitEmptyCount > 0) reasons.push(`${commitEmptyCount} commit(s) with empty data`);
    if (unhandledCount > 0) reasons.push(`${unhandledCount} unhandled error(s)`);
    if (errorIgnoredCount > 0) reasons.push(`${errorIgnoredCount} error(s) ignored`);
    
    return { 
      level: 'high', 
      explanation: `Risk high: ${reasons.join(', ')}.`
    };
  }
  
  // MEDIUM risk: Suspicious transitions, loops, missing observations
  const mediumIssues = ['suspicious_transition', 'loop', 'missing_observation'];
  const hasMediumIssue = issues.some(i => mediumIssues.includes(i.type));
  
  if (hasMediumIssue) {
    const reasons: string[] = [];
    const loopCount = issues.filter(i => i.type === 'loop').length;
    const missingObsCount = issues.filter(i => i.type === 'missing_observation').length;
    const suspiciousCount = issues.filter(i => i.type === 'suspicious_transition').length;
    
    if (loopCount > 0) reasons.push(`${loopCount} loop(s) detected`);
    if (missingObsCount > 0) reasons.push(`${missingObsCount} missing observation(s)`);
    if (suspiciousCount > 0) reasons.push(`${suspiciousCount} suspicious transition(s)`);
    
    return { 
      level: 'medium', 
      explanation: `Risk medium: ${reasons.join(', ')}.`
    };
  }
  
  // LOW risk: Clean trace or minor issues only
  if (issues.length === 0) {
    return { level: 'low', explanation: 'No issues detected in this trace.' };
  }
  
  return { 
    level: 'low', 
    explanation: `${issues.length} minor issue(s) detected.`
  };
}

// ============================================================================
// SUMMARY & STATS
// ============================================================================

export interface TraceStats {
  totalNodes: number;
  totalActions: number;
  totalErrors: number;
  issuesByType: Record<IssueType, number>;
}

export function summarizeIssues(issues: TraceIssue[]): Record<IssueType, number> {
  const summary: Record<IssueType, number> = {
    loop: 0,
    missing_observation: 0,
    suspicious_transition: 0,
    contradiction_candidate: 0,
    error_ignored: 0,
    empty_result: 0,
    guessing_after_error: 0,
    commit_after_empty: 0,
    unhandled_error: 0
  };
  
  for (const issue of issues) {
    summary[issue.type]++;
  }
  
  return summary;
}

/**
 * Check if a node has any error indicators
 * Looks for: error keys in metadata, exception fields, error type, error status
 */
function hasErrorIndicators(node: TraceNode): boolean {
  const metadata = node.metadata || {};
  const content = (node.content || '').toLowerCase();
  
  // Check metadata for error fields
  if (metadata.error !== undefined && metadata.error !== false && metadata.error !== null) return true;
  if (metadata.exception !== undefined) return true;
  if (metadata.status === 'error' || metadata.status === 'failed') return true;
  if (metadata.error_type !== undefined) return true;
  if (metadata.error_message !== undefined) return true;
  if (metadata.traceback !== undefined) return true;
  if (metadata.stack_trace !== undefined) return true;
  
  // Check for error in raw data
  const raw = metadata.raw || metadata;
  if (raw.error !== undefined && raw.error !== false && raw.error !== null) return true;
  if (raw.exception !== undefined) return true;
  if (raw.error_code !== undefined) return true;
  
  // Check node type
  if (node.type === 'system' && /error|failed|exception/i.test(content)) return true;
  
  return false;
}

export function computeTraceStats(nodes: TraceNode[], labels: Map<string, StepLabels>, issues: TraceIssue[]): TraceStats {
  let totalErrors = 0;
  
  for (const node of nodes) {
    const nodeLabels = labels.get(node.id);
    
    // Count errors from:
    // 1. isErrorObservation label (pattern-based detection)
    // 2. Error indicators in metadata (key-based detection)
    if (nodeLabels?.isErrorObservation || hasErrorIndicators(node)) {
      totalErrors++;
    }
  }
  
  return {
    totalNodes: nodes.length,
    totalActions: nodes.filter(n => n.type === 'action').length,
    totalErrors,
    issuesByType: summarizeIssues(issues)
  };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export function analyzeTrace(trace: TraceRun): TraceRun & { stats?: TraceStats } {
  const nodes = trace.nodes;
  
  // Step 1: Derive labels for each node
  const labels = new Map<string, StepLabels>();
  for (const node of nodes) {
    labels.set(node.id, deriveStepLabels(node));
  }
  
  // Step 2: Run all detectors
  const allIssues: TraceIssue[] = [
    // High priority (High severity)
    ...detectGuessingAfterError(nodes, labels),
    ...detectCommitAfterEmpty(nodes, labels),
    // Medium priority
    ...detectUnhandledError(nodes, labels),
    ...detectMissingObservations(nodes, labels),
    ...detectErrorsIgnored(nodes, labels),
    ...detectLoops(nodes, labels),
    // Lower priority
    ...detectEmptyResults(nodes, labels),
    ...detectSuspiciousTransitions(nodes, labels),
    ...detectContradictions(nodes)
  ];
  
  // Step 3: Attach issues to nodes
  const nodeIssueMap = new Map<string, TraceIssue[]>();
  for (const issue of allIssues) {
    for (const nodeId of issue.nodeIds) {
      const existing = nodeIssueMap.get(nodeId) || [];
      existing.push(issue);
      nodeIssueMap.set(nodeId, existing);
    }
  }
  
  const analyzedNodes = nodes.map(node => ({
    ...node,
    issues: nodeIssueMap.get(node.id) || []
  }));
  
  // Step 4: Compute stats first (need error count for risk calculation)
  const stats = computeTraceStats(nodes, labels, allIssues);
  
  // Step 5: Calculate risk level with error count
  const { level, explanation } = calculateRiskLevel(allIssues, stats.totalErrors);
  
  // Attach risk level to output nodes
  const outputNodes = analyzedNodes.filter(n => n.type === 'output');
  for (const outputNode of outputNodes) {
    outputNode.riskLevel = level;
  }
  
  return {
    ...trace,
    nodes: analyzedNodes,
    issues: allIssues,
    riskLevel: level,
    riskExplanation: explanation,
    issueSummary: summarizeIssues(allIssues),
    stats
  };
}

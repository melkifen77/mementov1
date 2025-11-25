/**
 * Trace Analyzer - Detects failure patterns and issues in agent execution traces
 * 
 * Detects:
 * - Loops: Repeated similar actions
 * - Missing observations: Action without corresponding tool result
 * - Error ignored: Flow continues after error/failure indication
 * - Empty results: Tool returned empty/null but agent continued
 * - Suspicious transitions: Unexpected step sequences
 * - Contradiction candidates: Conflicting statements in trace
 */

import { TraceNode, TraceRun, TraceIssue, IssueType, RiskLevel } from '../models';

const ISSUE_SUGGESTIONS: Record<IssueType, string> = {
  loop: 'Consider adding a max-retries guard or a fallback branch to prevent infinite loops.',
  missing_observation: 'Check error handling and ensure tool responses are logged as observations.',
  suspicious_transition: 'Review the flow logic - this transition may indicate a missed step or error handling issue.',
  contradiction_candidate: 'The trace contains potentially conflicting information. Add validation steps to catch inconsistencies.',
  error_ignored: 'Add error handling to catch failures and prevent the flow from continuing with bad data.',
  empty_result: 'Add a verification step to handle empty or partial tool outputs before proceeding.'
};

function generateIssueId(): string {
  return `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function normalizeContent(content: string): string {
  return content.toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractToolName(node: TraceNode): string | null {
  const metadata = node.metadata || {};
  return metadata.tool || metadata.tool_name || metadata.function || 
         metadata.name || metadata.action || null;
}

function extractToolInput(node: TraceNode): string {
  const metadata = node.metadata || {};
  const input = metadata.tool_input || metadata.input || metadata.args || 
                metadata.arguments || metadata.query || '';
  return typeof input === 'string' ? input : JSON.stringify(input);
}

function isSimilarAction(a: TraceNode, b: TraceNode, threshold = 0.8): boolean {
  if (a.type !== 'action' || b.type !== 'action') return false;
  
  const toolA = extractToolName(a);
  const toolB = extractToolName(b);
  
  if (toolA && toolB && toolA !== toolB) return false;
  
  const inputA = normalizeContent(extractToolInput(a));
  const inputB = normalizeContent(extractToolInput(b));
  
  if (inputA === inputB) return true;
  
  const similarity = calculateSimilarity(inputA, inputB);
  return similarity >= threshold;
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const maxLen = Math.max(a.length, b.length);
  let prefixLen = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) {
      prefixLen++;
    } else {
      break;
    }
  }
  
  return prefixLen / maxLen;
}

function hasErrorIndicator(content: string): boolean {
  const errorPatterns = [
    /error/i, /failed/i, /failure/i, /exception/i,
    /not found/i, /invalid/i, /timeout/i, /refused/i,
    /unauthorized/i, /forbidden/i, /denied/i,
    /null/i, /undefined/i, /none/i, /empty/i,
    /no results?/i, /could not/i, /unable to/i
  ];
  
  return errorPatterns.some(pattern => pattern.test(content));
}

function hasEmptyResult(content: string): boolean {
  const emptyPatterns = [
    /^(null|undefined|none|\[\]|\{\}|""|'')$/i,
    /no results? found/i,
    /empty (response|result|data|list|array)/i,
    /nothing (found|returned|available)/i
  ];
  
  const normalized = content.trim();
  return emptyPatterns.some(pattern => pattern.test(normalized)) || 
         normalized.length === 0;
}

function hasContradiction(earlier: string, later: string): boolean {
  const negationPairs = [
    [/no results? found/i, /found \d+ results?/i],
    [/not found/i, /found/i],
    [/empty/i, /contains?/i],
    [/failed/i, /succeeded/i],
    [/error/i, /success/i],
    [/unavailable/i, /available/i],
    [/invalid/i, /valid/i],
    [/none/i, /some/i]
  ];
  
  for (const [negA, affirmB] of negationPairs) {
    if (negA.test(earlier) && affirmB.test(later)) {
      return true;
    }
  }
  
  return false;
}

export function detectLoops(nodes: TraceNode[]): TraceIssue[] {
  const issues: TraceIssue[] = [];
  const actionNodes = nodes.filter(n => n.type === 'action');
  
  let consecutiveCount = 1;
  let lastSimilarStart = 0;
  
  for (let i = 1; i < actionNodes.length; i++) {
    if (isSimilarAction(actionNodes[i], actionNodes[i - 1])) {
      consecutiveCount++;
    } else {
      if (consecutiveCount >= 3) {
        const loopNodes = actionNodes.slice(lastSimilarStart, i);
        const toolName = extractToolName(loopNodes[0]) || 'action';
        issues.push({
          id: generateIssueId(),
          type: 'loop',
          severity: consecutiveCount >= 5 ? 'error' : 'warning',
          nodeIds: loopNodes.map(n => n.id),
          title: `Repeated ${toolName} (${consecutiveCount}x)`,
          description: `The same tool call was repeated ${consecutiveCount} times in succession, which may indicate an infinite loop or retry storm.`,
          suggestion: ISSUE_SUGGESTIONS.loop
        });
      }
      consecutiveCount = 1;
      lastSimilarStart = i;
    }
  }
  
  if (consecutiveCount >= 3) {
    const loopNodes = actionNodes.slice(lastSimilarStart);
    const toolName = extractToolName(loopNodes[0]) || 'action';
    issues.push({
      id: generateIssueId(),
      type: 'loop',
      severity: consecutiveCount >= 5 ? 'error' : 'warning',
      nodeIds: loopNodes.map(n => n.id),
      title: `Repeated ${toolName} (${consecutiveCount}x)`,
      description: `The same tool call was repeated ${consecutiveCount} times in succession, which may indicate an infinite loop or retry storm.`,
      suggestion: ISSUE_SUGGESTIONS.loop
    });
  }
  
  return issues;
}

export function detectMissingObservations(nodes: TraceNode[]): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== 'action') continue;
    
    const nextNode = nodes[i + 1];
    
    if (!nextNode) {
      issues.push({
        id: generateIssueId(),
        type: 'missing_observation',
        severity: 'warning',
        nodeIds: [node.id],
        title: 'Action without result',
        description: `Tool call "${extractToolName(node) || 'unknown'}" has no following observation or result.`,
        suggestion: ISSUE_SUGGESTIONS.missing_observation
      });
    } else if (nextNode.type !== 'observation' && nextNode.type !== 'output') {
      const toolName = extractToolName(node) || 'unknown';
      issues.push({
        id: generateIssueId(),
        type: 'missing_observation',
        severity: 'warning',
        nodeIds: [node.id, nextNode.id],
        title: 'Missing tool result',
        description: `Tool call "${toolName}" is followed by a ${nextNode.type} instead of an observation.`,
        suggestion: ISSUE_SUGGESTIONS.missing_observation
      });
    }
  }
  
  return issues;
}

export function detectErrorsIgnored(nodes: TraceNode[]): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i];
    if (node.type !== 'observation') continue;
    
    const hasError = hasErrorIndicator(node.content);
    const metadata = node.metadata || {};
    const hasMetadataError = metadata.error || metadata.status === 'error' || 
                             metadata.status === 'failed' || metadata.exception;
    
    if (hasError || hasMetadataError) {
      const nextNode = nodes[i + 1];
      if (nextNode && nextNode.type === 'action') {
        issues.push({
          id: generateIssueId(),
          type: 'error_ignored',
          severity: 'error',
          nodeIds: [node.id, nextNode.id],
          title: 'Error may be ignored',
          description: 'An error or failure was observed, but the flow continued with another action without apparent error handling.',
          suggestion: ISSUE_SUGGESTIONS.error_ignored
        });
      }
    }
  }
  
  return issues;
}

export function detectEmptyResults(nodes: TraceNode[]): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i];
    if (node.type !== 'observation') continue;
    
    if (hasEmptyResult(node.content)) {
      const nextNode = nodes[i + 1];
      if (nextNode && (nextNode.type === 'action' || nextNode.type === 'thought')) {
        issues.push({
          id: generateIssueId(),
          type: 'empty_result',
          severity: 'warning',
          nodeIds: [node.id, nextNode.id],
          title: 'Empty result used',
          description: 'An empty or null result was received, but the flow continued without validation.',
          suggestion: ISSUE_SUGGESTIONS.empty_result
        });
      }
    }
  }
  
  return issues;
}

export function detectContradictions(nodes: TraceNode[]): TraceIssue[] {
  const issues: TraceIssue[] = [];
  const observations = nodes.filter(n => n.type === 'observation' || n.type === 'output');
  
  for (let i = 0; i < observations.length; i++) {
    for (let j = i + 1; j < observations.length; j++) {
      const earlier = observations[i];
      const later = observations[j];
      
      if (hasContradiction(earlier.content, later.content)) {
        issues.push({
          id: generateIssueId(),
          type: 'contradiction_candidate',
          severity: 'warning',
          nodeIds: [earlier.id, later.id],
          title: 'Potential contradiction',
          description: 'These two observations may contain conflicting information.',
          suggestion: ISSUE_SUGGESTIONS.contradiction_candidate
        });
        break;
      }
    }
  }
  
  return issues;
}

export function detectSuspiciousTransitions(nodes: TraceNode[]): TraceIssue[] {
  const issues: TraceIssue[] = [];
  
  const expectedTransitions: Record<string, string[]> = {
    thought: ['action', 'thought', 'output'],
    action: ['observation', 'output'],
    observation: ['thought', 'action', 'output', 'observation'],
    output: [],
    system: ['thought', 'action', 'output', 'system'],
    other: ['thought', 'action', 'observation', 'output', 'system', 'other']
  };
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    
    const expected = expectedTransitions[current.type] || [];
    if (expected.length > 0 && !expected.includes(next.type)) {
      issues.push({
        id: generateIssueId(),
        type: 'suspicious_transition',
        severity: 'warning',
        nodeIds: [current.id, next.id],
        title: `Unusual: ${current.type} → ${next.type}`,
        description: `A ${current.type} is typically followed by ${expected.join(' or ')}, not ${next.type}.`,
        suggestion: ISSUE_SUGGESTIONS.suspicious_transition
      });
    }
  }
  
  return issues;
}

export function calculateRiskLevel(issues: TraceIssue[]): { level: RiskLevel; explanation: string } {
  if (issues.length === 0) {
    return { level: 'low', explanation: 'No issues detected in this trace.' };
  }
  
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const loopCount = issues.filter(i => i.type === 'loop').length;
  const missingObsCount = issues.filter(i => i.type === 'missing_observation').length;
  
  const reasons: string[] = [];
  
  if (errorCount > 0) {
    reasons.push(`${errorCount} error(s)`);
  }
  if (loopCount > 0) {
    reasons.push(`${loopCount} loop(s) detected`);
  }
  if (missingObsCount > 0) {
    reasons.push(`${missingObsCount} missing observation(s)`);
  }
  if (warningCount > 0 && reasons.length === 0) {
    reasons.push(`${warningCount} warning(s)`);
  }
  
  let level: RiskLevel;
  if (errorCount >= 2 || loopCount >= 2 || (errorCount >= 1 && loopCount >= 1)) {
    level = 'high';
  } else if (errorCount >= 1 || loopCount >= 1 || warningCount >= 3) {
    level = 'medium';
  } else {
    level = 'low';
  }
  
  return {
    level,
    explanation: reasons.length > 0 
      ? `Risk ${level}: ${reasons.join(', ')}.`
      : 'No significant issues detected.'
  };
}

export function summarizeIssues(issues: TraceIssue[]): Record<IssueType, number> {
  const summary: Record<IssueType, number> = {
    loop: 0,
    missing_observation: 0,
    suspicious_transition: 0,
    contradiction_candidate: 0,
    error_ignored: 0,
    empty_result: 0
  };
  
  for (const issue of issues) {
    summary[issue.type]++;
  }
  
  return summary;
}

export function analyzeTrace(trace: TraceRun): TraceRun {
  const nodes = trace.nodes;
  
  const allIssues: TraceIssue[] = [
    ...detectLoops(nodes),
    ...detectMissingObservations(nodes),
    ...detectErrorsIgnored(nodes),
    ...detectEmptyResults(nodes),
    ...detectContradictions(nodes),
    ...detectSuspiciousTransitions(nodes)
  ];
  
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
  
  const outputNodes = analyzedNodes.filter(n => n.type === 'output');
  const { level, explanation } = calculateRiskLevel(allIssues);
  
  for (const outputNode of outputNodes) {
    outputNode.riskLevel = level;
  }
  
  return {
    ...trace,
    nodes: analyzedNodes,
    issues: allIssues,
    riskLevel: level,
    riskExplanation: explanation,
    issueSummary: summarizeIssues(allIssues)
  };
}

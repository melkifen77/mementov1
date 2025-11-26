import { X, ChevronDown, ChevronUp, Copy, Check, AlertCircle, ExternalLink, GripVertical, AlertTriangle, Lightbulb, Info, Network, Clock, Zap, Cpu, Timer } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { TraceNode, TraceRun, TraceIssue, RiskLevel, NodeMetrics } from '@shared/models';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

/**
 * NodeInspector - Detailed view of a selected trace node
 * 
 * FEATURES:
 * ✅ Rich metadata display (type, id, parent, children, step info, agent/tool data)
 * ✅ Color-coded badges matching node types
 * ✅ Clickable parent/child navigation
 * ✅ Collapsible raw JSON viewer
 * ✅ Copy node JSON to clipboard
 * ✅ Error detection and highlighting
 * ✅ Resizable panel width (300px - 800px)
 * 
 * FUTURE ENHANCEMENTS:
 * 🔲 Keyboard navigation (Arrow keys, Enter, Escape)
 * 🔲 Multi-node selection and aggregated view
 * 🔲 Syntax highlighting for JSON viewer
 * 🔲 Expandable/collapsible nested JSON fields
 * 🔲 Auto-scroll to node in graph/timeline on navigation
 * 🔲 Node comparison view (diff between two nodes)
 */
interface NodeInspectorProps {
  node: TraceNode | null;
  trace: TraceRun | null;
  onClose: () => void;
  onNavigateToNode?: (nodeId: string) => void;
  isCompact?: boolean;
}

const nodeTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  thought: { 
    bg: 'hsl(var(--node-thought) / 0.15)', 
    text: 'hsl(var(--node-thought))', 
    border: 'hsl(var(--node-thought))' 
  },
  action: { 
    bg: 'hsl(var(--node-action) / 0.15)', 
    text: 'hsl(var(--node-action))', 
    border: 'hsl(var(--node-action))' 
  },
  output: { 
    bg: 'hsl(var(--node-output) / 0.15)', 
    text: 'hsl(var(--node-output))', 
    border: 'hsl(var(--node-output))' 
  },
  observation: { 
    bg: 'hsl(var(--node-observation) / 0.15)', 
    text: 'hsl(var(--node-observation))', 
    border: 'hsl(var(--node-observation))' 
  },
  system: { 
    bg: 'hsl(var(--node-system) / 0.15)', 
    text: 'hsl(var(--node-system))', 
    border: 'hsl(var(--node-system))' 
  },
  other: { 
    bg: 'hsl(var(--muted))', 
    text: 'hsl(var(--muted-foreground))', 
    border: 'hsl(var(--border))' 
  }
};

function TypeBadge({ type }: { type: string }) {
  const colors = nodeTypeColors[type] || nodeTypeColors.other;
  return (
    <Badge 
      variant="outline"
      style={{ 
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border
      }}
      data-testid={`badge-type-${type}`}
    >
      {type}
    </Badge>
  );
}

function MetadataField({ label, value, badge }: { label: string; value: string | number; badge?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        {badge && <TypeBadge type={badge} />}
      </div>
      <p className="mt-1 font-mono text-sm break-all" data-testid={`text-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        {value}
      </p>
    </div>
  );
}

function ClickableId({ 
  label, 
  id, 
  onNavigate 
}: { 
  label: string; 
  id: string; 
  onNavigate?: (id: string) => void 
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <button
        onClick={() => onNavigate?.(id)}
        className="mt-1 font-mono text-sm text-primary hover:underline flex items-center gap-1 hover-elevate active-elevate-2 px-2 py-1 rounded-md -ml-2"
        data-testid={`button-navigate-${label.toLowerCase()}`}
        disabled={!onNavigate}
      >
        {id}
        {onNavigate && <ExternalLink className="h-3 w-3" />}
      </button>
    </div>
  );
}

function JSONViewer({ data, maxHeight = '300px' }: { data: any; maxHeight?: string }) {
  const formatted = JSON.stringify(data, null, 2);
  
  return (
    <ScrollArea className="rounded-md border border-border" style={{ maxHeight }}>
      <pre className="p-3 text-xs font-mono bg-muted/50" data-testid="pre-json-viewer">
        {formatted}
      </pre>
    </ScrollArea>
  );
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} seconds`;
  }
  return `${Math.round(ms)} ms`;
}

export function NodeInspector({ node, trace, onClose, onNavigateToNode, isCompact = false }: NodeInspectorProps) {
  const [isRawJsonExpanded, setIsRawJsonExpanded] = useState(false);
  const [isRawMetadataExpanded, setIsRawMetadataExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedMetadata, setCopiedMetadata] = useState(false);
  const [panelWidth, setPanelWidth] = useState(384); // 96 * 4 = 384px (w-96)
  const [isResizing, setIsResizing] = useState(false);
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      // Min width 300px, max width 800px
      setPanelWidth(Math.max(300, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (!node) return null;

  // Extract metadata fields
  const metadata = node.metadata || {};
  const agentName = metadata.agent || metadata.agent_name || metadata.name;
  const toolName = metadata.tool || metadata.tool_name;
  const toolInput = metadata.tool_input || metadata.input;
  const stepNumber = metadata.step || metadata.step_number;
  const depth = metadata.depth || metadata.level;
  const parentStep = metadata.parent_step || metadata.parent_step_number;

  // Error detection
  const hasError = 
    metadata.error === true || 
    !!metadata.exception || 
    metadata.status === 'failed' ||
    metadata.status === 'error';

  // Find children
  const children = trace?.nodes.filter(n => n.parentId === node.id) || [];

  // Copy node JSON
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(node ?? {}, null, 2));
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Node JSON copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive"
      });
    }
  };

  // Copy metadata JSON
  const handleCopyMetadata = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(node.metadata ?? {}, null, 2));
      setCopiedMetadata(true);
      toast({
        title: "Copied!",
        description: "Metadata JSON copied to clipboard"
      });
      setTimeout(() => setCopiedMetadata(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const colors = nodeTypeColors[node.type] || nodeTypeColors.other;

  // Extract metrics
  const metrics = node.metrics || {};
  const hasMetricsError = metrics.hasError;
  const hasTiming = metrics.startTime !== undefined || metrics.endTime !== undefined || metrics.durationMs !== undefined;
  const hasTokenUsage = metrics.tokenUsage && (
    metrics.tokenUsage.prompt !== undefined || 
    metrics.tokenUsage.completion !== undefined || 
    metrics.tokenUsage.total !== undefined
  );

  if (isCompact) {
    return (
      <div className="h-full flex flex-col bg-background/95" data-testid="node-inspector-compact">
        <div className="flex items-center justify-between p-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <TypeBadge type={node.type} />
            <span className="text-xs font-mono text-muted-foreground truncate max-w-32">{node.id}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              data-testid="button-copy-json-compact"
              title="Copy node JSON"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
              data-testid="button-close-inspector-compact"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2 text-sm">
            <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words bg-muted/50 p-2 rounded-md max-h-32 overflow-auto">
              {node.content}
            </pre>
            
            {(hasError || hasMetricsError || metrics.isSlow || metrics.isTokenHeavy) && (
              <div className="flex flex-wrap items-center gap-1">
                {(hasError || hasMetricsError) && (
                  <Badge variant="destructive" className="text-xs py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                    Error
                  </Badge>
                )}
                {metrics.isSlow && (
                  <Badge variant="outline" className="text-xs py-0 px-1.5 border-yellow-500 text-yellow-600">
                    Slow
                  </Badge>
                )}
              </div>
            )}
            
            {node.confidence !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Confidence:</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${node.confidence * 100}%`,
                      backgroundColor: colors.border
                    }}
                  />
                </div>
                <span className="text-xs font-medium">{Math.round(node.confidence * 100)}%</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div 
      ref={panelRef}
      className="fixed right-0 top-0 h-screen bg-background/95 backdrop-blur-xl border-l border-border shadow-2xl z-50 animate-in slide-in-from-right duration-300"
      style={{ width: `${panelWidth}px` }}
    >
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary group"
        onMouseDown={() => setIsResizing(true)}
        data-testid="resize-handle"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-6 w-6 text-primary" />
        </div>
      </div>

      <div className="flex flex-col h-full ml-1">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Node Details</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleCopy}
              data-testid="button-copy-json"
              title="Copy node JSON"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              data-testid="button-close-inspector"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status Badges Section */}
        {(hasError || hasMetricsError || metrics.isSlow || metrics.isTokenHeavy) && (
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex flex-wrap items-center gap-2">
              {(hasError || hasMetricsError) && (
                <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-status-error">
                  <AlertCircle className="h-3 w-3" />
                  Error
                </Badge>
              )}
              {metrics.isSlow && (
                <Badge variant="outline" className="flex items-center gap-1 border-yellow-500 text-yellow-600 dark:text-yellow-400" data-testid="badge-status-slow">
                  <Timer className="h-3 w-3" />
                  Slow {metrics.durationMs !== undefined && `(${formatDuration(metrics.durationMs)})`}
                </Badge>
              )}
              {metrics.isTokenHeavy && (
                <Badge variant="outline" className="flex items-center gap-1 border-orange-500 text-orange-600 dark:text-orange-400" data-testid="badge-status-token-heavy">
                  <Zap className="h-3 w-3" />
                  Token Heavy
                </Badge>
              )}
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </label>
              <div className="mt-1">
                <TypeBadge type={node.type} />
              </div>
            </div>

            {/* ID */}
            <MetadataField label="ID" value={node.id} />

            <Separator />

            {/* Parent Node */}
            {node.parentId && (
              <>
                <ClickableId 
                  label="Parent Node" 
                  id={node.parentId} 
                  onNavigate={onNavigateToNode}
                />
                <Separator />
              </>
            )}

            {/* Children Nodes */}
            {children.length > 0 && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Children ({children.length})
                  </label>
                  <div className="mt-1 space-y-1">
                    {children.map(child => (
                      <button
                        key={child.id}
                        onClick={() => onNavigateToNode?.(child.id)}
                        className="w-full text-left font-mono text-sm text-primary hover:underline flex items-center gap-1 hover-elevate active-elevate-2 px-2 py-1 rounded-md"
                        data-testid={`button-navigate-child-${child.id}`}
                        disabled={!onNavigateToNode}
                      >
                        <TypeBadge type={child.type} />
                        <span className="flex-1 truncate">{child.id}</span>
                        {onNavigateToNode && <ExternalLink className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Content */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Content
              </label>
              <pre className="mt-1 text-sm leading-relaxed font-mono whitespace-pre-wrap break-words bg-muted/50 p-3 rounded-md" data-testid="text-node-content">
                {node.content}
              </pre>
            </div>

            {/* Step Info */}
            {(stepNumber !== undefined || depth !== undefined || parentStep !== undefined) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Step Info
                  </label>
                  {stepNumber !== undefined && (
                    <MetadataField label="Step Number" value={stepNumber} />
                  )}
                  {depth !== undefined && (
                    <MetadataField label="Depth" value={depth} />
                  )}
                  {parentStep !== undefined && (
                    <MetadataField label="Parent Step" value={parentStep} />
                  )}
                </div>
              </>
            )}

            {/* Agent & Tool Info */}
            {(agentName || toolName || toolInput) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Execution Info
                  </label>
                  {agentName && (
                    <MetadataField label="Agent" value={agentName} />
                  )}
                  {toolName && (
                    <MetadataField label="Tool" value={toolName} badge="action" />
                  )}
                  {toolInput && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Tool Input
                      </label>
                      <pre className="mt-1 text-xs font-mono whitespace-pre-wrap break-words bg-muted/50 p-2 rounded-md">
                        {typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Timestamp */}
            {node.timestamp && (
              <>
                <Separator />
                <MetadataField 
                  label="Timestamp" 
                  value={new Date(node.timestamp).toLocaleString()} 
                />
              </>
            )}

            {/* Confidence */}
            {node.confidence !== undefined && (
              <>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Confidence
                  </label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${node.confidence * 100}%`,
                            backgroundColor: colors.border
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium" data-testid="text-node-confidence">
                        {Math.round(node.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Order */}
            {node.order !== undefined && (
              <>
                <Separator />
                <MetadataField label="Order" value={node.order} />
              </>
            )}

            {/* Timing Section */}
            {hasTiming && (
              <>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Timing
                  </label>
                  <div className="mt-2 space-y-2 bg-muted/50 p-3 rounded-md">
                    {metrics.startTime !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Start Time:</span>
                        <span className="text-xs font-mono" data-testid="text-start-time">{formatTimestamp(metrics.startTime)}</span>
                      </div>
                    )}
                    {metrics.endTime !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">End Time:</span>
                        <span className="text-xs font-mono" data-testid="text-end-time">{formatTimestamp(metrics.endTime)}</span>
                      </div>
                    )}
                    {metrics.durationMs !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Duration:</span>
                        <span className={`text-xs font-mono font-semibold ${metrics.isSlow ? 'text-yellow-600 dark:text-yellow-400' : ''}`} data-testid="text-duration">
                          {formatDuration(metrics.durationMs)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Token Usage Section */}
            {hasTokenUsage && metrics.tokenUsage && (
              <>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Token Usage
                  </label>
                  <div className="mt-2 space-y-2 bg-muted/50 p-3 rounded-md">
                    {metrics.tokenUsage.prompt !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Prompt Tokens:</span>
                        <span className="text-xs font-mono" data-testid="text-prompt-tokens">{metrics.tokenUsage.prompt.toLocaleString()}</span>
                      </div>
                    )}
                    {metrics.tokenUsage.completion !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Completion Tokens:</span>
                        <span className="text-xs font-mono" data-testid="text-completion-tokens">{metrics.tokenUsage.completion.toLocaleString()}</span>
                      </div>
                    )}
                    {metrics.tokenUsage.total !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Total Tokens:</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-semibold ${metrics.isTokenHeavy ? 'text-orange-600 dark:text-orange-400' : ''}`} data-testid="text-total-tokens">
                            {metrics.tokenUsage.total.toLocaleString()}
                          </span>
                          {metrics.isTokenHeavy && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 dark:text-orange-400 py-0">
                              Heavy
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Model Info Section */}
            {metrics.modelName && (
              <>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    Model Info
                  </label>
                  <div className="mt-2">
                    <Badge variant="secondary" className="font-mono" data-testid="badge-model-name">
                      {metrics.modelName}
                    </Badge>
                  </div>
                </div>
              </>
            )}

            {/* Metrics Error Section */}
            {hasMetricsError && (
              <>
                <Separator />
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md" data-testid="section-metrics-error">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive mb-1">Metrics Error</p>
                      {metrics.errorMessage && (
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-destructive/80">
                          {metrics.errorMessage}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Error Info */}
            {hasError && (
              <>
                <Separator />
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive mb-1">Error Detected</p>
                      {metadata.exception && (
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                          {typeof metadata.exception === 'string' 
                            ? metadata.exception 
                            : JSON.stringify(metadata.exception, null, 2)}
                        </pre>
                      )}
                      {metadata.error && typeof metadata.error === 'string' && (
                        <p className="text-xs">{metadata.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Risk Level (for output nodes) */}
            {node.riskLevel && (
              <>
                <Separator />
                <div className={`p-3 rounded-md border ${
                  node.riskLevel === 'high' ? 'bg-destructive/10 border-destructive/20' :
                  node.riskLevel === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
                  'bg-green-500/10 border-green-500/20'
                }`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${
                      node.riskLevel === 'high' ? 'text-destructive' :
                      node.riskLevel === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`} />
                    <span className="text-sm font-medium">
                      Risk: {node.riskLevel.charAt(0).toUpperCase() + node.riskLevel.slice(1)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Issues on this node */}
            {node.issues && node.issues.length > 0 && (
              <>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Issues ({node.issues.length})
                  </label>
                  <div className="mt-2 space-y-2">
                    {node.issues.map((issue) => (
                      <div 
                        key={issue.id}
                        className={`p-3 rounded-md border ${
                          issue.severity === 'error' 
                            ? 'bg-destructive/10 border-destructive/20' 
                            : 'bg-yellow-500/10 border-yellow-500/20'
                        }`}
                        data-testid={`issue-${issue.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                            issue.severity === 'error' ? 'text-destructive' : 'text-yellow-500'
                          }`} />
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium">{issue.title}</p>
                            <p className="text-xs text-muted-foreground">{issue.description}</p>
                            <div className="flex items-start gap-1 mt-2 pt-2 border-t border-border/50">
                              <Lightbulb className="h-3 w-3 text-primary mt-0.5" />
                              <p className="text-xs text-primary">{issue.suggestion}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* LangGraph Details */}
            {node.langGraphDetails && Object.keys(node.langGraphDetails).length > 0 && (
              <>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Network className="h-3 w-3" />
                    LangGraph Details
                  </label>
                  <div className="mt-2 space-y-2 bg-muted/50 p-3 rounded-md">
                    {node.langGraphDetails.nodeName && (
                      <div>
                        <span className="text-xs text-muted-foreground">Node: </span>
                        <Badge variant="outline" className="text-xs">{node.langGraphDetails.nodeName}</Badge>
                      </div>
                    )}
                    {node.langGraphDetails.runId && (
                      <div>
                        <span className="text-xs text-muted-foreground">Run ID: </span>
                        <span className="text-xs font-mono">{node.langGraphDetails.runId}</span>
                      </div>
                    )}
                    {node.langGraphDetails.threadId && (
                      <div>
                        <span className="text-xs text-muted-foreground">Thread: </span>
                        <span className="text-xs font-mono">{node.langGraphDetails.threadId}</span>
                      </div>
                    )}
                    {node.langGraphDetails.edges && node.langGraphDetails.edges.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">Next: </span>
                        {node.langGraphDetails.edges.map((edge, i) => (
                          <Badge key={i} variant="secondary" className="text-xs mr-1">{edge}</Badge>
                        ))}
                      </div>
                    )}
                    {node.langGraphDetails.stateBefore && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">State (before):</span>
                        <pre className="text-xs font-mono bg-background p-2 rounded border overflow-x-auto">
                          {JSON.stringify(node.langGraphDetails.stateBefore, null, 2)}
                        </pre>
                      </div>
                    )}
                    {node.langGraphDetails.stateAfter && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">State (after):</span>
                        <pre className="text-xs font-mono bg-background p-2 rounded border overflow-x-auto">
                          {JSON.stringify(node.langGraphDetails.stateAfter, null, 2)}
                        </pre>
                      </div>
                    )}
                    {node.langGraphDetails.config && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Config:</span>
                        <pre className="text-xs font-mono bg-background p-2 rounded border overflow-x-auto">
                          {JSON.stringify(node.langGraphDetails.config, null, 2)}
                        </pre>
                      </div>
                    )}
                    {node.langGraphDetails.checkpoint && (
                      <div>
                        <span className="text-xs text-muted-foreground">Checkpoint: </span>
                        <span className="text-xs font-mono">
                          {typeof node.langGraphDetails.checkpoint === 'object' 
                            ? node.langGraphDetails.checkpoint.id || JSON.stringify(node.langGraphDetails.checkpoint)
                            : node.langGraphDetails.checkpoint}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Collapsible Raw Metadata Section */}
            {node.metadata && Object.keys(node.metadata).length > 0 && (
              <Collapsible open={isRawMetadataExpanded} onOpenChange={setIsRawMetadataExpanded}>
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <button
                      className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                      data-testid="button-toggle-raw-metadata"
                    >
                      {isRawMetadataExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      Raw Metadata
                    </button>
                  </CollapsibleTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyMetadata}
                    data-testid="button-copy-metadata"
                    title="Copy metadata JSON"
                    className="h-7 w-7"
                  >
                    {copiedMetadata ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <CollapsibleContent className="mt-2">
                  <ScrollArea className="rounded-md border border-border max-h-[300px]">
                    <pre className="p-3 text-xs font-mono bg-muted/50" data-testid="pre-raw-metadata">
                      {JSON.stringify(node.metadata, null, 2)}
                    </pre>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Separator />

            {/* Collapsible Raw JSON (Full Node) */}
            <Collapsible open={isRawJsonExpanded} onOpenChange={setIsRawJsonExpanded}>
              <CollapsibleTrigger asChild>
                <button
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  data-testid="button-toggle-raw-json"
                >
                  {isRawJsonExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Raw Node JSON
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <JSONViewer data={node} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

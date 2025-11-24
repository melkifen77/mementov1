import { X, ChevronDown, ChevronUp, Copy, Check, AlertCircle, ExternalLink, GripVertical } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { TraceNode, TraceRun } from '@shared/models';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  // Future: Add for multi-selection
  // selectedNodes?: TraceNode[];
  // onMultiSelect?: (nodes: TraceNode[]) => void;
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

export function NodeInspector({ node, trace, onClose, onNavigateToNode }: NodeInspectorProps) {
  const [isRawJsonExpanded, setIsRawJsonExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
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
      await navigator.clipboard.writeText(JSON.stringify(node, null, 2));
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

  const colors = nodeTypeColors[node.type] || nodeTypeColors.other;

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
            {hasError && (
              <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-error">
                <AlertCircle className="h-3 w-3" />
                Error
              </Badge>
            )}
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

            <Separator />

            {/* Raw JSON */}
            <div>
              <button
                onClick={() => setIsRawJsonExpanded(!isRawJsonExpanded)}
                className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                data-testid="button-toggle-raw-json"
              >
                Raw JSON
                {isRawJsonExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {isRawJsonExpanded && (
                <div className="mt-2">
                  <JSONViewer data={node} />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { TraceNode } from '@shared/models';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NodeInspectorProps {
  node: TraceNode | null;
  onClose: () => void;
}

export function NodeInspector({ node, onClose }: NodeInspectorProps) {
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

  if (!node) return null;

  const nodeTypeColors: Record<string, string> = {
    thought: 'hsl(var(--node-thought))',
    action: 'hsl(var(--node-action))',
    output: 'hsl(var(--node-output))',
    observation: 'hsl(var(--node-observation))',
    system: 'hsl(var(--node-system))',
    other: 'hsl(var(--node-other))'
  };

  const color = nodeTypeColors[node.type] || nodeTypeColors.other;

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-background/95 backdrop-blur-xl border-l border-border shadow-2xl z-50 animate-in slide-in-from-right duration-300">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Node Inspector</h2>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            data-testid="button-close-inspector"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </label>
              <div className="mt-2">
                <Badge 
                  variant="outline"
                  style={{ borderColor: color, color }}
                  data-testid="badge-node-type"
                >
                  {node.type}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                ID
              </label>
              <p className="mt-2 font-mono text-sm" data-testid="text-node-id">
                {node.id}
              </p>
            </div>

            <Separator />

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Content
              </label>
              <pre className="mt-2 text-sm leading-relaxed font-mono whitespace-pre-wrap break-words" data-testid="text-node-content">
                {node.content}
              </pre>
            </div>

            {node.timestamp && (
              <>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Timestamp
                  </label>
                  <p className="mt-2 text-sm" data-testid="text-node-timestamp">
                    {new Date(node.timestamp).toLocaleString()}
                  </p>
                </div>
              </>
            )}

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
                            backgroundColor: color
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

            {node.parentId && (
              <>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Parent Node
                  </label>
                  <p className="mt-2 font-mono text-sm" data-testid="text-node-parent">
                    {node.parentId}
                  </p>
                </div>
              </>
            )}

            <Separator />

            <div>
              <button
                onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                data-testid="button-toggle-metadata"
              >
                Raw Metadata
                {isMetadataExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {isMetadataExpanded && (
                <pre className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  {JSON.stringify(node.metadata, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

import { TraceRun, TraceNode } from '@shared/models';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, TrendingDown } from 'lucide-react';

interface TimelineViewProps {
  trace: TraceRun;
  onNodeClick: (node: TraceNode) => void;
}

const nodeColors: Record<string, { border: string; text: string }> = {
  thought: { border: 'hsl(var(--node-thought))', text: 'hsl(var(--node-thought))' },
  action: { border: 'hsl(var(--node-action))', text: 'hsl(var(--node-action))' },
  output: { border: 'hsl(var(--node-output))', text: 'hsl(var(--node-output))' },
  observation: { border: 'hsl(var(--node-observation))', text: 'hsl(var(--node-observation))' },
  system: { border: 'hsl(var(--node-system))', text: 'hsl(var(--node-system))' },
  other: { border: 'hsl(var(--node-other))', text: 'hsl(var(--node-other))' },
};

export function TimelineView({ trace, onNodeClick }: TimelineViewProps) {
  const sortedNodes = [...trace.nodes].sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return (a.order ?? 0) - (b.order ?? 0);
  });

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-8 space-y-6" data-testid="timeline-view">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Timeline View</h2>
          <p className="text-sm text-muted-foreground">
            Chronological sequence of {trace.nodes.length} reasoning steps
          </p>
        </div>

        <div className="space-y-4">
          {sortedNodes.map((node, index) => {
            const colors = nodeColors[node.type] || nodeColors.other;
            const hasLowConfidence = node.confidence !== undefined && node.confidence < 0.6;
            const hasError = node.metadata?.status === 'error';

            return (
              <div key={node.id} className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ 
                      backgroundColor: colors.border,
                      color: 'white'
                    }}
                  >
                    {index + 1}
                  </div>
                  {index < sortedNodes.length - 1 && (
                    <div 
                      className="w-0.5 flex-1 min-h-[60px]"
                      style={{ backgroundColor: colors.border }}
                    />
                  )}
                </div>

                <Card
                  className="flex-1 p-4 cursor-pointer hover-elevate active-elevate-2 transition-shadow"
                  style={{ borderLeftWidth: '4px', borderLeftColor: colors.border }}
                  onClick={() => onNodeClick(node)}
                  data-testid={`timeline-node-${node.id}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          style={{ borderColor: colors.border, color: colors.text }}
                        >
                          {node.type}
                        </Badge>
                        {hasLowConfidence && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Low confidence
                          </Badge>
                        )}
                        {hasError && (
                          <Badge variant="outline" className="text-destructive border-destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </div>
                      {node.timestamp && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(node.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    <pre className="text-sm leading-relaxed font-mono whitespace-pre-wrap break-words">
                      {node.content}
                    </pre>

                    {node.confidence !== undefined && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${node.confidence * 100}%`,
                              backgroundColor: colors.border,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {Math.round(node.confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}

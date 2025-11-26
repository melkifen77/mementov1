import { TraceRun, TraceNode } from '@shared/models';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, TrendingDown, Clock, AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion, Timer, Coins } from 'lucide-react';

interface TimelineViewProps {
  trace: TraceRun;
  onNodeClick: (node: TraceNode) => void;
  hoveredIndex?: number | null;
  pairedHoveredIndex?: number | null;
  onHoverIndexChange?: (index: number | null) => void;
}

const nodeColors: Record<string, { border: string; text: string }> = {
  thought: { border: 'hsl(var(--node-thought))', text: 'hsl(var(--node-thought))' },
  action: { border: 'hsl(var(--node-action))', text: 'hsl(var(--node-action))' },
  output: { border: 'hsl(var(--node-output))', text: 'hsl(var(--node-output))' },
  observation: { border: 'hsl(var(--node-observation))', text: 'hsl(var(--node-observation))' },
  system: { border: 'hsl(var(--node-system))', text: 'hsl(var(--node-system))' },
  other: { border: 'hsl(var(--node-other))', text: 'hsl(var(--node-other))' },
};

export function TimelineView({ trace, onNodeClick, hoveredIndex, pairedHoveredIndex, onHoverIndexChange }: TimelineViewProps) {
  const sortedNodes = [...trace.nodes].sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return (a.order ?? 0) - (b.order ?? 0);
  });

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-8 max-w-5xl mx-auto space-y-6" data-testid="timeline-view">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">Timeline View</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Chronological sequence of {trace.nodes.length} reasoning steps
          </p>
        </div>

        <div className="space-y-5">
          {sortedNodes.map((node, index) => {
            const colors = nodeColors[node.type] || nodeColors.other;
            const hasLowConfidence = node.confidence !== undefined && node.confidence < 0.6;
            const hasError = node.metadata?.error === true || 
                           !!node.metadata?.exception || 
                           node.metadata?.status === 'failed' ||
                           node.metadata?.status === 'error';
            const issueCount = node.issues?.length || 0;
            const hasIssues = issueCount > 0;
            const riskLevel = node.riskLevel;

            const metricsHasError = node.metrics?.hasError;
            const metricsIsSlow = node.metrics?.isSlow;
            const metricsIsTokenHeavy = node.metrics?.isTokenHeavy;
            const metricsDurationMs = node.metrics?.durationMs;
            
            // Check for specific issue types
            const hasSuspiciousTransition = node.issues?.some(i => i.type === 'suspicious_transition');
            const hasLoop = node.issues?.some(i => i.type === 'loop');

            const isPairedHighlight = pairedHoveredIndex === index;
            const isHovered = hoveredIndex === index;

            return (
              <div 
                key={node.id} 
                className="flex gap-4 group"
                onMouseEnter={() => onHoverIndexChange?.(index)}
                onMouseLeave={() => onHoverIndexChange?.(null)}
                data-testid={`timeline-item-${index}`}
              >
                <div className="flex flex-col items-center">
                  <div 
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shadow-md transition-all duration-200 ${
                      isPairedHighlight ? 'ring-2 ring-primary ring-offset-2 scale-110' : ''
                    }`}
                    style={{ 
                      backgroundColor: colors.border,
                      color: 'white'
                    }}
                  >
                    {index + 1}
                  </div>
                  {index < sortedNodes.length - 1 && (
                    <div 
                      className="w-0.5 flex-1 min-h-[80px] mt-1"
                      style={{ backgroundColor: colors.border, opacity: 0.3 }}
                    />
                  )}
                </div>

                <Card
                  className={`flex-1 p-5 cursor-pointer hover-elevate active-elevate-2 transition-all duration-200 ${
                    isPairedHighlight ? 'ring-2 ring-primary/50 shadow-lg' : ''
                  }`}
                  style={{ borderLeftWidth: '4px', borderLeftColor: colors.border }}
                  onClick={() => onNodeClick(node)}
                  data-testid={`timeline-node-${node.id}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="font-medium"
                          style={{ borderColor: colors.border, color: colors.text }}
                        >
                          {node.type}
                        </Badge>
                        {hasSuspiciousTransition && (
                          <Badge 
                            className="bg-yellow-500 text-black border-transparent dark:bg-yellow-600 dark:text-black"
                            data-testid={`badge-suspicious-${node.id}`}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Suspicious Transition
                          </Badge>
                        )}
                        {hasLoop && (
                          <Badge 
                            className="bg-orange-500 text-white border-transparent dark:bg-orange-600"
                            data-testid={`badge-loop-${node.id}`}
                          >
                            Loop Detected
                          </Badge>
                        )}
                        {hasIssues && !hasSuspiciousTransition && !hasLoop && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {issueCount} issue{issueCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {riskLevel && (
                          <Badge 
                            variant="outline" 
                            className={
                              riskLevel === 'high' ? 'text-destructive border-destructive' :
                              riskLevel === 'medium' ? 'text-yellow-600 border-yellow-600' :
                              'text-green-600 border-green-600'
                            }
                          >
                            {riskLevel === 'high' ? <ShieldAlert className="h-3 w-3 mr-1" /> :
                             riskLevel === 'medium' ? <ShieldQuestion className="h-3 w-3 mr-1" /> :
                             <ShieldCheck className="h-3 w-3 mr-1" />}
                            Risk: {riskLevel}
                          </Badge>
                        )}
                        {hasLowConfidence && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Low confidence
                          </Badge>
                        )}
                        {hasError && (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                        {metricsHasError && !hasError && (
                          <Badge variant="destructive" data-testid={`badge-metrics-error-${node.id}`}>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                        {metricsIsSlow && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600" data-testid={`badge-slow-${node.id}`}>
                            <Timer className="h-3 w-3 mr-1" />
                            Slow{metricsDurationMs ? ` (${(metricsDurationMs / 1000).toFixed(1)}s)` : ''}
                          </Badge>
                        )}
                        {metricsIsTokenHeavy && (
                          <Badge variant="outline" className="text-purple-600 border-purple-600" data-testid={`badge-token-heavy-${node.id}`}>
                            <Coins className="h-3 w-3 mr-1" />
                            Heavy tokens
                          </Badge>
                        )}
                      </div>
                      {node.timestamp && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(node.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    <pre className="text-sm leading-relaxed font-mono whitespace-pre-wrap break-words bg-muted/30 p-3 rounded-md">
                      {node.content}
                    </pre>

                    {node.confidence !== undefined && (
                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${node.confidence * 100}%`,
                              backgroundColor: colors.border,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium min-w-[3rem] text-right">
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

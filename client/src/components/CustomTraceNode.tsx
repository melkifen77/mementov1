import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TraceNode } from '@shared/models';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingDown, AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';

interface CustomTraceNodeProps {
  data: TraceNode & { onNodeClick?: (node: TraceNode) => void };
}

const nodeColors = {
  thought: {
    bg: 'hsl(var(--node-thought-bg))',
    border: 'hsl(var(--node-thought))',
    text: 'hsl(var(--node-thought))'
  },
  action: {
    bg: 'hsl(var(--node-action-bg))',
    border: 'hsl(var(--node-action))',
    text: 'hsl(var(--node-action))'
  },
  output: {
    bg: 'hsl(var(--node-output-bg))',
    border: 'hsl(var(--node-output))',
    text: 'hsl(var(--node-output))'
  },
  observation: {
    bg: 'hsl(var(--node-observation-bg))',
    border: 'hsl(var(--node-observation))',
    text: 'hsl(var(--node-observation))'
  },
  system: {
    bg: 'hsl(var(--node-system-bg))',
    border: 'hsl(var(--node-system))',
    text: 'hsl(var(--node-system))'
  },
  other: {
    bg: 'hsl(var(--node-other-bg))',
    border: 'hsl(var(--node-other))',
    text: 'hsl(var(--node-other))'
  }
};

function CustomTraceNodeComponent({ data }: CustomTraceNodeProps) {
  const colors = nodeColors[data.type] || nodeColors.other;
  const hasLowConfidence = data.confidence !== undefined && data.confidence < 0.6;
  const hasError = data.metadata?.error === true || 
                   !!data.metadata?.exception || 
                   data.metadata?.status === 'failed' ||
                   data.metadata?.status === 'error';
  const issueCount = data.issues?.length || 0;
  const hasIssues = issueCount > 0;
  const riskLevel = data.riskLevel;

  return (
    <div
      onClick={() => data.onNodeClick?.(data)}
      className="rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer min-w-[220px] max-w-[300px] hover:scale-[1.02]"
      style={{
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        boxShadow: hasError 
          ? '0 10px 15px -3px rgba(239, 68, 68, 0.3), 0 4px 6px -4px rgba(239, 68, 68, 0.3)'
          : undefined
      }}
      data-testid={`node-${data.id}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-border !w-3 !h-3" />
      
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Badge 
            variant="outline" 
            className="text-xs font-medium"
            style={{ color: colors.text, borderColor: colors.border }}
          >
            {data.type}
          </Badge>
          <div className="flex items-center gap-1">
            {hasIssues && (
              <div className="flex items-center gap-0.5 text-yellow-600" title={`${issueCount} issue${issueCount !== 1 ? 's' : ''}`}>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{issueCount}</span>
              </div>
            )}
            {riskLevel && (
              <div className={`flex items-center gap-0.5 ${
                riskLevel === 'high' ? 'text-destructive' :
                riskLevel === 'medium' ? 'text-yellow-600' :
                'text-green-600'
              }`} title={`Risk: ${riskLevel}`}>
                {riskLevel === 'high' ? <ShieldAlert className="h-3.5 w-3.5" /> :
                 riskLevel === 'medium' ? <ShieldQuestion className="h-3.5 w-3.5" /> :
                 <ShieldCheck className="h-3.5 w-3.5" />}
              </div>
            )}
            {hasLowConfidence && (
              <div className="flex items-center gap-0.5 text-yellow-600" title="Low confidence">
                <TrendingDown className="h-3.5 w-3.5" />
              </div>
            )}
            {hasError && (
              <div className="flex items-center gap-0.5 text-destructive" title="Error detected">
                <AlertCircle className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        </div>
        
        <pre className="text-xs line-clamp-4 text-card-foreground font-mono whitespace-pre-wrap break-words overflow-hidden leading-relaxed">
          {data.content}
        </pre>
        
        {data.confidence !== undefined && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${data.confidence * 100}%`,
                  backgroundColor: colors.border
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {Math.round(data.confidence * 100)}%
            </span>
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} className="!bg-border !w-3 !h-3" />
    </div>
  );
}

export const CustomTraceNode = memo(CustomTraceNodeComponent);

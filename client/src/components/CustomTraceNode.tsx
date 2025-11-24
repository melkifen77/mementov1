import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TraceNode } from '@shared/models';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingDown } from 'lucide-react';

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
  const hasError = data.metadata?.status === 'error';

  return (
    <div
      onClick={() => data.onNodeClick?.(data)}
      className="rounded-md shadow-md hover:shadow-lg transition-shadow cursor-pointer min-w-[200px] max-w-[300px]"
      style={{
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`
      }}
      data-testid={`node-${data.id}`}
    >
      <Handle type="target" position={Position.Left} />
      
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Badge 
            variant="outline" 
            className="text-xs"
            style={{ color: colors.text, borderColor: colors.border }}
          >
            {data.type}
          </Badge>
          <div className="flex items-center gap-1">
            {hasLowConfidence && (
              <TrendingDown className="h-3 w-3 text-yellow-600" />
            )}
            {hasError && (
              <AlertCircle className="h-3 w-3 text-destructive" />
            )}
          </div>
        </div>
        
        <pre className="text-xs line-clamp-4 text-card-foreground font-mono whitespace-pre-wrap break-words overflow-hidden">
          {data.content}
        </pre>
        
        {data.confidence !== undefined && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${data.confidence * 100}%`,
                  backgroundColor: colors.border
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {Math.round(data.confidence * 100)}%
            </span>
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const CustomTraceNode = memo(CustomTraceNodeComponent);

import { useState, useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { TraceRun, TraceNode, FieldMapping } from '@shared/models';
import { GenericAdapter } from '@shared/adapters/generic';
import { analyzeTrace } from '@shared/analysis/trace-analyzer';
import { UploadZone } from '@/components/UploadZone';
import { TraceGraph } from '@/components/TraceGraph';
import { TimelineView } from '@/components/TimelineView';
import { NodeInspector } from '@/components/NodeInspector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ComparePanelProps {
  label: string;
  trace: TraceRun | null;
  selectedNode: TraceNode | null;
  viewMode: 'graph' | 'timeline';
  hoveredIndex: number | null;
  pairedHoveredIndex: number | null;
  onUpload: (jsonData: any, mapping?: FieldMapping) => void;
  onNodeSelect: (node: TraceNode | null) => void;
  onHoverIndexChange: (index: number | null) => void;
  onClearTrace: () => void;
  graphRef?: React.RefObject<HTMLDivElement>;
}

function ComparePanel({
  label,
  trace,
  selectedNode,
  viewMode,
  hoveredIndex,
  pairedHoveredIndex,
  onUpload,
  onNodeSelect,
  onHoverIndexChange,
  onClearTrace,
  graphRef,
}: ComparePanelProps) {
  const handleNavigateToNode = useCallback((nodeId: string) => {
    const targetNode = trace?.nodes.find(n => n.id === nodeId);
    if (targetNode) {
      onNodeSelect(targetNode);
    }
  }, [trace, onNodeSelect]);

  const getHighlightedNodeId = () => {
    if (pairedHoveredIndex !== null && trace && trace.nodes[pairedHoveredIndex]) {
      return trace.nodes[pairedHoveredIndex].id;
    }
    return undefined;
  };

  return (
    <div className="flex flex-col h-full border-r border-border last:border-r-0" data-testid={`compare-panel-${label.toLowerCase().replace(' ', '-')}`}>
      <div className="h-10 border-b border-border bg-muted/30 flex items-center justify-between px-3 shrink-0">
        <Badge variant="outline" className="font-medium" data-testid={`label-${label.toLowerCase().replace(' ', '-')}`}>
          {label}
        </Badge>
        {trace && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {trace.nodes.length} nodes
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClearTrace}
              data-testid={`button-clear-${label.toLowerCase().replace(' ', '-')}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex-1 relative overflow-hidden">
        {!trace ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              <UploadZone onUpload={onUpload} />
            </div>
          </div>
        ) : (
          <div ref={graphRef} className="h-full w-full">
            {viewMode === 'graph' ? (
              <ReactFlowProvider>
                <TraceGraph 
                  trace={trace} 
                  onNodeClick={onNodeSelect}
                  highlightNodeId={getHighlightedNodeId()}
                  hoveredIndex={hoveredIndex}
                  onHoverIndexChange={onHoverIndexChange}
                />
              </ReactFlowProvider>
            ) : (
              <TimelineView 
                trace={trace} 
                onNodeClick={onNodeSelect}
                hoveredIndex={hoveredIndex}
                pairedHoveredIndex={pairedHoveredIndex}
                onHoverIndexChange={onHoverIndexChange}
              />
            )}
          </div>
        )}
      </div>

      {selectedNode && (
        <div className="absolute bottom-0 left-0 right-0 h-64 border-t border-border bg-background/95 backdrop-blur-xl overflow-hidden z-20">
          <div className="h-full overflow-auto">
            <NodeInspector 
              node={selectedNode} 
              trace={trace}
              onClose={() => onNodeSelect(null)} 
              onNavigateToNode={handleNavigateToNode}
              isCompact
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface CompareViewProps {
  viewMode: 'graph' | 'timeline';
}

export function CompareView({ viewMode }: CompareViewProps) {
  const [traceA, setTraceA] = useState<TraceRun | null>(null);
  const [traceB, setTraceB] = useState<TraceRun | null>(null);
  const [selectedNodeA, setSelectedNodeA] = useState<TraceNode | null>(null);
  const [selectedNodeB, setSelectedNodeB] = useState<TraceNode | null>(null);
  const [hoveredIndexA, setHoveredIndexA] = useState<number | null>(null);
  const [hoveredIndexB, setHoveredIndexB] = useState<number | null>(null);
  
  const graphRefA = useRef<HTMLDivElement>(null);
  const graphRefB = useRef<HTMLDivElement>(null);
  
  const adapter = new GenericAdapter();

  const handleUploadA = useCallback((jsonData: any, mapping?: FieldMapping) => {
    const normalized = adapter.normalize(jsonData, mapping);
    const analyzed = analyzeTrace(normalized);
    setTraceA(analyzed);
    setSelectedNodeA(null);
  }, []);

  const handleUploadB = useCallback((jsonData: any, mapping?: FieldMapping) => {
    const normalized = adapter.normalize(jsonData, mapping);
    const analyzed = analyzeTrace(normalized);
    setTraceB(analyzed);
    setSelectedNodeB(null);
  }, []);

  const handleClearA = useCallback(() => {
    setTraceA(null);
    setSelectedNodeA(null);
    setHoveredIndexA(null);
  }, []);

  const handleClearB = useCallback(() => {
    setTraceB(null);
    setSelectedNodeB(null);
    setHoveredIndexB(null);
  }, []);

  return (
    <div className="flex h-full w-full" data-testid="compare-view">
      <div className="flex-1 relative">
        <ComparePanel
          label="Trace A"
          trace={traceA}
          selectedNode={selectedNodeA}
          viewMode={viewMode}
          hoveredIndex={hoveredIndexA}
          pairedHoveredIndex={hoveredIndexB}
          onUpload={handleUploadA}
          onNodeSelect={setSelectedNodeA}
          onHoverIndexChange={setHoveredIndexA}
          onClearTrace={handleClearA}
          graphRef={graphRefA}
        />
      </div>
      
      <div className="w-px bg-border" />
      
      <div className="flex-1 relative">
        <ComparePanel
          label="Trace B"
          trace={traceB}
          selectedNode={selectedNodeB}
          viewMode={viewMode}
          hoveredIndex={hoveredIndexB}
          pairedHoveredIndex={hoveredIndexA}
          onUpload={handleUploadB}
          onNodeSelect={setSelectedNodeB}
          onHoverIndexChange={setHoveredIndexB}
          onClearTrace={handleClearB}
          graphRef={graphRefB}
        />
      </div>
    </div>
  );
}

import { useState, useRef, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Network, List, RotateCcw, GitCompare } from 'lucide-react';
import { TraceRun, TraceNode, FieldMapping } from '@shared/models';
import { GenericAdapter } from '@shared/adapters/generic';
import { analyzeTrace } from '@shared/analysis/trace-analyzer';
import { UploadZone } from '@/components/UploadZone';
import { TraceGraph } from '@/components/TraceGraph';
import { TimelineView } from '@/components/TimelineView';
import { NodeInspector } from '@/components/NodeInspector';
import { ExportDialog } from '@/components/ExportDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { IssueSummary } from '@/components/IssueSummary';
import { ReplayController } from '@/components/ReplayController';
import { CompareView } from '@/components/CompareView';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const [trace, setTrace] = useState<TraceRun | null>(null);
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('graph');
  const [showIssueSummary, setShowIssueSummary] = useState(true);
  const [replayMode, setReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);

  const adapter = new GenericAdapter();

  const handleUpload = (jsonData: any, mapping?: FieldMapping) => {
    const normalized = adapter.normalize(jsonData, mapping);
    const analyzed = analyzeTrace(normalized);
    setTrace(analyzed);
    setSelectedNode(null);
    setShowIssueSummary(true);
  };

  const handleReset = () => {
    setTrace(null);
    setSelectedNode(null);
    setReplayMode(false);
    setReplayIndex(0);
    setCompareMode(false);
  };

  const handleReplayNodeSelect = useCallback((node: TraceNode) => {
    setSelectedNode(node);
  }, []);

  const toggleReplayMode = () => {
    setReplayMode(prev => !prev);
    if (!replayMode) {
      setReplayIndex(0);
      if (trace && trace.nodes.length > 0) {
        setSelectedNode(trace.nodes[0]);
      }
    }
  };

  const toggleCompareMode = () => {
    setCompareMode(prev => !prev);
    if (!compareMode) {
      setReplayMode(false);
    }
  };

  const handleNavigateToNode = (nodeId: string) => {
    const targetNode = trace?.nodes.find(n => n.id === nodeId);
    if (targetNode) {
      setSelectedNode(targetNode);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="h-16 border-b border-border bg-background/95 backdrop-blur-xl flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Memento</h1>
          </div>
          {trace && !compareMode && (
            <div className="flex items-center gap-1 ml-4 text-sm text-muted-foreground">
              <span className="font-mono">{trace.nodes.length}</span>
              <span>nodes</span>
            </div>
          )}
          {compareMode && (
            <div className="flex items-center gap-1 ml-4 text-sm text-muted-foreground">
              <span>Compare Mode</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(trace || compareMode) && (
            <>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'graph' | 'timeline')}>
                <TabsList>
                  <TabsTrigger value="graph" data-testid="tab-graph">
                    <Network className="h-4 w-4 mr-2" />
                    Graph
                  </TabsTrigger>
                  <TabsTrigger value="timeline" data-testid="tab-timeline">
                    <List className="h-4 w-4 mr-2" />
                    Timeline
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Button
                variant={compareMode ? "default" : "outline"}
                onClick={toggleCompareMode}
                data-testid="button-compare-toggle"
                className="toggle-elevate"
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Compare
              </Button>
              
              {!compareMode && (
                <Button
                  variant={replayMode ? "default" : "outline"}
                  onClick={toggleReplayMode}
                  data-testid="button-replay-toggle"
                  className="toggle-elevate"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Replay
                </Button>
              )}
              
              {!compareMode && <ExportDialog elementRef={graphRef} />}
              
              <Button 
                variant="outline" 
                onClick={handleReset}
                data-testid="button-reset"
              >
                New Trace
              </Button>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {compareMode ? (
          <CompareView viewMode={viewMode} />
        ) : !trace ? (
          <UploadZone onUpload={handleUpload} />
        ) : (
          <>
            {replayMode && (
              <ReplayController
                nodes={trace.nodes}
                currentIndex={replayIndex}
                onIndexChange={setReplayIndex}
                onNodeSelect={handleReplayNodeSelect}
              />
            )}
            <div ref={graphRef} className="flex-1 w-full">
              {viewMode === 'graph' ? (
                <ReactFlowProvider>
                  <TraceGraph 
                    trace={trace} 
                    onNodeClick={setSelectedNode}
                    highlightNodeId={replayMode ? trace.nodes[replayIndex]?.id : undefined}
                  />
                </ReactFlowProvider>
              ) : (
                <TimelineView trace={trace} onNodeClick={setSelectedNode} />
              )}
            </div>
          </>
        )}

        {trace && showIssueSummary && !compareMode && (
          <div className="absolute top-4 right-4 w-72 z-30">
            <IssueSummary 
              trace={trace} 
              onClose={() => setShowIssueSummary(false)}
            />
          </div>
        )}

        {selectedNode && !compareMode && (
          <NodeInspector 
            node={selectedNode} 
            trace={trace}
            onClose={() => setSelectedNode(null)} 
            onNavigateToNode={handleNavigateToNode}
          />
        )}
      </main>
    </div>
  );
}

import { useState, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Network, List } from 'lucide-react';
import { TraceRun, TraceNode, FieldMapping } from '@shared/models';
import { GenericAdapter } from '@shared/adapters/generic';
import { UploadZone } from '@/components/UploadZone';
import { TraceGraph } from '@/components/TraceGraph';
import { TimelineView } from '@/components/TimelineView';
import { NodeInspector } from '@/components/NodeInspector';
import { ExportDialog } from '@/components/ExportDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const [trace, setTrace] = useState<TraceRun | null>(null);
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('graph');
  const graphRef = useRef<HTMLDivElement>(null);

  const adapter = new GenericAdapter();

  const handleUpload = (jsonData: any, mapping?: FieldMapping) => {
    const normalized = adapter.normalize(jsonData, mapping);
    setTrace(normalized);
    setSelectedNode(null);
  };

  const handleReset = () => {
    setTrace(null);
    setSelectedNode(null);
  };

  const handleNavigateToNode = (nodeId: string) => {
    const targetNode = trace?.nodes.find(n => n.id === nodeId);
    if (targetNode) {
      setSelectedNode(targetNode);
      // TODO: Scroll to node in graph/timeline view
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
          {trace && (
            <div className="flex items-center gap-1 ml-4 text-sm text-muted-foreground">
              <span className="font-mono">{trace.nodes.length}</span>
              <span>nodes</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {trace && (
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
              
              <ExportDialog elementRef={graphRef} />
              
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

      <main className="flex-1 overflow-hidden relative">
        {!trace ? (
          <UploadZone onUpload={handleUpload} />
        ) : (
          <div ref={graphRef} className="h-full w-full">
            {viewMode === 'graph' ? (
              <ReactFlowProvider>
                <TraceGraph trace={trace} onNodeClick={setSelectedNode} />
              </ReactFlowProvider>
            ) : (
              <TimelineView trace={trace} onNodeClick={setSelectedNode} />
            )}
          </div>
        )}

        {selectedNode && (
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

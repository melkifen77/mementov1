import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TraceRun, TraceNode } from '@shared/models';
import { CustomTraceNode } from './CustomTraceNode';

interface TraceGraphProps {
  trace: TraceRun;
  onNodeClick: (node: TraceNode) => void;
}

const nodeTypes = {
  traceNode: CustomTraceNode,
};

export function TraceGraph({ trace, onNodeClick }: TraceGraphProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = trace.nodes.map((node, index) => {
      const hasParent = node.parentId && trace.nodes.some(n => n.id === node.parentId);
      
      let xPosition = index * 350;
      let yPosition = 100;
      
      if (hasParent) {
        const parentIndex = trace.nodes.findIndex(n => n.id === node.parentId);
        const childrenOfParent = trace.nodes.filter(n => n.parentId === node.parentId);
        const childIndex = childrenOfParent.findIndex(n => n.id === node.id);
        
        xPosition = (parentIndex + 1) * 350;
        yPosition = 100 + (childIndex * 150);
      }

      return {
        id: node.id,
        type: 'traceNode',
        position: { x: xPosition, y: yPosition },
        data: { ...node, onNodeClick },
      };
    });

    const edges: Edge[] = [];
    const edgeSet = new Set<string>();
    
    trace.nodes.forEach((node) => {
      if (node.parentId) {
        const edgeId = `${node.parentId}-${node.id}`;
        if (!edgeSet.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: node.parentId,
            target: node.id,
            type: ConnectionLineType.SmoothStep,
            animated: false,
          });
          edgeSet.add(edgeId);
        }
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [trace, onNodeClick]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const proOptions = { hideAttribution: true };

  return (
    <div className="w-full h-full" data-testid="graph-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        proOptions={proOptions}
      >
        <Background />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const data = node.data as any;
            const nodeType = data?.type || 'other';
            const colors: Record<string, string> = {
              thought: 'hsl(217, 91%, 60%)',
              action: 'hsl(24, 90%, 58%)',
              output: 'hsl(271, 91%, 65%)',
              observation: 'hsl(142, 76%, 45%)',
              system: 'hsl(240, 6%, 60%)',
              other: 'hsl(240, 6%, 50%)'
            };
            return colors[nodeType] || colors.other;
          }}
        />
      </ReactFlow>
    </div>
  );
}

import { TraceGraph } from '../TraceGraph';
import { ReactFlowProvider } from '@xyflow/react';

export default function TraceGraphExample() {
  const sampleTrace = {
    id: 'run-1',
    source: 'example',
    nodes: [
      {
        id: '1',
        type: 'thought' as const,
        content: 'User wants to build a login system',
        confidence: 0.9,
        order: 0,
      },
      {
        id: '2',
        type: 'action' as const,
        content: 'Search for authentication best practices',
        confidence: 0.85,
        parentId: '1',
        order: 1,
      },
      {
        id: '3',
        type: 'observation' as const,
        content: 'Found OAuth 2.0 and JWT patterns',
        confidence: 0.95,
        parentId: '2',
        order: 2,
      },
      {
        id: '4',
        type: 'thought' as const,
        content: 'JWT seems appropriate for this use case',
        confidence: 0.88,
        parentId: '3',
        order: 3,
      },
      {
        id: '5',
        type: 'output' as const,
        content: 'Recommend implementing JWT-based authentication',
        confidence: 0.92,
        parentId: '4',
        order: 4,
      },
    ],
  };

  return (
    <ReactFlowProvider>
      <div className="h-[600px] w-full border rounded-lg">
        <TraceGraph 
          trace={sampleTrace} 
          onNodeClick={(node) => console.log('Clicked:', node)} 
        />
      </div>
    </ReactFlowProvider>
  );
}

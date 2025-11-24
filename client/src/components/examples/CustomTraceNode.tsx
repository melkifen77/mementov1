import { CustomTraceNode } from '../CustomTraceNode';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export default function CustomTraceNodeExample() {
  const sampleNode = {
    id: '1',
    type: 'thought' as const,
    content: 'Analyzing the user request to determine the best approach...',
    confidence: 0.85,
    timestamp: Date.now(),
    metadata: {}
  };

  return (
    <ReactFlowProvider>
      <div className="p-8">
        <CustomTraceNode data={sampleNode} />
      </div>
    </ReactFlowProvider>
  );
}

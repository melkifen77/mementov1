import { NodeInspector } from '../NodeInspector';

export default function NodeInspectorExample() {
  const sampleNode = {
    id: 'step-1',
    type: 'thought' as const,
    content: 'Analyzing the user request to determine the best approach for solving this problem. Need to consider multiple factors including performance, scalability, and maintainability.',
    timestamp: Date.now(),
    confidence: 0.87,
    parentId: null,
    order: 0,
    metadata: {
      model: 'gpt-4',
      tokens: 150,
      temperature: 0.7
    }
  };

  return (
    <NodeInspector 
      node={sampleNode} 
      onClose={() => console.log('Close inspector')} 
    />
  );
}

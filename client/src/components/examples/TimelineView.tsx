import { TimelineView } from '../TimelineView';

export default function TimelineViewExample() {
  const sampleTrace = {
    id: 'run-1',
    source: 'example',
    nodes: [
      {
        id: '1',
        type: 'thought' as const,
        content: 'Analyzing user request to create a dashboard',
        confidence: 0.92,
        timestamp: Date.now() - 5000,
        order: 0,
        metadata: {}
      },
      {
        id: '2',
        type: 'action' as const,
        content: 'Fetching relevant chart libraries and components',
        confidence: 0.88,
        timestamp: Date.now() - 4000,
        order: 1,
        metadata: {}
      },
      {
        id: '3',
        type: 'observation' as const,
        content: 'Found Recharts, Chart.js, and D3.js as popular options',
        confidence: 0.95,
        timestamp: Date.now() - 3000,
        order: 2,
        metadata: {}
      },
      {
        id: '4',
        type: 'thought' as const,
        content: 'Recharts integrates well with React and has good TypeScript support',
        confidence: 0.55,
        timestamp: Date.now() - 2000,
        order: 3,
        metadata: {}
      },
      {
        id: '5',
        type: 'output' as const,
        content: 'Recommend using Recharts for the dashboard visualization',
        confidence: 0.91,
        timestamp: Date.now() - 1000,
        order: 4,
        metadata: {}
      },
    ],
  };

  return (
    <div className="h-[600px] w-full">
      <TimelineView 
        trace={sampleTrace} 
        onNodeClick={(node) => console.log('Clicked:', node)} 
      />
    </div>
  );
}

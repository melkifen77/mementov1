import { ExportDialog } from '../ExportDialog';
import { useRef } from 'react';

export default function ExportDialogExample() {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="p-8">
      <div ref={ref} className="p-8 border rounded-lg bg-card mb-4">
        <h2 className="text-xl font-semibold">Sample Visualization</h2>
        <p className="text-muted-foreground">This is what will be exported</p>
      </div>
      <ExportDialog elementRef={ref} />
    </div>
  );
}

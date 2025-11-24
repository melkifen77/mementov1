import { useState } from 'react';
import { Upload, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface UploadZoneProps {
  onUpload: (jsonData: any) => void;
}

export function UploadZone({ onUpload }: UploadZoneProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleVisualize = () => {
    if (!jsonInput.trim()) {
      toast({
        title: "No JSON provided",
        description: "Please paste your JSON trace data",
        variant: "destructive"
      });
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      onUpload(parsed);
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your JSON syntax and try again",
        variant: "destructive"
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setJsonInput(text);
        try {
          const parsed = JSON.parse(text);
          onUpload(parsed);
        } catch (error) {
          toast({
            title: "Invalid JSON file",
            description: "The file contains invalid JSON",
            variant: "destructive"
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setJsonInput(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] px-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Agent Trace Visualizer</h1>
          <p className="text-muted-foreground text-lg">
            Upload or paste your JSON trace to visualize the reasoning flow
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          data-testid="dropzone-upload"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Upload className="h-8 w-8" />
              <FileJson className="h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Drop JSON file here or</p>
              <label htmlFor="file-upload" className="text-primary hover:underline cursor-pointer font-medium text-sm">
                browse files
                <input
                  id="file-upload"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="input-file-upload"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label htmlFor="json-input" className="text-sm font-medium">
            Or paste JSON directly
          </label>
          <Textarea
            id="json-input"
            placeholder='{"steps": [{"id": "1", "type": "thought", "content": "..."}]}'
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="font-mono text-sm min-h-[200px] resize-y"
            data-testid="textarea-json-input"
          />
          <Button
            onClick={handleVisualize}
            className="w-full"
            size="lg"
            data-testid="button-visualize"
          >
            Visualize Trace
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Upload, FileJson, Sparkles } from 'lucide-react';
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
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a JSON file",
        variant: "destructive"
      });
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
    <div className="flex flex-col items-center justify-center min-h-[600px] px-4 py-8">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            Agent Trace Visualizer
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Transform raw agent logs into interactive visual reasoning maps. Support for LangChain, OpenAI, and custom formats.
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          className={`border-2 border-dashed rounded-xl p-12 transition-all duration-200 ${
            isDragging 
              ? 'border-primary bg-primary/10 shadow-lg' 
              : 'border-border hover:border-primary/50 hover:bg-accent/5'
          }`}
          data-testid="dropzone-upload"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="relative">
                  <Upload className="h-10 w-10" />
                  {isDragging && (
                    <div className="absolute inset-0 animate-ping">
                      <Upload className="h-10 w-10 text-primary" />
                    </div>
                  )}
                </div>
                <FileJson className="h-10 w-10" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-medium">
                {isDragging ? 'Drop your file here' : 'Drop JSON file here'}
              </p>
              <label htmlFor="file-upload" className="text-primary hover:underline cursor-pointer font-medium text-sm inline-block">
                or browse files
                <input
                  id="file-upload"
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="input-file-upload"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or paste JSON directly</span>
          </div>
        </div>

        <div className="space-y-3">
          <Textarea
            id="json-input"
            placeholder='{"steps": [{"type": "thought", "content": "Analyzing the problem..."}]}'
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="font-mono text-sm min-h-[240px] resize-y"
            data-testid="textarea-json-input"
          />
          <Button
            onClick={handleVisualize}
            className="w-full"
            size="lg"
            data-testid="button-visualize"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Visualize Trace
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Supports flexible JSON formats from any agent framework</p>
        </div>
      </div>
    </div>
  );
}

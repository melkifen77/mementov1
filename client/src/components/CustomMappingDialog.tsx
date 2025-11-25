import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FieldMapping } from '@shared/models';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'memento_custom_mapping';

interface CustomMappingDialogProps {
  mapping: FieldMapping;
  onMappingChange: (mapping: FieldMapping) => void;
}

interface FieldConfig {
  key: keyof FieldMapping;
  label: string;
  placeholder: string;
  hint: string;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'stepsPath',
    label: 'Steps Array Path',
    placeholder: 'e.g., trace.events or data.steps',
    hint: 'Dot-separated path to the array of steps in your JSON'
  },
  {
    key: 'idField',
    label: 'ID Field',
    placeholder: 'e.g., step_id or uuid',
    hint: 'Field name that contains the unique step identifier'
  },
  {
    key: 'parentIdField',
    label: 'Parent ID Field',
    placeholder: 'e.g., parent or source',
    hint: 'Field name that links to the parent step'
  },
  {
    key: 'typeField',
    label: 'Type Field',
    placeholder: 'e.g., step_type or category',
    hint: 'Field name that indicates the step type (thought/action/etc)'
  },
  {
    key: 'contentField',
    label: 'Content Field',
    placeholder: 'e.g., message or text',
    hint: 'Field name that contains the main step content'
  },
  {
    key: 'timestampField',
    label: 'Timestamp Field',
    placeholder: 'e.g., created_at or ts',
    hint: 'Field name that contains the timestamp'
  }
];

export function CustomMappingDialog({ mapping, onMappingChange }: CustomMappingDialogProps) {
  const [open, setOpen] = useState(false);
  const [localMapping, setLocalMapping] = useState<FieldMapping>(mapping);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLocalMapping(parsed);
        onMappingChange(parsed);
      } catch {
      }
    }
  }, []);

  const handleFieldChange = (key: keyof FieldMapping, value: string) => {
    setLocalMapping(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  const handleSave = () => {
    const cleanMapping: FieldMapping = {};
    for (const key of Object.keys(localMapping) as (keyof FieldMapping)[]) {
      if (localMapping[key]) {
        cleanMapping[key] = localMapping[key];
      }
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanMapping));
    onMappingChange(cleanMapping);
    
    toast({
      title: 'Mapping saved',
      description: 'Your custom field mapping has been saved for future use.'
    });
    
    setOpen(false);
  };

  const handleReset = () => {
    setLocalMapping({});
    localStorage.removeItem(STORAGE_KEY);
    onMappingChange({});
    
    toast({
      title: 'Mapping reset',
      description: 'Custom mapping cleared. Auto-detection will be used.'
    });
  };

  const hasCustomMapping = Object.values(localMapping).some(v => v);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={hasCustomMapping ? 'border-primary/50' : ''}
          data-testid="button-custom-mapping"
        >
          <Settings className="h-4 w-4 mr-2" />
          Custom Mapping
          {hasCustomMapping && (
            <span className="ml-2 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Custom Field Mapping</DialogTitle>
          <DialogDescription>
            Specify how to extract data from your JSON format. Leave fields empty to use auto-detection.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {FIELD_CONFIGS.map(({ key, label, placeholder, hint }) => (
            <div key={key} className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={key} className="text-sm font-medium">
                  {label}
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[200px]">
                    <p className="text-xs">{hint}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id={key}
                value={localMapping[key] || ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                placeholder={placeholder}
                className="font-mono text-sm"
                data-testid={`input-mapping-${key}`}
              />
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
          <p className="font-medium mb-1">Example JSON paths:</p>
          <ul className="text-xs space-y-1 font-mono">
            <li>• <code>events</code> - top-level key</li>
            <li>• <code>trace.steps</code> - nested path</li>
            <li>• <code>data.runs[0].steps</code> - with array index</li>
          </ul>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleReset}
            disabled={!hasCustomMapping}
            data-testid="button-reset-mapping"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Auto
          </Button>
          <Button onClick={handleSave} data-testid="button-save-mapping">
            <Save className="h-4 w-4 mr-2" />
            Save Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

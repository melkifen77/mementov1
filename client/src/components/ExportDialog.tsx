import { useState } from 'react';
import { Download, FileImage } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { toPng, toSvg } from 'html-to-image';

interface ExportDialogProps {
  elementRef: React.RefObject<HTMLElement>;
}

export function ExportDialog({ elementRef }: ExportDialogProps) {
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (!elementRef.current) return;

    setIsExporting(true);
    try {
      const dataUrl = format === 'png' 
        ? await toPng(elementRef.current, { quality: 1 })
        : await toSvg(elementRef.current);

      const link = document.createElement('a');
      link.download = `trace-visualization-${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();

      toast({
        title: 'Export successful',
        description: `Visualization exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export visualization',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-export">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="dialog-export">
        <DialogHeader>
          <DialogTitle>Export Visualization</DialogTitle>
          <DialogDescription>
            Choose a format to export your trace visualization
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'png' | 'svg')}>
            <div className="flex items-center space-x-3 p-3 rounded-md hover-elevate cursor-pointer">
              <RadioGroupItem value="png" id="png" data-testid="radio-png" />
              <Label htmlFor="png" className="flex items-center gap-2 cursor-pointer flex-1">
                <FileImage className="h-4 w-4" />
                <div>
                  <div className="font-medium">PNG Image</div>
                  <div className="text-xs text-muted-foreground">Raster format, good for sharing</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-md hover-elevate cursor-pointer">
              <RadioGroupItem value="svg" id="svg" data-testid="radio-svg" />
              <Label htmlFor="svg" className="flex items-center gap-2 cursor-pointer flex-1">
                <FileImage className="h-4 w-4" />
                <div>
                  <div className="font-medium">SVG Vector</div>
                  <div className="text-xs text-muted-foreground">Scalable, editable format</div>
                </div>
              </Label>
            </div>
          </RadioGroup>
          <Button 
            onClick={handleExport} 
            disabled={isExporting}
            className="w-full"
            data-testid="button-download"
          >
            {isExporting ? 'Exporting...' : 'Download'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

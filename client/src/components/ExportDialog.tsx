import { useState } from 'react';
import { Download, FileImage, Loader2 } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (!elementRef.current) {
      toast({
        title: 'Nothing to export',
        description: 'Please load a trace first',
        variant: 'destructive',
      });
      setIsOpen(false);
      return;
    }

    setIsExporting(true);
    try {
      const dataUrl = format === 'png' 
        ? await toPng(elementRef.current, { quality: 1, pixelRatio: 2 })
        : await toSvg(elementRef.current);

      const link = document.createElement('a');
      link.download = `trace-visualization-${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();

      toast({
        title: 'Export successful',
        description: `Visualization exported as ${format.toUpperCase()}`,
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export visualization. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
            Save your trace visualization as an image file
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'png' | 'svg')}>
            <div className="flex items-center space-x-3 p-3 rounded-md hover-elevate active-elevate-2 cursor-pointer">
              <RadioGroupItem value="png" id="png" data-testid="radio-png" />
              <Label htmlFor="png" className="flex items-center gap-2 cursor-pointer flex-1">
                <FileImage className="h-4 w-4" />
                <div>
                  <div className="font-medium">PNG Image</div>
                  <div className="text-xs text-muted-foreground">High quality, perfect for presentations</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-md hover-elevate active-elevate-2 cursor-pointer">
              <RadioGroupItem value="svg" id="svg" data-testid="radio-svg" />
              <Label htmlFor="svg" className="flex items-center gap-2 cursor-pointer flex-1">
                <FileImage className="h-4 w-4" />
                <div>
                  <div className="font-medium">SVG Vector</div>
                  <div className="text-xs text-muted-foreground">Scalable, editable in design tools</div>
                </div>
              </Label>
            </div>
          </RadioGroup>
          <Button 
            onClick={handleExport} 
            disabled={isExporting}
            className="w-full"
            size="lg"
            data-testid="button-download"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download {format.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

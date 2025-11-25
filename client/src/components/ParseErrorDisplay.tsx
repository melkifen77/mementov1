import { AlertTriangle, Settings, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ParseResult } from '@shared/models';

interface ParseErrorDisplayProps {
  result: ParseResult;
  onOpenCustomMapping: () => void;
  onTryAgain: () => void;
}

export function ParseErrorDisplay({ result, onOpenCustomMapping, onTryAgain }: ParseErrorDisplayProps) {
  const errorLines = result.error?.split('\n') || [];
  const mainError = errorLines[0] || 'Failed to parse trace';
  const details = errorLines.slice(1).filter(line => line.trim());
  
  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Unable to Parse Trace</CardTitle>
              <CardDescription className="mt-1">
                {mainError}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {details.length > 0 && (
            <div className="bg-muted/50 rounded-md p-3 font-mono text-xs space-y-1">
              {details.map((line, i) => (
                <p key={i} className="text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          )}

          {result.warnings && result.warnings.length > 0 && (
            <div className="text-sm text-amber-600 dark:text-amber-500">
              <p className="font-medium mb-1">Warnings:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.warnings.map((warning, i) => (
                  <li key={i} className="text-xs">{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                If your JSON uses a non-standard format, try setting up a custom field mapping 
                to tell us where to find your trace data.
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={onOpenCustomMapping}
                className="flex-1"
                data-testid="button-parse-error-mapping"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure Custom Mapping
              </Button>
              <Button 
                variant="default" 
                onClick={onTryAgain}
                className="flex-1"
                data-testid="button-parse-error-retry"
              >
                Try Again
              </Button>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              <span className="font-medium">Supported formats include:</span>
            </p>
            <ul className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
              <li>• LangChain traces</li>
              <li>• LangGraph events</li>
              <li>• OpenAI tool calls</li>
              <li>• Custom agent logs</li>
              <li>• Message arrays</li>
              <li>• Step sequences</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

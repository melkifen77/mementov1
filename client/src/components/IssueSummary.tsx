import { AlertTriangle, ChevronDown, ChevronUp, X, RefreshCw, Repeat, MessageSquareOff, ArrowRightLeft, MessageSquare, AlertCircle, Circle, Sparkles, ShieldAlert, Ban, Activity } from 'lucide-react';
import { useState } from 'react';
import { TraceRun, IssueType, RiskLevel } from '@shared/models';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface IssueSummaryProps {
  trace: TraceRun | null;
  onClose?: () => void;
}

const ISSUE_ICONS: Record<IssueType, typeof AlertTriangle> = {
  guessing_after_error: Sparkles,
  commit_after_empty: ShieldAlert,
  unhandled_error: Ban,
  loop: Repeat,
  missing_observation: MessageSquareOff,
  suspicious_transition: ArrowRightLeft,
  contradiction_candidate: MessageSquare,
  error_ignored: AlertCircle,
  empty_result: Circle
};

const ISSUE_LABELS: Record<IssueType, string> = {
  guessing_after_error: 'Guessing After Error',
  commit_after_empty: 'Commit After Empty',
  unhandled_error: 'Unhandled Errors',
  loop: 'Loops',
  missing_observation: 'Missing Observations',
  suspicious_transition: 'Suspicious Transitions',
  contradiction_candidate: 'Contradictions',
  error_ignored: 'Errors Ignored',
  empty_result: 'Empty Results'
};

const ISSUE_PRIORITY: IssueType[] = [
  'guessing_after_error',
  'commit_after_empty',
  'unhandled_error',
  'error_ignored',
  'loop',
  'missing_observation',
  'empty_result',
  'suspicious_transition',
  'contradiction_candidate'
];

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/20' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/20' },
  high: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' }
};

export function IssueSummary({ trace, onClose }: IssueSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!trace) return null;

  const totalIssues = trace.issues?.length || 0;
  const summary: Record<IssueType, number> = trace.issueSummary || {
    loop: 0,
    missing_observation: 0,
    suspicious_transition: 0,
    contradiction_candidate: 0,
    error_ignored: 0,
    empty_result: 0,
    guessing_after_error: 0,
    commit_after_empty: 0,
    unhandled_error: 0
  };
  const riskLevel = trace.riskLevel || 'low';
  const riskColors = RISK_COLORS[riskLevel];

  const nonZeroIssues = ISSUE_PRIORITY
    .filter(type => (summary[type] || 0) > 0)
    .map(type => [type, summary[type]] as [IssueType, number]);
  
  const stats = trace.stats;

  return (
    <div 
      className="bg-background/95 backdrop-blur-xl border border-border rounded-lg shadow-lg overflow-hidden"
      data-testid="issue-summary-panel"
    >
      <div
        className="w-full flex items-center justify-between gap-2 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
        data-testid="button-toggle-summary"
      >
        <div 
          className="flex items-center gap-2 flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Trace Analysis</span>
          {totalIssues > 0 && (
            <Badge 
              variant="secondary" 
              className={`${riskColors.bg} ${riskColors.text} border ${riskColors.border}`}
            >
              {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              data-testid="button-close-summary"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className="cursor-pointer"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          <div className={`p-2 rounded-md border ${riskColors.bg} ${riskColors.border}`}>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${riskColors.text.replace('text-', 'bg-')}`} />
              <span className={`text-sm font-medium ${riskColors.text}`}>
                Risk: {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
              </span>
            </div>
            {trace.riskExplanation && (
              <p className="text-xs text-muted-foreground mt-1 ml-4">
                {trace.riskExplanation}
              </p>
            )}
          </div>

          {totalIssues === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
              <RefreshCw className="h-4 w-4" />
              <span>No issues detected in this trace.</span>
            </div>
          ) : (
            <div className="space-y-1">
              {nonZeroIssues.map(([type, count]) => {
                const Icon = ISSUE_ICONS[type as IssueType];
                const label = ISSUE_LABELS[type as IssueType];
                return (
                  <div 
                    key={type}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                    data-testid={`issue-count-${type}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{label}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}

          {stats && (
            <div className="pt-2 border-t border-border space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  <span>Actions:</span>
                </div>
                <span className="font-medium">{stats.totalActions}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>Errors:</span>
                </div>
                <span className={`font-medium ${stats.totalErrors > 0 ? 'text-destructive' : ''}`}>
                  {stats.totalErrors}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total steps:</span>
                <span className="font-medium">{stats.totalNodes}</span>
              </div>
            </div>
          )}

          {trace.source && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Source:</span>
                <Badge variant="outline" className="text-xs">{trace.source}</Badge>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

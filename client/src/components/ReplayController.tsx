import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { TraceNode } from '@shared/models';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReplayControllerProps {
  nodes: TraceNode[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onNodeSelect: (node: TraceNode) => void;
}

export function ReplayController({
  nodes,
  currentIndex,
  onIndexChange,
  onNodeSelect,
}: ReplayControllerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<string>('1');

  const totalSteps = nodes.length;

  // Guard for empty nodes array
  if (totalSteps === 0) {
    return (
      <div 
        className="flex items-center gap-4 px-4 py-2 bg-background/95 backdrop-blur-xl border-b border-border opacity-50"
        data-testid="replay-controller-empty"
      >
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" disabled data-testid="button-replay-prev-disabled">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" disabled data-testid="button-replay-play-disabled">
            <Play className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" disabled data-testid="button-replay-next-disabled">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm font-medium text-muted-foreground" data-testid="text-replay-step-empty">
          No steps available
        </div>
      </div>
    );
  }
  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex >= totalSteps - 1;

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < totalSteps) {
      onIndexChange(index);
      onNodeSelect(nodes[index]);
    }
  }, [nodes, totalSteps, onIndexChange, onNodeSelect]);

  const handlePrevious = useCallback(() => {
    if (!isAtStart) {
      goToIndex(currentIndex - 1);
    }
  }, [currentIndex, isAtStart, goToIndex]);

  const handleNext = useCallback(() => {
    if (!isAtEnd) {
      goToIndex(currentIndex + 1);
    }
  }, [currentIndex, isAtEnd, goToIndex]);

  const togglePlay = useCallback(() => {
    if (isAtEnd) {
      goToIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [isAtEnd, goToIndex]);

  useEffect(() => {
    if (!isPlaying) return;

    if (isAtEnd) {
      setIsPlaying(false);
      return;
    }

    const interval = 1000 / parseFloat(speed);
    const timer = setTimeout(() => {
      goToIndex(currentIndex + 1);
    }, interval);

    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, speed, isAtEnd, goToIndex]);

  useEffect(() => {
    if (nodes[currentIndex]) {
      onNodeSelect(nodes[currentIndex]);
    }
  }, [currentIndex, nodes, onNodeSelect]);

  return (
    <div 
      className="flex items-center gap-4 px-4 py-2 bg-background/95 backdrop-blur-xl border-b border-border"
      data-testid="replay-controller"
    >
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={handlePrevious}
          disabled={isAtStart}
          data-testid="button-replay-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={togglePlay}
          data-testid="button-replay-play"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={handleNext}
          disabled={isAtEnd}
          data-testid="button-replay-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-sm font-medium text-muted-foreground" data-testid="text-replay-step">
        Step {currentIndex + 1} / {totalSteps}
      </div>

      <Select value={speed} onValueChange={setSpeed}>
        <SelectTrigger className="w-20" data-testid="select-replay-speed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0.5" data-testid="option-speed-0.5">0.5x</SelectItem>
          <SelectItem value="1" data-testid="option-speed-1">1x</SelectItem>
          <SelectItem value="2" data-testid="option-speed-2">2x</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

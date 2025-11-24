import { TraceRun } from '../models';

export interface TraceAdapter {
  id: string;
  label: string;
  canHandle?(raw: any): boolean;
  normalize(raw: any): TraceRun;
}

import { TraceRun, FieldMapping, ParseResult } from '../models';

export interface TraceAdapter {
  id: string;
  label: string;
  canHandle?(raw: any): boolean;
  normalize(raw: any, mapping?: FieldMapping): TraceRun;
  parse?(raw: any, mapping?: FieldMapping): ParseResult;
}

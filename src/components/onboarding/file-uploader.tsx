'use client';

import Papa from 'papaparse';
import type { ParseResult } from 'papaparse';
import { UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface ParsedCsv {
  fileName: string;
  headers: string[];
  recordCount: number;
}

export function FileUploader({ onParsed }: { onParsed: (items: ParsedCsv[]) => void }) {
  const [isParsing, setIsParsing] = useState(false);

  const parseFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsParsing(true);

    const parsed: ParsedCsv[] = [];

    for (const file of Array.from(fileList)) {
      // Parse only headers + row count client-side. No backend calls.
      await new Promise<void>((resolve) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (result: ParseResult<Record<string, unknown>>) => {
            const fields = (result.meta.fields ?? []).map((field: string) => field.trim());
            parsed.push({
              fileName: file.name,
              headers: fields,
              recordCount: result.data.length,
            });
            resolve();
          },
          error: () => resolve(),
        });
      });
    }

    setIsParsing(false);
    onParsed(parsed);
  };

  return (
    <Card>
      <CardContent className="p-5">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-app-border bg-slate-50 px-4 py-8 text-center">
          <UploadCloud className="mb-2 h-6 w-6 text-app-muted" />
          <div className="text-sm font-medium">Drag and drop CSV files or click to upload</div>
          <div className="text-xs text-app-muted">Multiple files supported</div>
          <input
            className="hidden"
            type="file"
            accept=".csv"
            multiple
            onChange={(event) => {
              void parseFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <div className="mt-3 text-right">
          <Button variant="secondary" size="sm" disabled={isParsing}>
            {isParsing ? 'Parsing...' : 'Client-side parsing only'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

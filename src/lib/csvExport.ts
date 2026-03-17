import JSZip from 'jszip';

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const objectsToCsv = (headers: string[], rows: Array<Record<string, unknown>>): string => {
  const headerLine = headers.join(',');
  const lines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','));
  return `${headerLine}\n${lines.join('\n')}\n`;
};

export const downloadFile = (
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8;'
): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const downloadZip = async (
  zipName: string,
  files: Array<{ name: string; content: string }>
): Promise<void> => {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = zipName;
  anchor.click();
  URL.revokeObjectURL(url);
};

'use client';

export function SopViewer({ content }: { content: string }) {
  const lines = content.split('\n');
  const toc = lines
    .filter((line) => line.startsWith('## '))
    .map((line) => line.replace(/^##\s+/, ''));

  return (
    <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
      <aside className="sticky top-24 h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contents</div>
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          {toc.map((item) => (
            <div key={item} className="rounded px-2 py-1 hover:bg-slate-50">
              {item}
            </div>
          ))}
          {toc.length === 0 ? <div className="text-xs text-slate-500">No sections yet.</div> : null}
        </div>
      </aside>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{lines.join('\n')}</pre>
      </div>
    </div>
  );
}

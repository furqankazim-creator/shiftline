import { useEffect, useState } from 'react';

import { useStore } from '@/app/store';
import { useToast } from '@/components/ui';
import { InsightsDrawer } from '@/features/insights/InsightsDrawer';
import { ImportModal } from '@/features/io/ImportModal';
import { ExportModal } from '@/features/io/ExportModal';

import { GenerateModal } from './GenerateModal';
import { RosterGrid } from './RosterGrid';
import { RotateModal } from './RotateModal';
import { Toolbar } from './Toolbar';

export function PlannerPage() {
  const { undo, redo } = useStore();
  const toast = useToast();

  const [brush, setBrush] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === 'Escape') setBrush(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex flex-1 min-w-0 flex-col">
        <Toolbar
          brush={brush}
          setBrush={setBrush}
          onGenerate={() => setGenerateOpen(true)}
          onRotate={() => setRotateOpen(true)}
          onImport={() => setImportOpen(true)}
          onExport={() => setExportOpen(true)}
          insightsOpen={insightsOpen}
          toggleInsights={() => setInsightsOpen((v) => !v)}
        />
        <RosterGrid brush={brush} revealKey={revealKey} />
      </div>

      <InsightsDrawer
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        onJump={() => {
          // The grid already rings the offending cell; opening the issue is
          // enough of a jump at this grid size.
        }}
      />

      <GenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onDone={() => setRevealKey((k) => k + 1)}
      />
      <RotateModal open={rotateOpen} onClose={() => setRotateOpen(false)} />
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={(n) => {
          toast(`Imported ${n} people from Excel.`, 'ok');
          setRevealKey((k) => k + 1);
        }}
      />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

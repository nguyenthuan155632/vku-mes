'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { T } from '@/lib/strings';

export function ManualEntryDialog({ open, onOpenChange, workcenter }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workcenter: { id: number; name: string };
}) {
  const { mutate } = useSWRConfig();
  const [qty, setQty] = useState('');
  const [defect, setDefect] = useState('0');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workcenter_id: workcenter.id,
          qty: Number(qty),
          defect_qty: Number(defect),
          reason: reason || undefined
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: { message?: string } })?.error?.message ?? T.common.error);
      }
      toast.success(T.dashboard.manualEntry.success);
      await mutate('/api/dashboard');
      onOpenChange(false);
      setQty(''); setDefect('0'); setReason('');
    } catch (err: unknown) {
      toast.error((err as Error).message ?? T.common.error);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{T.dashboard.manualEntry.title(workcenter.name)}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="qty">{T.dashboard.manualEntry.qty}</Label>
            <Input id="qty" type="number" min={0} required value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="defect">{T.dashboard.manualEntry.defectQty}</Label>
            <Input id="defect" type="number" min={0} value={defect} onChange={(e) => setDefect(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">{T.dashboard.manualEntry.reason}</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{T.dashboard.manualEntry.cancel}</Button>
            <Button type="submit" disabled={saving}>{T.dashboard.manualEntry.submit}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

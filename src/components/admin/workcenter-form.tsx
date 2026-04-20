'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { T } from '@/lib/strings';

interface Wc { id: number; code: string; name: string; targetQtyPerHour: number; alertThresholdMinutes: number; lowOutputThresholdPct: number }

export function WorkcenterForm({ mode, wc, trigger }: { mode: 'create' | 'edit'; wc?: Wc; trigger: React.ReactNode }) {
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: wc?.code ?? '',
    name: wc?.name ?? '',
    target_qty_per_hour: String(wc?.targetQtyPerHour ?? 0),
    alert_threshold_minutes: String(wc?.alertThresholdMinutes ?? 10),
    low_output_threshold_pct: String(wc?.lowOutputThresholdPct ?? 60)
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name,
      target_qty_per_hour: Number(form.target_qty_per_hour),
      alert_threshold_minutes: Number(form.alert_threshold_minutes),
      low_output_threshold_pct: Number(form.low_output_threshold_pct)
    };
    const url = mode === 'create' ? '/api/workcenters' : `/api/workcenters/${wc!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    if (mode === 'create') body.code = form.code;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      toast.error((r as { error?: { message?: string } })?.error?.message ?? T.common.error);
      return;
    }
    toast.success(T.dashboard.manualEntry.success);
    setOpen(false);
    await mutate('/api/workcenters');
    await mutate('/api/dashboard');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === 'create' ? T.admin.create : T.admin.edit}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>{T.admin.columns.code}</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={mode === 'edit'} required />
          </div>
          <div className="grid gap-2">
            <Label>{T.admin.columns.name}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid gap-2">
            <Label>{T.admin.columns.target}</Label>
            <Input type="number" min={0} value={form.target_qty_per_hour} onChange={(e) => setForm({ ...form, target_qty_per_hour: e.target.value })} required />
          </div>
          <div className="grid gap-2">
            <Label>{T.admin.columns.alertThreshold}</Label>
            <Input type="number" min={1} value={form.alert_threshold_minutes} onChange={(e) => setForm({ ...form, alert_threshold_minutes: e.target.value })} required />
          </div>
          <div className="grid gap-2">
            <Label>{T.admin.columns.lowOutputPct}</Label>
            <Input type="number" min={0} max={100} value={form.low_output_threshold_pct} onChange={(e) => setForm({ ...form, low_output_threshold_pct: e.target.value })} required />
          </div>
          <DialogFooter>
            <Button type="submit">{T.admin.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

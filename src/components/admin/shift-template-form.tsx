'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { T } from '@/lib/strings';

interface Template { id: number; name: string; shiftNumber: number; startTime: string; endTime: string }

function calcDuration(start: string, end: string): string {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return '—';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  const min = e > s ? e - s : 1440 - s + e;
  const cross = e <= s;
  return `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}${cross ? ` ${T.shifts.form.crossMidnight}` : ''}`;
}

export function ShiftTemplateForm({ mode, template, trigger }: { mode: 'create' | 'edit'; template?: Template; trigger: React.ReactNode }) {
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: template?.name ?? '',
    shift_number: String(template?.shiftNumber ?? ''),
    start_time: template?.startTime ?? '',
    end_time: template?.endTime ?? '',
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = mode === 'create' ? '/api/admin/shift-templates' : `/api/admin/shift-templates/${template!.id}`;
    const res = await fetch(url, {
      method: mode === 'create' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, shift_number: Number(form.shift_number), start_time: form.start_time, end_time: form.end_time }),
    });
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      toast.error((r as { error?: { message?: string } })?.error?.message ?? T.common.error);
      return;
    }
    toast.success(T.dashboard.manualEntry.success);
    setOpen(false);
    await mutate('/api/admin/shift-templates');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? T.shifts.form.createTitle : T.shifts.form.editTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>{T.shifts.form.name}</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid gap-2">
            <Label>{T.shifts.form.shiftNumber}</Label>
            <Input type="number" min={1} value={form.shift_number} onChange={e => setForm({ ...form, shift_number: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{T.shifts.form.startTime}</Label>
              <Input placeholder="08:00" pattern="\d{2}:\d{2}" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label>{T.shifts.form.endTime}</Label>
              <Input placeholder="16:00" pattern="\d{2}:\d{2}" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {T.shifts.form.duration}: <span className="font-medium text-foreground">{calcDuration(form.start_time, form.end_time)}</span>
          </p>
          <DialogFooter>
            <Button type="submit">{T.admin.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

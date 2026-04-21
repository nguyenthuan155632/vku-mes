'use client';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { fetcher } from '@/lib/fetcher';
import { HeaderBar } from '@/components/dashboard/header-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShiftCoverageBar } from '@/components/admin/shift-coverage-bar';
import { ShiftTemplateForm } from '@/components/admin/shift-template-form';
import { T } from '@/lib/strings';

interface ShiftTemplate { id: number; name: string; shiftNumber: number; startTime: string; endTime: string; isActive: boolean }

function durationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  const min = e > s ? e - s : 1440 - s + e;
  return `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}`;
}

function isCrossMidnight(start: string, end: string): boolean {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em <= sh * 60 + sm;
}

export default function AdminShiftsPage() {
  const { data: templates } = useSWR<ShiftTemplate[]>('/api/admin/shift-templates', fetcher);
  const { data: dash } = useSWR<{ totals: { running: number; stopped: number; shiftQty: number } }>('/api/dashboard', fetcher, { refreshInterval: 30_000 });
  const { mutate } = useSWRConfig();

  async function toggleActive(t: ShiftTemplate) {
    const res = await fetch(`/api/admin/shift-templates/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !t.isActive }),
    });
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      toast.error((r as { error?: { message?: string } })?.error?.message ?? T.common.error);
      return;
    }
    await mutate('/api/admin/shift-templates');
  }

  async function deleteTemplate(t: ShiftTemplate) {
    if (!confirm(T.shifts.deleteConfirm)) return;
    const res = await fetch(`/api/admin/shift-templates/${t.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error(T.common.error); return; }
    await mutate('/api/admin/shift-templates');
  }

  return (
    <div>
      <HeaderBar totals={dash?.totals ?? { running: 0, stopped: 0, shiftQty: 0 }} />
      <main className="flex flex-col gap-4 p-6">
        <Link href="/admin/workcenters" className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
          ← {T.admin.title}
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{T.shifts.title}</CardTitle>
            <ShiftTemplateForm mode="create" trigger={<Button>{T.shifts.addShift}</Button>} />
          </CardHeader>
          <CardContent className="space-y-4">
            {templates && <ShiftCoverageBar templates={templates} />}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{T.shifts.columns.number}</TableHead>
                  <TableHead>{T.shifts.columns.name}</TableHead>
                  <TableHead>{T.shifts.columns.start}</TableHead>
                  <TableHead>{T.shifts.columns.end}</TableHead>
                  <TableHead>{T.shifts.columns.duration}</TableHead>
                  <TableHead>{T.shifts.columns.status}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(templates ?? []).map(t => (
                  <TableRow key={t.id} className={t.isActive ? '' : 'opacity-50'}>
                    <TableCell>{t.shiftNumber}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-sm">{t.startTime}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {t.endTime}
                      {isCrossMidnight(t.startTime, t.endTime) && (
                        <span className="ml-1 text-[10px] text-amber-500">+1</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{durationLabel(t.startTime, t.endTime)}</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? 'default' : 'secondary'}>
                        {t.isActive ? T.shifts.active : T.shifts.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <ShiftTemplateForm mode="edit" template={t} trigger={<Button variant="secondary" size="sm">{T.shifts.edit}</Button>} />
                        <Button variant="secondary" size="sm" onClick={() => toggleActive(t)}>
                          {t.isActive ? T.shifts.disable : T.shifts.enable}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteTemplate(t)}>
                          {T.shifts.delete}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

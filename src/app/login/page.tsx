'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { T } from '@/lib/strings';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) throw new Error(T.login.badCredentials);
      const { role } = await res.json() as { role: 'operator' | 'supervisor' | 'viewer' };
      router.push(role === 'viewer' ? '/supervisor' : '/');
      router.refresh();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? T.common.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>{T.login.title}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">{T.login.passwordLabel}</Label>
              <Input id="password" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={submitting}>{T.login.submit}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

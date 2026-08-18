'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, KeyRound, Loader2, Shield, Truck } from 'lucide-react';
import type { CourierConnectionView, CourierProviderName, UpsertCourierConnectionDto } from '@closetrent/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { PasswordInput } from '@/components/ui/password-input';
import { DistrictLeadDaysEditor } from './district-lead-days-editor';
import {
  useCourierConnections,
  useStoreSettings,
  useTestCourierConnection,
  useUpdateDeliverySettings,
  useUpsertCourierConnection,
} from '../hooks/use-settings';

interface ConnectionDraft extends UpsertCourierConnectionDto {
  provider: CourierProviderName;
}

const EMPTY_DRAFTS: Record<CourierProviderName, ConnectionDraft> = {
  pathao: { provider: 'pathao', isEnabled: false, isDefault: false, sandbox: true },
  steadfast: { provider: 'steadfast', isEnabled: false, isDefault: false },
  manual: { provider: 'manual', isEnabled: true, isDefault: true },
};

export default function DeliverySettingsPage() {
  const settings = useStoreSettings();
  const connections = useCourierConnections();
  const updateDelivery = useUpdateDeliverySettings();
  const upsertConnection = useUpsertCourierConnection();
  const testConnection = useTestCourierConnection();
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [drafts, setDrafts] = useState(EMPTY_DRAFTS);

  useEffect(() => {
    if (!settings.data?.data) return;
    setPickupAddress(settings.data.data.pickupAddress ?? '');
    setPickupCity(settings.data.data.pickupCity ?? '');
  }, [settings.data]);

  useEffect(() => {
    if (!connections.data) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const row of connections.data) {
        next[row.provider] = {
          ...next[row.provider],
          isEnabled: row.isEnabled,
          isDefault: row.isDefault,
          storeId: typeof row.config.storeId === 'number' ? row.config.storeId : undefined,
          sandbox: row.config.sandbox === true,
        };
      }
      return next;
    });
  }, [connections.data]);

  const connectionMap = useMemo(() => new Map((connections.data ?? []).map((row) => [row.provider, row])), [connections.data]);
  const updateDraft = (provider: CourierProviderName, patch: Partial<ConnectionDraft>) => {
    setDrafts((current) => ({ ...current, [provider]: { ...current[provider], ...patch } }));
  };
  const saveConnection = (provider: CourierProviderName) => {
    const { provider: _provider, ...payload } = drafts[provider];
    upsertConnection.mutate({ provider, payload });
  };

  if (settings.isLoading || connections.isLoading) {
    return <div className="h-72 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">Delivery &amp; courier connections</h3>
        <p className="text-sm text-muted-foreground">Configure pickup operations and encrypted provider connections. Credentials are never returned after saving.</p>
      </div>
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" /> Pickup operations</CardTitle>
          <CardDescription>The origin address used for courier handover and pickup scheduling.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pickup-address">Pickup address</Label>
            <Input id="pickup-address" value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} placeholder="House, road, area, district" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pickup-city">Pickup city / district</Label>
            <Input id="pickup-city" value={pickupCity} onChange={(event) => setPickupCity(event.target.value)} placeholder="Dhaka" />
          </div>
          <div className="flex items-end justify-end">
            <Button disabled={updateDelivery.isPending} onClick={() => updateDelivery.mutate({ pickupAddress, pickupCity })}>
              {updateDelivery.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save pickup settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <ConnectionCard
          title="Pathao Courier"
          description="OAuth-backed parcel creation, rate lookup, polling, and authenticated webhooks."
          provider="pathao"
          draft={drafts.pathao}
          connection={connectionMap.get('pathao')}
          saving={upsertConnection.isPending}
          testing={testConnection.isPending}
          onChange={(patch) => updateDraft('pathao', patch)}
          onSave={() => saveConnection('pathao')}
          onTest={() => testConnection.mutate('pathao')}
        />
        <ConnectionCard
          title="Steadfast"
          description="API-key parcel creation, status polling, and authenticated webhook ingestion."
          provider="steadfast"
          draft={drafts.steadfast}
          connection={connectionMap.get('steadfast')}
          saving={upsertConnection.isPending}
          testing={testConnection.isPending}
          onChange={(patch) => updateDraft('steadfast', patch)}
          onSave={() => saveConnection('steadfast')}
          onTest={() => testConnection.mutate('steadfast')}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Manual delivery fallback</CardTitle>
          <CardDescription>Always available for an in-house rider or a courier without an API. It can be selected as the default provider.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div><p className="font-medium">Manual fulfillment</p><p className="text-sm text-muted-foreground">Staff records the tracking reference and advances shipment stages.</p></div>
          <div className="flex items-center gap-3">
            <Label htmlFor="manual-default">Default</Label>
            <Switch id="manual-default" checked={drafts.manual.isDefault} onCheckedChange={(value) => updateDraft('manual', { isDefault: value })} />
            <Button variant="outline" onClick={() => saveConnection('manual')}>Save</Button>
          </div>
        </CardContent>
      </Card>

      {settings.data?.data && (
        <DistrictLeadDaysEditor
          initialConfig={settings.data.data.pickupLeadDaysConfig}
          defaultLeadDays={settings.data.data.pickupLeadDays ?? 2}
        />
      )}
    </div>
  );
}

function ConnectionCard({
  title,
  description,
  provider,
  draft,
  connection,
  saving,
  testing,
  onChange,
  onSave,
  onTest,
}: {
  title: string;
  description: string;
  provider: 'pathao' | 'steadfast';
  draft: ConnectionDraft;
  connection?: CourierConnectionView;
  saving: boolean;
  testing: boolean;
  onChange: (patch: Partial<ConnectionDraft>) => void;
  onSave: () => void;
  onTest: () => void;
}) {
  const webhookUrl = connection ? `${typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.endsWith('.localhost') || window.location.hostname.endsWith('.local')) ? `${window.location.protocol}//${window.location.hostname}:4000` : typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/webhooks/courier/${provider}/${connection.webhookToken}` : '';
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div><CardTitle className="text-base">{title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></div>
          <HealthBadge connection={connection} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isEnabled ?? false} onCheckedChange={(value) => onChange({ isEnabled: value })} /> Enabled</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isDefault ?? false} onCheckedChange={(value) => onChange({ isDefault: value })} /> Default provider</label>
        </div>
        {provider === 'pathao' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SecretField label="Client ID" value={draft.clientId} saved={connection?.hasCredentials} onChange={(value) => onChange({ clientId: value })} />
            <SecretField label="Client secret" value={draft.clientSecret} saved={connection?.hasCredentials} onChange={(value) => onChange({ clientSecret: value })} />
            <SecretField label="Merchant username" value={draft.username} saved={connection?.hasCredentials} onChange={(value) => onChange({ username: value })} />
            <SecretField label="Merchant password" value={draft.password} saved={connection?.hasCredentials} onChange={(value) => onChange({ password: value })} />
            <div className="space-y-2"><Label>Store ID</Label><Input type="number" min={1} value={draft.storeId ?? ''} onChange={(event) => onChange({ storeId: event.target.value ? Number(event.target.value) : undefined })} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><Switch checked={draft.sandbox ?? false} onCheckedChange={(value) => onChange({ sandbox: value })} /> Sandbox environment</label>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <SecretField label="API key" value={draft.apiKey} saved={connection?.hasCredentials} onChange={(value) => onChange({ apiKey: value })} />
            <SecretField label="Secret key" value={draft.secretKey} saved={connection?.hasCredentials} onChange={(value) => onChange({ secretKey: value })} />
          </div>
        )}
        {webhookUrl && <div className="space-y-2"><Label>Status webhook URL</Label><Input readOnly value={webhookUrl} className="font-mono text-xs" onFocus={(event) => event.currentTarget.select()} /></div>}
        {connection?.lastHealthError && <p className="text-sm text-destructive">{connection.lastHealthError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={!connection?.hasCredentials || testing} onClick={onTest}>{testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />} Test</Button>
          <Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save connection</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SecretField({ label, value, saved, onChange }: { label: string; value?: string; saved?: boolean; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><PasswordInput value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={saved ? 'Saved — enter to replace' : 'Required'} /></div>;
}

function HealthBadge({ connection }: { connection?: CourierConnectionView }) {
  if (!connection) return <Badge variant="outline">Not configured</Badge>;
  if (connection.healthStatus === 'healthy') return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Healthy</Badge>;
  if (connection.healthStatus === 'unhealthy') return <Badge variant="destructive">Unhealthy</Badge>;
  return <Badge variant="secondary">{connection.healthStatus.replaceAll('_', ' ')}</Badge>;
}

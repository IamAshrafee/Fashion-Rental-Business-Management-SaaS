'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPin, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  inventoryApi,
  type InventoryLocation,
  type InventoryLocationInput,
  type InventoryLocationType,
} from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LOCATION_TYPES: InventoryLocationType[] = [
  'WAREHOUSE',
  'SHOWROOM',
  'PICKUP_POINT',
  'CLEANING_FACILITY',
  'REPAIR_FACILITY',
  'EXTERNAL',
];
const humanize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
const apiMessage = (error: unknown, fallback: string) => {
  const message = (error as { response?: { data?: { message?: string | { message?: string } } } })
    ?.response?.data?.message;
  return typeof message === 'string' ? message : message?.message || fallback;
};

const emptyLocation: InventoryLocationInput = {
  code: '',
  name: '',
  locationType: 'WAREHOUSE',
  timezone: 'Asia/Dhaka',
  country: 'BD',
  canStoreInventory: true,
  canFulfillRentals: true,
  canAcceptReturns: true,
  canTransfer: true,
};

function Capability({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function AddLocationDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InventoryLocationInput>(emptyLocation);
  const create = useMutation({
    mutationFn: () => inventoryApi.createLocation(form),
    onSuccess: async () => {
      setOpen(false);
      setForm(emptyLocation);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-locations'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-overview'] }),
      ]);
      toast.success('Inventory location created');
    },
    onError: (error) => toast.error(apiMessage(error, 'Could not create location')),
  });
  const set = <K extends keyof InventoryLocationInput>(key: K, value: InventoryLocationInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add location
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add inventory location</DialogTitle>
          <DialogDescription>
            Locations are operational nodes for stock, fulfillment, returns, cleaning, repairs, and
            transfers.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Location code</Label>
            <Input
              value={form.code}
              onChange={(event) => set('code', event.target.value.toUpperCase())}
              placeholder="MAIN-WH"
            />
          </div>
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Main Warehouse"
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              value={form.locationType}
              onValueChange={(value: InventoryLocationType) => set('locationType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {humanize(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Timezone</Label>
            <Input
              value={form.timezone}
              onChange={(event) => set('timezone', event.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Address</Label>
            <Input
              value={form.addressLine1 || ''}
              onChange={(event) => set('addressLine1', event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>City</Label>
            <Input value={form.city || ''} onChange={(event) => set('city', event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Contact phone</Label>
            <Input
              value={form.contactPhone || ''}
              onChange={(event) => set('contactPhone', event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Capability
            label="Stores inventory"
            checked={form.canStoreInventory ?? false}
            onChange={(value) => set('canStoreInventory', value)}
          />
          <Capability
            label="Fulfills rentals"
            checked={form.canFulfillRentals ?? false}
            onChange={(value) => set('canFulfillRentals', value)}
          />
          <Capability
            label="Customer pickup"
            checked={form.canCustomerPickup ?? false}
            onChange={(value) => set('canCustomerPickup', value)}
          />
          <Capability
            label="Accepts returns"
            checked={form.canAcceptReturns ?? false}
            onChange={(value) => set('canAcceptReturns', value)}
          />
          <Capability
            label="Cleaning / washing"
            checked={form.canClean ?? false}
            onChange={(value) => set('canClean', value)}
          />
          <Capability
            label="Repair / alteration"
            checked={form.canRepair ?? false}
            onChange={(value) => set('canRepair', value)}
          />
          <Capability
            label="Transfers stock"
            checked={form.canTransfer ?? false}
            onChange={(value) => set('canTransfer', value)}
          />
          <Capability
            label="Default fulfillment location"
            checked={form.isDefault ?? false}
            onChange={(value) => set('isDefault', value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!form.code.trim() || !form.name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LocationCard({ location }: { location: InventoryLocation }) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory-locations'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-overview'] }),
    ]);
  const setDefault = useMutation({
    mutationFn: () => inventoryApi.setDefaultLocation(location.id),
    onSuccess: async () => {
      await refresh();
      toast.success('Default location updated');
    },
    onError: (error) => toast.error(apiMessage(error, 'Could not set default location')),
  });
  const toggle = useMutation({
    mutationFn: () => inventoryApi.updateLocation(location.id, { isActive: !location.isActive }),
    onSuccess: async () => {
      await refresh();
      toast.success(location.isActive ? 'Location deactivated' : 'Location reactivated');
    },
    onError: (error) => toast.error(apiMessage(error, 'Could not update location')),
  });
  const capabilities = [
    location.canStoreInventory && 'Storage',
    location.canFulfillRentals && 'Fulfillment',
    location.canCustomerPickup && 'Pickup',
    location.canAcceptReturns && 'Returns',
    location.canClean && 'Cleaning',
    location.canRepair && 'Repair',
    location.canTransfer && 'Transfers',
  ].filter(Boolean);
  return (
    <Card className={!location.isActive ? 'opacity-65' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              {location.name}
            </CardTitle>
            <CardDescription>
              {location.code} · {humanize(location.locationType)}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {location.isDefault && <Badge>Default</Badge>}
            <Badge variant={location.isActive ? 'secondary' : 'outline'}>
              {location.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {[location.addressLine1, location.city, location.country].filter(Boolean).join(', ') ||
            'No address recorded'}
        </p>
        <div className="flex flex-wrap gap-1">
          {capabilities.map((capability) => (
            <Badge key={String(capability)} variant="outline">
              {capability}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {location._count?.stockUnits ?? 0} physical items · {location._count?.pools ?? 0} pooled
          SKUs
        </p>
        <div className="flex flex-wrap gap-2">
          {location.isActive && !location.isDefault && (
            <Button
              size="sm"
              variant="outline"
              disabled={setDefault.isPending}
              onClick={() => setDefault.mutate()}
            >
              Make default
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={toggle.isPending || location.isDefault}
            onClick={() => toggle.mutate()}
          >
            {location.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AvailabilityPolicyPanel({ locations }: { locations: InventoryLocation[] }) {
  const queryClient = useQueryClient();
  const policies = useQuery({
    queryKey: ['inventory-policies'],
    queryFn: inventoryApi.listPolicies,
  });
  const tenantPolicy = policies.data?.find(
    (policy) => policy.scope === 'TENANT' && policy.isActive,
  );
  const [target, setTarget] = useState('TENANT');
  const [preparationDays, setPreparationDays] = useState(0);
  const [returnDays, setReturnDays] = useState(0);
  const [noticeHours, setNoticeHours] = useState(0);
  const [maximumAdvanceDays, setMaximumAdvanceDays] = useState(365);
  const [pendingHoldMinutes, setPendingHoldMinutes] = useState(30);
  const [singleLocation, setSingleLocation] = useState(true);
  const [crossLocation, setCrossLocation] = useState(false);
  useEffect(() => {
    if (!tenantPolicy) return;
    setPreparationDays(Math.ceil((tenantPolicy.preparationBufferMinutes ?? 0) / 1440));
    setReturnDays(
      Math.ceil(
        ((tenantPolicy.returnBufferMinutes ?? 0) +
          (tenantPolicy.inspectionBufferMinutes ?? 0) +
          (tenantPolicy.cleaningBufferMinutes ?? 0)) /
          1440,
      ),
    );
    setNoticeHours(Math.ceil((tenantPolicy.minimumNoticeMinutes ?? 0) / 60));
    setMaximumAdvanceDays(tenantPolicy.maximumAdvanceDays ?? 365);
    setPendingHoldMinutes(tenantPolicy.pendingHoldMinutes ?? 30);
    setSingleLocation(tenantPolicy.requireSingleLocationForBundle ?? true);
    setCrossLocation(tenantPolicy.allowCrossLocationTransfers ?? false);
  }, [tenantPolicy]);
  const save = useMutation({
    mutationFn: () =>
      inventoryApi.upsertPolicy({
        scope: target === 'TENANT' ? 'TENANT' : 'LOCATION',
        ...(target !== 'TENANT' ? { locationId: target } : {}),
        preparationBufferMinutes: preparationDays * 1440,
        returnBufferMinutes: returnDays * 1440,
        minimumNoticeMinutes: noticeHours * 60,
        maximumAdvanceDays,
        pendingHoldMinutes,
        requireSingleLocationForBundle: singleLocation,
        allowCrossLocationTransfers: crossLocation,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory-policies'] });
      toast.success('Availability policy saved');
    },
    onError: (error) => toast.error(apiMessage(error, 'Could not save availability policy')),
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Availability policy
          </CardTitle>
          <CardDescription>
            Tenant defaults apply everywhere; a location policy overrides only the fields saved for
            that location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Policy scope</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TENANT">Business default</SelectItem>
                {locations
                  .filter((location) => location.isActive)
                  .map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-2">
              <Label>Preparation days</Label>
              <Input
                type="number"
                min={0}
                value={preparationDays}
                onChange={(event) =>
                  setPreparationDays(Math.max(0, Number(event.target.value) || 0))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Return-care days</Label>
              <Input
                type="number"
                min={0}
                value={returnDays}
                onChange={(event) => setReturnDays(Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Minimum notice hours</Label>
              <Input
                type="number"
                min={0}
                value={noticeHours}
                onChange={(event) => setNoticeHours(Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Maximum advance days</Label>
              <Input
                type="number"
                min={1}
                value={maximumAdvanceDays}
                onChange={(event) =>
                  setMaximumAdvanceDays(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Pending hold minutes</Label>
              <Input
                type="number"
                min={1}
                value={pendingHoldMinutes}
                onChange={(event) =>
                  setPendingHoldMinutes(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Capability
              label="Require one location for a bundle"
              checked={singleLocation}
              onChange={setSingleLocation}
            />
            <Capability
              label="Allow cross-location fulfillment planning"
              checked={crossLocation}
              onChange={setCrossLocation}
            />
          </div>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save policy
          </Button>
        </CardContent>
      </Card>
      {!!policies.data?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configured policy layers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {policies.data.map((policy) => (
              <div
                key={policy.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{humanize(policy.scope)} policy</p>
                  <p className="text-xs text-muted-foreground">
                    {policy.location?.name || policy.product?.name || 'Business default'} · version{' '}
                    {policy.version}
                  </p>
                </div>
                <Badge variant={policy.isActive ? 'secondary' : 'outline'}>
                  {policy.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function InventoryLocationsPage() {
  const locations = useQuery({
    queryKey: ['inventory-locations', 'all'],
    queryFn: () => inventoryApi.listLocations(true),
  });
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations and availability</h1>
          <p className="text-sm text-muted-foreground">
            Define where inventory lives and the operational time that bookings must block.
          </p>
        </div>
        <AddLocationDialog />
      </div>
      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="policies">Availability policies</TabsTrigger>
        </TabsList>
        <TabsContent value="locations" className="mt-4">
          {locations.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading locations…
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {locations.data?.map((location) => (
                <LocationCard key={location.id} location={location} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="policies" className="mt-4">
          <AvailabilityPolicyPanel locations={locations.data || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

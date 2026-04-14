'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, Truck, Search, X, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useUpdateCourierSettings } from '../hooks/use-settings';

// ─── Constants ────────────────────────────────────────────────────────────────

const BANGLADESH_DISTRICTS: string[] = [
  'Dhaka', 'Gazipur', 'Narayanganj', 'Tangail', 'Kishoreganj',
  'Manikganj', 'Munshiganj', 'Narsingdi', 'Faridpur', 'Gopalganj',
  'Madaripur', 'Rajbari', 'Shariatpur',
  'Chittagong', 'Comilla', "Cox's Bazar", 'Feni', 'Lakshmipur',
  'Noakhali', 'Chandpur', 'Brahmanbaria', 'Rangamati', 'Bandarban',
  'Khagrachari',
  'Rajshahi', 'Bogra', 'Pabna', 'Sirajganj', 'Natore',
  'Nawabganj', 'Naogaon', 'Joypurhat',
  'Khulna', 'Jessore', 'Satkhira', 'Bagerhat', 'Narail',
  'Magura', 'Kushtia', 'Chuadanga', 'Meherpur', 'Jhenaidah',
  'Barisal', 'Patuakhali', 'Bhola', 'Pirojpur', 'Jhalokathi',
  'Barguna',
  'Sylhet', 'Habiganj', 'Sunamganj', 'Moulvibazar',
  'Rangpur', 'Dinajpur', 'Kurigram', 'Lalmonirhat', 'Nilphamari',
  'Gaibandha', 'Thakurgaon', 'Panchagarh',
  'Mymensingh', 'Netrokona', 'Sherpur', 'Jamalpur',
];

const TIER_CONFIG = [
  { days: 1, label: '1-Day Delivery', description: 'Same-city / metro area', color: 'bg-green-100 text-green-800 border-green-300', icon: Truck, badgeColor: 'bg-green-500' },
  { days: 2, label: '2-Day Delivery', description: 'Major cities / divisional capitals', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Clock, badgeColor: 'bg-blue-500' },
  { days: 3, label: '3-Day Delivery', description: 'Remote / rural districts', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: MapPin, badgeColor: 'bg-amber-500' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistrictLeadDaysConfig {
  districtLeadDays: Record<string, number>;
  defaultLeadDays: number;
}

interface DistrictLeadDaysEditorProps {
  initialConfig: DistrictLeadDaysConfig | null | undefined;
  defaultLeadDays: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DistrictLeadDaysEditor({ initialConfig, defaultLeadDays }: DistrictLeadDaysEditorProps) {
  const updateCourier = useUpdateCourierSettings();
  const [search, setSearch] = useState('');

  // Build initial district map from saved config or defaults
  const [districtMap, setDistrictMap] = useState<Record<string, number>>(() => {
    if (initialConfig?.districtLeadDays && Object.keys(initialConfig.districtLeadDays).length > 0) {
      return { ...initialConfig.districtLeadDays };
    }
    // Default tiers
    const defaults: Record<string, number> = {};
    const tier1 = ['dhaka', 'gazipur', 'narayanganj'];
    const tier2 = [
      'chittagong', 'rajshahi', 'khulna', 'sylhet', 'rangpur', 'barisal',
      'mymensingh', 'comilla', 'bogra', "cox's bazar", 'jessore', 'dinajpur',
      'tangail', 'narsingdi', 'faridpur', 'manikganj', 'munshiganj', 'madaripur', 'kishoreganj',
    ];
    for (const d of BANGLADESH_DISTRICTS) {
      const key = d.toLowerCase();
      if (tier1.includes(key)) defaults[key] = 1;
      else if (tier2.includes(key)) defaults[key] = 2;
      else defaults[key] = 3;
    }
    return defaults;
  });

  const [fallback, setFallback] = useState(initialConfig?.defaultLeadDays ?? defaultLeadDays ?? 3);

  // Compute tier groups
  const tiers = useMemo(() => {
    const groups: Record<number, string[]> = { 1: [], 2: [], 3: [] };
    for (const district of BANGLADESH_DISTRICTS) {
      const key = district.toLowerCase();
      const tier = districtMap[key] ?? fallback;
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push(district);
    }
    return groups;
  }, [districtMap, fallback]);

  const filteredDistricts = useMemo(() => {
    if (!search.trim()) return null;
    return BANGLADESH_DISTRICTS.filter(d =>
      d.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [search]);

  const moveDistrict = (district: string, newTier: number) => {
    setDistrictMap(prev => ({
      ...prev,
      [district.toLowerCase()]: newTier,
    }));
  };

  const handleSave = () => {
    const configPayload = {
      districtLeadDays: { ...districtMap },
      defaultLeadDays: fallback,
    };
    updateCourier.mutate(
      { pickupLeadDays: fallback, pickupLeadDaysConfig: configPayload as any },
      {
        onSuccess: () => toast.success('District lead days saved'),
        onError: (err: any) => toast.error(err.message || 'Failed to save'),
      }
    );
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">District-Based Lead Days</CardTitle>
              <CardDescription>
                Assign each district to a delivery tier. Click a district badge to change its tier.
              </CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={handleSave} disabled={updateCourier.isPending}>
            {updateCourier.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Tiers
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search districts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search results */}
        {filteredDistricts && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Search Results ({filteredDistricts.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredDistricts.map(d => (
                <DistrictBadge
                  key={d}
                  district={d}
                  tier={districtMap[d.toLowerCase()] ?? fallback}
                  onChangeTier={(tier) => moveDistrict(d, tier)}
                />
              ))}
              {filteredDistricts.length === 0 && (
                <p className="text-sm text-muted-foreground">No districts match &quot;{search}&quot;</p>
              )}
            </div>
          </div>
        )}

        {/* Tier Cards */}
        {!filteredDistricts && (
          <div className="space-y-4">
            {TIER_CONFIG.map(tier => {
              const districts = tiers[tier.days] ?? [];
              const Icon = tier.icon;
              return (
                <div key={tier.days} className={cn('border rounded-lg overflow-hidden', tier.color)}>
                  <div className="px-4 py-3 flex items-center gap-3 border-b border-current/10">
                    <Icon className="h-5 w-5" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{tier.label}</div>
                      <div className="text-xs opacity-80">{tier.description}</div>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {districts.length} districts
                    </Badge>
                  </div>
                  <div className="p-4 bg-background/60">
                    <div className="flex flex-wrap gap-1.5">
                      {districts.sort().map(d => (
                        <DistrictBadge
                          key={d}
                          district={d}
                          tier={tier.days}
                          onChangeTier={(newTier) => moveDistrict(d, newTier)}
                        />
                      ))}
                      {districts.length === 0 && (
                        <p className="text-xs text-muted-foreground py-1">No districts in this tier</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Default fallback */}
        <div className="flex items-center gap-3 pt-2 border-t">
          <span className="text-sm font-medium">Default for unlisted districts:</span>
          <Select
            value={String(fallback)}
            onValueChange={(v) => setFallback(Number(v))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1-Day Delivery</SelectItem>
              <SelectItem value="2">2-Day Delivery</SelectItem>
              <SelectItem value="3">3-Day Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── District Badge with tier selector ────────────────────────────────────────

function DistrictBadge({ district, tier, onChangeTier }: {
  district: string;
  tier: number;
  onChangeTier: (tier: number) => void;
}) {
  const colorMap: Record<number, string> = {
    1: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200',
    2: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
    3: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200',
  };

  const nextTier = tier >= 3 ? 1 : tier + 1;

  return (
    <button
      type="button"
      onClick={() => onChangeTier(nextTier)}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer',
        colorMap[tier] ?? colorMap[3],
      )}
      title={`${district} — ${tier}-day delivery. Click to change to ${nextTier}-day.`}
    >
      {district}
    </button>
  );
}

import { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';

export const EDIT_TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'variants', label: 'Variants' },
  { id: 'images', label: 'Images' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'size', label: 'Size' },
  { id: 'services', label: 'Services' },
  { id: 'details', label: 'Details & FAQ' },
] as const;

interface Props {
  children: (activeTab: string) => ReactNode;
  onSave: () => void;
  isSaving?: boolean;
}

export function TabbedEditLayout({ children, onSave, isSaving }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between sticky top-16 z-10 bg-background/95 backdrop-blur py-4 border-b">
        <h2 className="text-xl font-semibold">Edit Product</h2>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 flex-wrap !bg-transparent gap-2">
          {EDIT_TABS.map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 border border-transparent data-[state=inactive]:border-border data-[state=inactive]:bg-background"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="bg-card border rounded-lg p-6 shadow-sm min-h-[500px]">
          {EDIT_TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0 outline-none">
              {children(tab.id)}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}

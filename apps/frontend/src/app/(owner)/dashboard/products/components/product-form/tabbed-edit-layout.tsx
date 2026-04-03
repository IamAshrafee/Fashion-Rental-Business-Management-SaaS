import { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const EDIT_TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'media', label: 'Variants & Media' },
  { id: 'pricing', label: 'Pricing & Fees' },
  { id: 'size_details', label: 'Size & Details' },
] as const;

export type EditTabId = typeof EDIT_TABS[number]['id'];

interface Props {
  children: (activeTab: EditTabId) => ReactNode;
  onSave: () => void;
  isSaving?: boolean;
  activeTab: EditTabId;
  onTabChange: (tab: EditTabId) => void;
  tabErrors?: Record<EditTabId, boolean>; // if true, show a red dot indicator on the tab
}

export function TabbedEditLayout({ children, onSave, isSaving, activeTab, onTabChange, tabErrors = {} as Record<EditTabId, boolean> }: Props) {
  // Check if any tab has an error
  const hasGlobalErrors = Object.values(tabErrors).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between sticky top-16 z-20 bg-background/95 backdrop-blur py-4 border-b">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Edit Product
          {hasGlobalErrors && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-md">
              <AlertCircle className="h-3.5 w-3.5" />
              Fix errors to save
            </span>
          )}
        </h2>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as EditTabId)} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 flex-wrap !bg-transparent gap-2">
          {EDIT_TABS.map((tab) => {
            const hasError = tabErrors[tab.id];
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="relative data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 border border-transparent data-[state=inactive]:border-border data-[state=inactive]:bg-background min-h-[40px]"
              >
                {tab.label}
                {hasError && (
                  <span className="absolute top-1 right-1 flex h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background animate-in zoom-in" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm min-h-[500px]">
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

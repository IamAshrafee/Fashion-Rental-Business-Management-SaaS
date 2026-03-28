'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

const WIZARD_STEPS = [
  { id: 'logo', label: 'Upload store logo' },
  { id: 'colors', label: 'Set store colors' },
  { id: 'category', label: 'Add first category' },
  { id: 'product', label: 'Add first product' },
  { id: 'payment', label: 'Set payment method' },
  { id: 'delivery', label: 'Set delivery area' },
];

const STORAGE_KEY = 'closetrent_onboarding_progress';

export function DashboardSetupWizard() {
  const [mounted, setMounted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCompletedSteps(parsed.steps || []);
        setIsDismissed(parsed.dismissed || false);
      }
    } catch {
      console.error('Failed to parse onboarding progress');
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        steps: completedSteps,
        dismissed: isDismissed
      }));
    } catch {
      // ignore
    }
  }, [completedSteps, isDismissed, mounted]);

  const toggleStep = (id: string, checked: boolean) => {
    setCompletedSteps(prev => 
      checked ? [...prev, id] : prev.filter(step => step !== id)
    );
  };

  if (!mounted || isDismissed) return null;

  const progress = Math.round((completedSteps.length / WIZARD_STEPS.length) * 100);
  const isAllComplete = completedSteps.length === WIZARD_STEPS.length;

  return (
    <Card className="border-primary/20 bg-primary/5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 bg-primary h-full" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Getting Started
            </CardTitle>
            <CardDescription className="mt-1">
              Complete these steps to set up your storefront
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-primary">{progress}%</span>
          </div>
        </div>
        <Progress value={progress} className="h-2 mt-2 bg-primary/20" />
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {WIZARD_STEPS.map((step) => {
            const isChecked = completedSteps.includes(step.id);
            return (
              <div 
                key={step.id}
                className="flex items-center space-x-2 rounded-md border bg-card p-3 shadow-sm transition-all hover:border-primary/50"
              >
                <Checkbox 
                  id={step.id} 
                  checked={isChecked}
                  onCheckedChange={(checked) => toggleStep(step.id, checked === true)}
                />
                <Label 
                  htmlFor={step.id}
                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${isChecked ? 'text-muted-foreground line-through decoration-primary/50' : ''}`}
                >
                  {step.label}
                </Label>
              </div>
            );
          })}
        </div>
        
        {isAllComplete && (
          <div className="mt-6 flex flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in duration-500">
            <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="font-semibold text-lg mb-1">You&apos;re all set!</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-[300px]">
              Your store is fully configured and ready to accept bookings.
            </p>
            <button 
              onClick={() => setIsDismissed(true)}
              className="text-sm font-medium text-primary hover:underline"
            >
              Dismiss Setup Checklist
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

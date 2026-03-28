'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MOCK_BOOKINGS } from '../../mocks'; // For dummy customers
import { PackageSearch, CheckCircle } from 'lucide-react';

export function ManualBookingForm() {
  const [step, setStep] = useState(1);
  const customers = MOCK_BOOKINGS.map(b => b.customer);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        
        {/* Step 1: Customer */}
        <Card className="shadow-none border">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Customer Details</span>
              {step > 1 && <CheckCircle className="h-4 w-4 text-green-600" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Select Existing Customer</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Search by name or phone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c, i) => (
                      <SelectItem key={i} value={c.id}>{c.name} ({c.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-center text-sm text-muted-foreground my-2 relative">
                <span className="bg-card px-2 relative z-10">OR ADD NEW</span>
                <div className="absolute left-0 right-0 top-1/2 -mt-px border-t pointer-events-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="01XXXXXXXXX" />
                </div>
              </div>
            </div>
            
            {step === 1 && (
              <div className="w-full flex justify-end mt-4">
                <Button onClick={() => setStep(2)}>Continue to Items</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Items */}
        {step >= 2 && (
          <Card className="shadow-none border">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Rented Items
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="border border-dashed p-8 rounded-md flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/30 cursor-pointer">
                <PackageSearch className="h-8 w-8 mb-2 opacity-70" />
                <span>Search and add products</span>
              </div>
              
              <div className="w-full flex justify-end mt-4">
                <Button onClick={() => setStep(3)}>Continue to Pricing</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="md:col-span-1 space-y-6">
        <Card className="shadow-none border sticky top-6">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
             <div className="text-sm text-muted-foreground">Add items to view summary.</div>
             
             {step === 3 && (
               <Button className="w-full mt-4" size="lg" variant="default">
                 Create Booking
               </Button>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

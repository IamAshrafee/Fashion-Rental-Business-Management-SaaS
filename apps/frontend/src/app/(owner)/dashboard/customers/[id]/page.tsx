'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCustomer, useUpdateCustomer, useAddCustomerTag, useRemoveCustomerTag } from '../hooks/use-customers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MapPin, Mail, Phone, Clock, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

export default function CustomerProfilePage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const { data: response, isLoading } = useCustomer(id);
  const updateCustomer = useUpdateCustomer();
  const addTag = useAddCustomerTag();
  const removeTag = useRemoveCustomerTag();

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const customer = response?.data;

  const handleNotesSave = () => {
    if (!customer) return;
    updateCustomer.mutate({
      id: customer.id,
      payload: { notes }
    });
    setIsEditingNotes(false);
  };

  const startEditingNotes = () => {
    setNotes(customer?.notes || '');
    setIsEditingNotes(true);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim() || !customer) return;
    addTag.mutate({ id: customer.id, tag: newTag.trim() });
    setNewTag('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tag: string) => {
    if (!customer) return;
    removeTag.mutate({ id: customer.id, tag });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Loading profile...</div>;
  }

  if (!customer) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>Customer not found.</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Customer Profile</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="col-span-1 space-y-6">
          <div className="p-6 bg-white border rounded-xl shadow-sm space-y-4">
            <h3 className="text-xl font-bold">{customer.fullName}</h3>
            
            <div className="flex flex-wrap gap-2 items-center">
              {customer.tags?.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="px-2 py-1 pr-1 flex items-center gap-1 text-sm bg-primary/10 text-primary border-primary/20">
                  {tag}
                  <button 
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
              
              {isAddingTag ? (
                <form onSubmit={handleAddTag} className="flex items-center">
                  <Input 
                    autoFocus
                    className="h-6 w-24 text-xs px-2 py-0" 
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onBlur={() => !newTag && setIsAddingTag(false)}
                  />
                </form>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs border border-dashed text-muted-foreground"
                  onClick={() => setIsAddingTag(true)}
                >
                  <Plus size={12} className="mr-1" /> Add Tag
                </Button>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t text-sm">
              <div className="flex items-center text-muted-foreground">
                <Phone className="w-4 h-4 mr-3" />
                <span className="text-gray-900">{customer.phone}</span>
                {customer.altPhone && <span className="ml-2 text-xs">(Alt: {customer.altPhone})</span>}
              </div>
              <div className="flex items-center text-muted-foreground">
                <Mail className="w-4 h-4 mr-3" />
                <span className="text-gray-900">{customer.email || 'N/A'}</span>
              </div>
              <div className="flex items-start text-muted-foreground">
                <MapPin className="w-4 h-4 mr-3 mt-0.5" />
                <span className="text-gray-900">
                  {customer.address || 'N/A'}
                  {customer.area && `, ${customer.area}`}
                  {customer.district && `, ${customer.district}`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold">{customer.totalBookings}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Orders</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-emerald-600">{formatCurrency(customer.totalSpent)}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Spent</div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-amber-900">Internal Notes</h3>
              {!isEditingNotes && (
                <Button variant="ghost" size="sm" onClick={startEditingNotes} className="h-8 text-amber-700 hover:bg-amber-100 hover:text-amber-900">
                  Edit
                </Button>
              )}
            </div>
            
            {isEditingNotes ? (
              <div className="space-y-3">
                <Textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[120px] bg-white text-sm"
                  placeholder="Add notes about preferences, sizes, etc."
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleNotesSave} disabled={updateCustomer.isPending}>
                    {updateCustomer.isPending ? 'Saving...' : 'Save Notes'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-amber-800 whitespace-pre-wrap">
                {customer.notes || <span className="text-amber-600/60 italic">No internal notes for this customer.</span>}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: History */}
        <div className="col-span-1 md:col-span-2 space-y-4">
          <h3 className="text-xl font-bold">Booking History</h3>
          
          <div className="bg-white border text-sm rounded-xl overflow-hidden shadow-sm">
            {customer.bookings?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No bookings found for this customer.
              </div>
            ) : (
              <div className="divide-y">
                {customer.bookings?.map((booking: any) => (
                  <div key={booking.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-primary">{booking.bookingNumber}</span>
                        <Badge variant="outline" className={`
                          capitalize 
                          ${booking.status === 'completed' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : ''}
                          ${booking.status === 'cancelled' ? 'border-rose-200 text-rose-700 bg-rose-50' : ''}
                        `}>
                          {booking.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Clock size={12} />
                        {format(new Date(booking.createdAt), 'MMM d, yyyy h:mm a')}
                      </div>
                      <div className="mt-2 text-xs font-medium text-gray-700">
                        {booking.items.map((item: any, i: number) => (
                          <span key={i}>
                            {item.productName} {item.colorName ? `(${item.colorName})` : ''}
                            {i < booking.items.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-base">{formatCurrency(booking.grandTotal)}</div>
                      <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}>
                        View Order
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCustomer, useUpdateCustomer, useDeleteCustomer, useAddCustomerTag, useRemoveCustomerTag } from '../hooks/use-customers';
import { useStoreSettings } from '../../settings/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, MapPin, Mail, Phone, Clock, Plus, X, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UpdateCustomerDto } from '@closetrent/types';

export default function CustomerProfilePage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const { data: response, isLoading } = useCustomer(id);
  const { data: settingsResponse } = useStoreSettings();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const addTag = useAddCustomerTag();
  const removeTag = useRemoveCustomerTag();

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // S2: Delete confirmation state
  const [deleteOpen, setDeleteOpen] = useState(false);

  // S8: Edit customer dialog state
  const [editOpen, setEditOpen] = useState(false);

  // S10: Booking history - show more
  const [showAllBookings, setShowAllBookings] = useState(false);

  const customer = response?.data;
  const settings = settingsResponse?.data;

  // #14: Use currency from store settings, fallback to BDT
  const currencyCode = settings?.currencyCode || 'BDT';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // C2: Build address string from correct Prisma fields
  const buildAddress = () => {
    if (!customer) return null;
    const parts = [
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.state,
      customer.postalCode,
      customer.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

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

  // S2: Handle delete
  const handleDelete = () => {
    if (!customer) return;
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        router.push('/dashboard/customers');
      },
    });
  };

  // S8: Handle edit submit
  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customer) return;
    const form = new FormData(e.currentTarget);
    const payload: UpdateCustomerDto = {
      fullName: (form.get('fullName') as string) || undefined,
      altPhone: (form.get('altPhone') as string) || undefined,
      email: (form.get('email') as string) || undefined,
      addressLine1: (form.get('addressLine1') as string) || undefined,
      addressLine2: (form.get('addressLine2') as string) || undefined,
      city: (form.get('city') as string) || undefined,
      state: (form.get('state') as string) || undefined,
      postalCode: (form.get('postalCode') as string) || undefined,
      country: (form.get('country') as string) || undefined,
    };
    updateCustomer.mutate({ id: customer.id, payload }, {
      onSuccess: () => setEditOpen(false),
    });
  };

  // S10: Limit displayed bookings unless "show all" toggled
  const visibleBookings = showAllBookings
    ? customer?.bookings
    : customer?.bookings?.slice(0, 10);

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Loading profile...</div>;
  }

  if (!customer) {
    return (
      <div className="p-8 text-center text-destructive">
        <p>Customer not found.</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">Customer Profile</h2>
        </div>
        
        {/* S2 + S8: Action buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Details — S4: Fixed dark mode colors */}
        <div className="col-span-1 space-y-6">
          <div className="p-6 bg-card border rounded-xl shadow-sm space-y-4">
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

            {/* S4: Fixed - use text-foreground instead of text-gray-900 */}
            <div className="space-y-3 pt-4 border-t text-sm">
              <div className="flex items-center text-muted-foreground">
                <Phone className="w-4 h-4 mr-3 flex-shrink-0" />
                <span className="text-foreground">{customer.phone}</span>
                {customer.altPhone && <span className="ml-2 text-xs">(Alt: {customer.altPhone})</span>}
              </div>
              <div className="flex items-center text-muted-foreground">
                <Mail className="w-4 h-4 mr-3 flex-shrink-0" />
                <span className="text-foreground">{customer.email || 'N/A'}</span>
              </div>

              {/* C2: Fixed — use correct Prisma address fields */}
              <div className="flex items-start text-muted-foreground">
                <MapPin className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-foreground">
                  {buildAddress() || 'N/A'}
                </span>
              </div>
            </div>

            {/* S4: Fixed - use bg-muted instead of bg-gray-50 */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="bg-muted p-3 rounded-lg text-center">
                <div className="text-2xl font-bold">{customer.totalBookings}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Orders</div>
              </div>
              <div className="bg-muted p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-emerald-600">{formatCurrency(customer.totalSpent)}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Spent</div>
              </div>
            </div>
          </div>

          {/* S4: Fixed - use theme tokens for notes section */}
          <div className="p-6 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">Internal Notes</h3>
              {!isEditingNotes && (
                <Button variant="ghost" size="sm" onClick={startEditingNotes} className="h-8 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-900 dark:hover:text-amber-100">
                  Edit
                </Button>
              )}
            </div>
            
            {isEditingNotes ? (
              <div className="space-y-3">
                <Textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[120px] bg-card text-sm"
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
              <p className="text-sm text-amber-800 dark:text-amber-200/80 whitespace-pre-wrap">
                {customer.notes || <span className="text-amber-600/60 dark:text-amber-400/40 italic">No internal notes for this customer.</span>}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: History */}
        <div className="col-span-1 md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Booking History</h3>
            {/* S10: Show count */}
            {customer.bookings?.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {customer.bookings.length} booking{customer.bookings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {/* S4: Fixed - use bg-card instead of bg-white */}
          <div className="bg-card border text-sm rounded-xl overflow-hidden shadow-sm">
            {customer.bookings?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No bookings found for this customer.
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {visibleBookings?.map((booking: any) => (
                    <div key={booking.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-primary">{booking.bookingNumber}</span>
                          <Badge variant="outline" className={`
                            capitalize 
                            ${booking.status === 'completed' ? 'border-emerald-200 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : ''}
                            ${booking.status === 'cancelled' ? 'border-rose-200 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' : ''}
                          `}>
                            {booking.status}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                          <Clock size={12} />
                          {format(new Date(booking.createdAt), 'MMM d, yyyy h:mm a')}
                        </div>
                        {/* S4: Fixed - use text-muted-foreground instead of text-gray-700 */}
                        <div className="mt-2 text-xs font-medium text-muted-foreground">
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

                {/* S10: Show more / Show less toggle for booking history */}
                {customer.bookings && customer.bookings.length > 10 && (
                  <div className="border-t p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllBookings(!showAllBookings)}
                      className="text-muted-foreground"
                    >
                      <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${showAllBookings ? 'rotate-180' : ''}`} />
                      {showAllBookings ? 'Show Less' : `Show All ${customer.bookings.length} Bookings`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* S2: Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{customer.fullName}</strong>? 
              This action cannot be undone. Customers with active bookings cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCustomer.isPending}
            >
              {deleteCustomer.isPending ? 'Deleting...' : 'Delete Customer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* S8: Edit customer dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information. Phone number cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-fullName">Full Name</Label>
                <Input id="edit-fullName" name="fullName" defaultValue={customer.fullName} minLength={2} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={customer.phone} disabled className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" name="email" type="email" defaultValue={customer.email || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-altPhone">Alt Phone</Label>
                <Input id="edit-altPhone" name="altPhone" defaultValue={customer.altPhone || ''} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-addressLine1">Address Line 1</Label>
              <Input id="edit-addressLine1" name="addressLine1" defaultValue={customer.addressLine1 || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-addressLine2">Address Line 2</Label>
              <Input id="edit-addressLine2" name="addressLine2" defaultValue={customer.addressLine2 || ''} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-city">City</Label>
                <Input id="edit-city" name="city" defaultValue={customer.city || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-state">State</Label>
                <Input id="edit-state" name="state" defaultValue={customer.state || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-postalCode">Postal Code</Label>
                <Input id="edit-postalCode" name="postalCode" defaultValue={customer.postalCode || ''} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-country">Country</Label>
              <Input id="edit-country" name="country" defaultValue={customer.country || ''} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateCustomer.isPending}>
                {updateCustomer.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

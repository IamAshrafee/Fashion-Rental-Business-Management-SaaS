'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useStaffList, useInviteStaff, useRemoveStaff, useUpdateStaff } from '../hooks/use-settings';
import { UserPlus, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/use-tenant';
import type { Staff } from '@closetrent/types';

const inviteSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(['manager', 'staff']),
  password: z.string().min(6, 'Must be at least 6 characters').optional(),
});

type InviteValues = z.infer<typeof inviteSchema>;

const editSchema = z.object({
  role: z.enum(['manager', 'staff']),
  isActive: z.boolean(),
});

type EditValues = z.infer<typeof editSchema>;

export default function StaffSettingsPage() {
  useTenant(); // used for future tenant-scoped branding
  const { data: response, isLoading } = useStaffList({ limit: 50 });
  const inviteStaff = useInviteStaff();
  const removeStaff = useRemoveStaff();
  
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Staff | null>(null);

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      role: 'staff',
      password: '',
    },
  });

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      role: 'staff',
      isActive: true,
    },
  });

  // We call the hook at component level with the editing member's ID
  const updateStaff = useUpdateStaff(editingMember?.id || '');

  const onSubmit = (data: InviteValues) => {
    inviteStaff.mutate(data, {
      onSuccess: () => {
        setIsInviteOpen(false);
        form.reset();
      }
    });
  };

  const onEditSubmit = (data: EditValues) => {
    if (!editingMember) return;
    updateStaff.mutate(data, {
      onSuccess: () => {
        setEditingMember(null);
        editForm.reset();
      },
    });
  };

  const openEditDialog = (member: Staff) => {
    setEditingMember(member);
    editForm.reset({
      role: member.role as 'manager' | 'staff',
      isActive: member.isActive,
    });
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const array = new Uint32Array(10);
    crypto.getRandomValues(array);
    const pass = Array.from(array, (n) => chars.charAt(n % chars.length)).join('');
    form.setValue('password', pass);
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md" />;
  }

  const staff = response?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">Staff Members</h3>
          <p className="text-sm text-muted-foreground">Manage who has access to your store and their permissions.</p>
        </div>
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="w-4 h-4"/>
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>
                They will be able to log in to this store based on the role assigned.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl><Input placeholder="E.g. Rashida" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl><Input placeholder="+8801..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl><Input placeholder="staff@store.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Profile *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a role"/></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manager">Manager (Full operational access)</SelectItem>
                          <SelectItem value="staff">Staff (Orders & viewing products only)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Password (Optional)</FormLabel>
                      <div className="flex gap-2">
                        <FormControl><Input placeholder="User must change it" {...field} /></FormControl>
                        <Button type="button" variant="outline" onClick={generatePassword}>Generate</Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={inviteStaff.isPending}>
                    {inviteStaff.isPending ? 'Sending Invite...' : 'Create Account'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <Separator />

      {/* ── Edit Staff Dialog ── */}
      <Dialog open={!!editingMember} onOpenChange={(open) => { if (!open) setEditingMember(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update {editingMember?.fullName}&apos;s role and access status.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6 pt-4">
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manager">Manager (Full operational access)</SelectItem>
                        <SelectItem value="staff">Staff (Orders & viewing products only)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">Active Status</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Inactive members cannot log in or access the store.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateStaff.isPending}>
                  {updateStaff.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {staff.map((member) => (
          <div key={member.id} className="p-4 border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                {member.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{member.fullName}</h4>
                  {member.role === 'owner' && <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">Owner</Badge>}
                  {member.role === 'manager' && <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">Manager</Badge>}
                  {member.role === 'staff' && <Badge variant="secondary">Staff</Badge>}
                  {!member.isActive && <Badge variant="destructive">Inactive</Badge>}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5 space-x-2">
                  {member.email && <span>{member.email}</span>}
                  {member.phone && <span>{member.phone}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {member.lastLoginAt ? 
                    <>Last active: {format(new Date(member.lastLoginAt), 'MMM d, yyyy h:mm a')}</> : 
                    <>Never logged in</>
                  }
                </div>
              </div>
            </div>

            <div className="flex border rounded-md shadow-sm overflow-hidden">
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-none border-r" 
                disabled={member.role === 'owner'}
                onClick={() => openEditDialog(member)}
              >
                <Edit2 className="w-4 h-4 mr-2"/> Edit
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-none text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive" 
                disabled={member.role === 'owner' || removeStaff.isPending}
                onClick={() => {
                  if (confirm(`Remove ${member.fullName} from your staff?`)) {
                    removeStaff.mutate(member.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4"/>
              </Button>
            </div>
          </div>
        ))}
        
        {staff.length === 0 && (
          <div className="text-center py-8 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
            No staff members. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Copy, Edit2, Link2, Trash2, UserPlus, X } from 'lucide-react';
import type { Staff, StaffPermission } from '@closetrent/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  useInviteStaff,
  useRemoveStaff,
  useRevokeStaffInvitation,
  useStaffInvitations,
  useStaffList,
  useUpdateStaff,
} from '../hooks/use-settings';

const permissionOptions: Array<{ value: StaffPermission; label: string }> = [
  { value: 'manage_products', label: 'Products' },
  { value: 'manage_inventory', label: 'Inventory' },
  { value: 'manage_bookings', label: 'Bookings' },
  { value: 'manage_fulfillment', label: 'Fulfillment' },
  { value: 'view_customers', label: 'View customers' },
  { value: 'manage_customers', label: 'Edit customers' },
  { value: 'view_analytics', label: 'Analytics' },
  { value: 'manage_finance', label: 'Payments & COD' },
];

const managerPermissions = permissionOptions.map(({ value }) => value);
const staffPermissions: StaffPermission[] = [
  'manage_products',
  'manage_inventory',
  'manage_bookings',
  'manage_fulfillment',
  'view_customers',
];

const inviteSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Name is required'),
    email: z.string().email('Enter a valid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    role: z.enum(['manager', 'staff']),
    permissions: z.array(
      z.enum([
        'manage_products',
        'manage_inventory',
        'manage_bookings',
        'manage_fulfillment',
        'view_customers',
        'manage_customers',
        'view_analytics',
        'manage_finance',
      ]),
    ),
  })
  .refine((value) => Boolean(value.email?.trim() || value.phone?.trim()), {
    message: 'Phone or email is required',
    path: ['phone'],
  });

const editSchema = z.object({
  role: z.enum(['manager', 'staff']),
  isActive: z.boolean(),
  permissions: z.array(
    z.enum([
      'manage_products',
      'manage_inventory',
      'manage_bookings',
      'manage_fulfillment',
      'view_customers',
      'manage_customers',
      'view_analytics',
      'manage_finance',
    ]),
  ),
});

type InviteValues = z.infer<typeof inviteSchema>;
type EditValues = z.infer<typeof editSchema>;

function PermissionFields({
  selected,
  onChange,
}: {
  selected: StaffPermission[];
  onChange: (permissions: StaffPermission[]) => void;
}) {
  return (
    <div className="space-y-2">
      <FormLabel>Access</FormLabel>
      <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
        {permissionOptions.map((permission) => (
          <label key={permission.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(permission.value)}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selected, permission.value]
                  : selected.filter((value) => value !== permission.value);
                onChange(next);
              }}
            />
            {permission.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function StaffSettingsPage() {
  const { data: response, isLoading } = useStaffList({ limit: 50 });
  const { data: invitationResponse } = useStaffInvitations();
  const inviteStaff = useInviteStaff();
  const removeStaff = useRemoveStaff();
  const revokeInvitation = useRevokeStaffInvitation();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Staff | null>(null);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      role: 'staff',
      permissions: staffPermissions,
    },
  });
  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { role: 'staff', isActive: true, permissions: staffPermissions },
  });
  const updateStaff = useUpdateStaff(editingMember?.id || '');

  const onSubmit = (values: InviteValues) => {
    inviteStaff.mutate(
      { ...values, email: values.email || undefined, phone: values.phone || undefined },
      {
        onSuccess: (result) => {
          const link = `${window.location.origin}/staff/accept?token=${encodeURIComponent(result.data.token)}`;
          setInvitationLink(link);
          form.reset();
        },
      },
    );
  };

  const openEditDialog = (member: Staff) => {
    setEditingMember(member);
    editForm.reset({
      role: member.role as 'manager' | 'staff',
      isActive: member.isActive,
      permissions: member.permissions,
    });
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  const staff = response?.data || [];
  const pendingInvitations = (invitationResponse?.data || []).filter(
    (item) => !item.acceptedAt && !item.revokedAt && new Date(item.expiresAt) > new Date(),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Team access</h3>
          <p className="text-sm text-muted-foreground">
            Invite staff without sharing passwords and give each person only the access they need.
          </p>
        </div>
        <Dialog
          open={isInviteOpen}
          onOpenChange={(open) => {
            setIsInviteOpen(open);
            if (!open) setInvitationLink(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {invitationLink ? 'Invitation ready' : 'Invite a team member'}
              </DialogTitle>
              <DialogDescription>
                {invitationLink
                  ? 'Copy this single-use link. It expires in seven days.'
                  : 'The team member chooses their own password when accepting.'}
              </DialogDescription>
            </DialogHeader>
            {invitationLink ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input readOnly value={invitationLink} />
                  <Button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(invitationLink);
                      toast.success('Invitation link copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setIsInviteOpen(false);
                    setInvitationLink(null);
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Rashida Akter" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+8801..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="staff@store.com" {...field} />
                          </FormControl>
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
                        <FormLabel>Role profile</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value: 'manager' | 'staff') => {
                            field.onChange(value);
                            form.setValue(
                              'permissions',
                              value === 'manager' ? managerPermissions : staffPermissions,
                            );
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <PermissionFields
                    selected={form.watch('permissions')}
                    onChange={(permissions) =>
                      form.setValue('permissions', permissions, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  <Button className="w-full" type="submit" disabled={inviteStaff.isPending}>
                    {inviteStaff.isPending ? 'Creating invitation…' : 'Create invitation link'}
                  </Button>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {pendingInvitations.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
          <h4 className="text-sm font-medium">Pending invitations</h4>
          {pendingInvitations.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <span className="font-medium">{item.fullName}</span>
                <span className="ml-2 text-muted-foreground">
                  expires {format(new Date(item.expiresAt), 'MMM d')}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revokeInvitation.mutate(item.id)}
                disabled={revokeInvitation.isPending}
              >
                <X className="mr-1 h-4 w-4" />
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
      <Separator />

      <Dialog
        open={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) setEditingMember(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit access</DialogTitle>
            <DialogDescription>
              Update {editingMember?.fullName}&apos;s operational access.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit((values) =>
                updateStaff.mutate(values, { onSuccess: () => setEditingMember(null) }),
              )}
              className="space-y-5"
            >
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role profile</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value: 'manager' | 'staff') => {
                        field.onChange(value);
                        editForm.setValue(
                          'permissions',
                          value === 'manager' ? managerPermissions : staffPermissions,
                        );
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <PermissionFields
                selected={editForm.watch('permissions')}
                onChange={(permissions) =>
                  editForm.setValue('permissions', permissions, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <FormLabel>Active access</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Turning this off immediately revokes store sessions.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button className="w-full" type="submit" disabled={updateStaff.isPending}>
                Save access
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {staff.map((member) => (
          <div
            key={member.id}
            className="flex flex-col justify-between gap-4 rounded-lg border p-4 md:flex-row md:items-center"
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                {member.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">{member.fullName}</h4>
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                    {member.role}
                  </Badge>
                  {!member.isActive && <Badge variant="destructive">Inactive</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{member.email || member.phone}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {member.lastLoginAt
                    ? `Last active ${format(new Date(member.lastLoginAt), 'MMM d, yyyy h:mm a')}`
                    : 'Never logged in'}{' '}
                  ·{' '}
                  {member.permissions.length || (member.role === 'owner' ? 'All' : 'Role default')}{' '}
                  scopes
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={member.role === 'owner'}
                onClick={() => openEditDialog(member)}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={member.role === 'owner' || removeStaff.isPending}
                onClick={() => {
                  if (confirm(`Remove ${member.fullName} from your team?`))
                    removeStaff.mutate(member.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {staff.length === 0 && (
          <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
            <Link2 className="mx-auto mb-2 h-5 w-5" />
            No team members yet.
          </div>
        )}
      </div>
    </div>
  );
}

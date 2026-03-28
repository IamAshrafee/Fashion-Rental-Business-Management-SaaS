'use client';

import React from 'react';
import { useListMySessions, useListTenantSessions, useRevokeSession, useRevokeAllOtherSessions } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, Laptop, LogOut, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function SessionsSettingsPage() {
  const { user } = useAuth();
  const { data: tenantSessionsRes, isLoading: isTenantLoading } = useListTenantSessions();
  
  // Also get "my" sessions explicitly to power the "Revoke All Others" efficiently
  const { data: mySessionsRes, isLoading: isMyLoading } = useListMySessions();
  
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeAllOtherSessions();

  const isLoading = isTenantLoading || isMyLoading;

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md" />;
  }

  const allSessions = tenantSessionsRes?.data || [];
  const mySessionsCount = mySessionsRes?.data?.length || 0;

  const getDeviceIcon = (type: string) => {
    switch(type) {
      case 'mobile': return <Smartphone className="w-5 h-5 text-gray-500"/>
      case 'desktop': return <Monitor className="w-5 h-5 text-gray-500"/>
      case 'tablet': return <Laptop className="w-5 h-5 text-gray-500"/>
      default: return <Monitor className="w-5 h-5 text-gray-500"/>
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium">Session Management</h3>
          <p className="text-sm text-muted-foreground">Manage devices currently logged into your store.</p>
        </div>
        
        {mySessionsCount > 1 && (
          <Button 
            variant="outline" 
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={() => {
              if (confirm('This will end all sessions associated with your account on other devices. Continue?')) {
                revokeOthers.mutate();
              }
            }}
            disabled={revokeOthers.isPending}
          >
            <ShieldAlert className="w-4 h-4 mr-2"/>
            Revoke Other Devices
          </Button>
        )}
      </div>
      <Separator />

      <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">Active Sessions Across Store</h4>

      <div className="space-y-4">
        {allSessions.map((session) => {
          const isMe = session.userId === user?.id;
          return (
            <div key={session.id} className="p-4 border rounded-lg flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2 border rounded-md shadow-sm bg-muted/20">
                  {getDeviceIcon(session.deviceType)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">
                      {session.browser || 'Unknown Client'} / {session.os || 'Unknown OS'}
                    </h4>
                    {session.isCurrentSession && <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Current Device</Badge>}
                    {!isMe && <Badge variant="outline">{session.userId.slice(-6)} (Staff)</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5 space-x-2">
                    {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                    {session.location && <span>• {session.location}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Last activity {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                  </div>
                </div>
              </div>

              {!session.isCurrentSession && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive"
                        disabled={revokeSession.isPending}
                        onClick={() => {
                          if (confirm(`Revoke this session? The device will instantly be logged out.`)) {
                            revokeSession.mutate({ id: session.id, isStaff: !isMe });
                          }
                        }}
                      >
                        <LogOut className="w-4 h-4"/>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Log out this device
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        })}

        {allSessions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
            No active sessions found (Wait, you&apos;re looking at this!).
          </div>
        )}
      </div>
    </div>
  );
}

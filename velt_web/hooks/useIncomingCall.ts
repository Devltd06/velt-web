import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';

export type IncomingCall = {
  notificationId: string;
  conversationId: string;
  mode: 'voice' | 'video';
  callerId: string;
  callerName?: string | null;
  callerAvatar?: string | null;
  callerUsername?: string | null;
  message?: string | null;
  createdAt: string;
};

const CALL_TYPES = ['voice_call', 'video_call'];

const normalizeMode = (raw?: string | null): 'voice' | 'video' => {
  return raw === 'video_call' || raw === 'video' ? 'video' : 'voice';
};

const formatCallPayload = (row: any): IncomingCall | null => {
  if (!row) return null;
  if (!CALL_TYPES.includes(row.type)) return null;
  const data = row.data ?? {};
  const conversationId = data?.conversation_id ?? data?.conversationId ?? row.data?.conversation ?? null;
  if (!conversationId) return null;
  return {
    notificationId: row.id,
    conversationId,
    mode: normalizeMode(data?.call_mode || row.type),
    callerId: row.actor,
    callerName: row.title,
    message: row.body,
    createdAt: row.created_at,
  };
};

export function useIncomingCall() {
  const { profile } = useProfileStore();
  const userId = profile?.id ?? null;
  const [call, setCall] = useState<IncomingCall | null>(null);
  const loadingRef = useRef(false);

  const loadCallerProfile = useCallback(async (incoming: IncomingCall) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', incoming.callerId)
        .maybeSingle();
      if (data) {
        setCall((prev) => {
          if (!prev || prev.notificationId !== incoming.notificationId) return prev;
          return {
            ...prev,
            callerName: data.full_name || prev.callerName,
            callerUsername: data.username ?? prev.callerUsername,
            callerAvatar: data.avatar_url ?? prev.callerAvatar,
          };
        });
      }
    } catch (error) {
      console.warn('load caller profile failed', error);
    }
  }, []);

  const hydratePending = useCallback(async () => {
    if (!userId || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient', userId)
        .eq('is_read', false)
        .in('type', CALL_TYPES)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const callRow = formatCallPayload(data[0]);
        if (callRow) {
          setCall(callRow);
          loadCallerProfile(callRow);
        }
      } else {
        setCall(null);
      }
    } catch (error) {
      console.warn('hydrate incoming call failed', error);
    } finally {
      loadingRef.current = false;
    }
  }, [loadCallerProfile, userId]);

  useEffect(() => {
    hydratePending();
  }, [hydratePending]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`incoming-call-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient=eq.${userId}` },
        (payload) => {
          const incoming = formatCallPayload(payload.new);
          if (incoming) {
            setCall(incoming);
            loadCallerProfile(incoming);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient=eq.${userId}` },
        (payload) => {
          if (!call) return;
          if (payload.new.id === call.notificationId && payload.new.is_read) {
            setCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [call, loadCallerProfile, userId]);

  const markNotification = useCallback(async (notificationId: string, patch: Record<string, any>) => {
    try {
      await supabase.from('notifications').update(patch).eq('id', notificationId);
    } catch (error) {
      console.warn('mark notification failed', error);
    }
  }, []);

  const decline = useCallback(async () => {
    if (!call) return;
    const currentId = call.notificationId;
    setCall(null);
    await markNotification(currentId, { is_read: true, read: true, processed: true, title: call.callerName });
  }, [call, markNotification]);

  const accept = useCallback(async () => {
    if (!call) return null;
    const accepted = call;
    setCall(null);
    await markNotification(accepted.notificationId, { is_read: true, read: true, processed: true });
    return accepted;
  }, [call, markNotification]);

  return { call, accept, decline };
}

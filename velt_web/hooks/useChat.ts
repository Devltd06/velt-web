// src/hooks/useChat.ts
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url?: string | null;
  media_type?: string | null;
  mime?: string | null;
  reply_to_message_id?: string | null;
  location?: Record<string, any> | null;
  latitude?: number | null;
  longitude?: number | null;
  location_text?: string | null;
  created_at: string;
};

export type SendMessagePayload = {
  conversation_id: string;
  sender_id: string;
  content?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  mime?: string | null;
  reply_to_message_id?: string | null;
  location?: Record<string, any> | null;
  latitude?: number | null;
  longitude?: number | null;
  location_text?: string | null;
};

export function useChat(conversationId: string | null, limit = 50) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!conversationId) return;

    let isMounted = true;

    // Load latest messages
    (async () => {
      const { data, error } = await supabase
        .from<MessageRow>('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Error loading messages', error);
        return;
      }
      if (isMounted) setMessages(data ?? []);
    })();

    // Subscribe to new messages in this conversation
    channelRef.current = supabase
      .channel(`public:messages:conversation_id=eq.${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          setMessages(prev => [newMsg, ...prev]);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId]);

  async function sendMessage(payload: SendMessagePayload) {
    const { error } = await supabase.from('messages').insert([payload]);
    if (error) console.warn('sendMessage error', error);
    return error;
  }

  return { messages, sendMessage };
}

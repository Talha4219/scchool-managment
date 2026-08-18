"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getSession } from "@/app/actions/auth";
import { formatDayMonthPK } from "@/lib/date-format";
import {
  fetchMessagingContactsDB, fetchConversationsDB, fetchMessagesDB, sendMessageDB,
  type MessagingContact, type ConversationSummary, type MessageItem,
} from "@/app/actions/messaging";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { Search, Send, Plus, MessageSquare } from "lucide-react";

const POLL_MS = 20000;

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h`;
  return formatDayMonthPK(d);
}

export default function MessagesPage() {
  const { can, loaded: permsLoaded } = usePermission();
  const [sessionUserId, setSessionUserId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [pendingContact, setPendingContact] = useState<MessagingContact | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);

  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<MessagingContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { getSession().then(s => setSessionUserId(s?.userId ?? null)); }, []);

  const loadConversations = useCallback(async () => {
    const data = await fetchConversationsDB();
    setConversations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, POLL_MS);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const loadMessages = useCallback(async () => {
    if (!selectedConversationId) return;
    const res = await fetchMessagesDB(selectedConversationId);
    if (res.messages) setMessages(res.messages);
    loadConversations(); // reading clears unread — refresh the list badge too
  }, [selectedConversationId, loadConversations]);

  useEffect(() => {
    setMessages([]);
    if (!selectedConversationId) return;
    loadMessages();
    const interval = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  const openNewMessage = async () => {
    setContactsOpen(true);
    setContacts(await fetchMessagingContactsDB());
  };

  const selectContact = (c: MessagingContact) => {
    // Reuse an existing conversation with this contact if one already exists.
    const existing = conversations.find(cv => cv.otherUserId === c.userId);
    if (existing) {
      setSelectedConversationId(existing.conversationId);
      setPendingContact(null);
    } else {
      setSelectedConversationId(null);
      setPendingContact(c);
      setMessages([]);
    }
    setContactsOpen(false);
  };

  const handleSend = async () => {
    const recipientId = pendingContact?.userId ?? conversations.find(c => c.conversationId === selectedConversationId)?.otherUserId;
    if (!recipientId || !composer.trim()) return;
    setSending(true);
    const res = await sendMessageDB(recipientId, composer.trim());
    setSending(false);
    if (res.error || !res.conversationId) return;
    setComposer("");
    setPendingContact(null);
    setSelectedConversationId(res.conversationId);
    await loadConversations();
    await loadMessages();
  };

  const filteredConversations = useMemo(() =>
    conversations.filter(c => c.otherUserName.toLowerCase().includes(search.toLowerCase())),
    [conversations, search]
  );
  const filteredContacts = useMemo(() =>
    contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())),
    [contacts, contactSearch]
  );

  const activeName = pendingContact?.name
    ?? conversations.find(c => c.conversationId === selectedConversationId)?.otherUserName
    ?? null;

  if (!permsLoaded) return null;
  if (!can("messages.view")) return <Unauthorized />;

  if (loading) {
    return (
      <div className="h-[calc(100vh-140px)] flex gap-4">
        <div className="w-80 shrink-0 soft-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="p-3">
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <div className="px-2 pb-2 space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-3 rounded-2xl flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 soft-card flex items-center justify-center">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex gap-4">
      {/* Conversation list */}
      <div className="w-80 shrink-0 soft-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <h1 className="text-base font-bold text-foreground">Messages</h1>
          <Button size="icon" className="h-8 w-8 rounded-full" onClick={openNewMessage}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..." className="pl-8 h-9 text-sm bg-secondary/50 border-0 rounded-xl" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No conversations yet.</div>
          ) : (
            <div className="px-2 pb-2 space-y-1">
              {filteredConversations.map(c => (
                <button
                  key={c.conversationId}
                  onClick={() => { setSelectedConversationId(c.conversationId); setPendingContact(null); }}
                  className={`w-full text-left p-3 rounded-2xl transition-colors ${selectedConversationId === c.conversationId ? "bg-primary/10" : "hover:bg-secondary/50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{c.otherUserName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">{c.lastMessage || "No messages yet"}</p>
                    {c.unreadCount > 0 && <Badge className="h-5 min-w-5 px-1.5 rounded-full text-[10px] shrink-0">{c.unreadCount}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Thread */}
      <div className="flex-1 soft-card flex flex-col overflow-hidden">
        {!activeName ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Select a conversation or start a new one.</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-border">
              <p className="text-sm font-bold text-foreground">{activeName}</p>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${m.mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                      {m.body}
                      <p className={`text-[10px] mt-1 ${m.mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{timeAgo(m.sentAt)}</p>
                    </div>
                  </div>
                ))}
                {pendingContact && messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Start the conversation with {pendingContact.name}.</p>
                )}
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border flex items-center gap-2">
              <Input
                value={composer}
                onChange={e => setComposer(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message..."
                className="flex-1 h-10 rounded-full bg-secondary/50 border-0"
              />
              <Button size="icon" className="h-10 w-10 rounded-full shrink-0" disabled={!composer.trim() || sending} onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* New Message contact picker */}
      <Dialog open={contactsOpen} onOpenChange={setContactsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Search contacts..." className="pl-8 h-9 text-sm" />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {filteredContacts.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No contacts available.</p>}
            {filteredContacts.map(c => (
              <button key={c.userId} onClick={() => selectContact(c)} className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left">
                <span className="text-sm font-medium text-foreground">{c.name}</span>
                <Badge variant="outline" className="text-[10px]">{c.role}</Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

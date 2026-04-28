import { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, MessageCircle, Search, User, Plus } from 'lucide-react';
import { supabase, Member, DirectMessage } from '../lib/supabase';

interface ChatProps {
  currentMemberId: string;
  targetMemberId: string;
  onBack: () => void;
}

/**
 * ChatScreen: Aktif mesajlaşma penceresi
 */
function ChatScreen({ currentMemberId, targetMemberId, onBack }: ChatProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [targetMember, setTargetMember] = useState<Member | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data: member } = await supabase.from('members').select('*').eq('id', targetMemberId).single();
      if (member) setTargetMember(member as Member);

      const { data: msgs } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${currentMemberId},receiver_id.eq.${targetMemberId}),and(sender_id.eq.${targetMemberId},receiver_id.eq.${currentMemberId})`)
        .order('created_at', { ascending: true });
      if (msgs) setMessages(msgs as DirectMessage[]);
    };
    loadData();

    const channel = supabase.channel(`chat_${targetMemberId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, 
      payload => {
        const msg = payload.new as DirectMessage;
        if ((msg.sender_id === targetMemberId && msg.receiver_id === currentMemberId) ||
            (msg.sender_id === currentMemberId && msg.receiver_id === targetMemberId)) {
          setMessages(prev => [...prev, msg]);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [targetMemberId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const { error } = await supabase.from('direct_messages').insert({
      sender_id: currentMemberId,
      receiver_id: targetMemberId,
      content: newMessage.trim()
    });
    if (!error) setNewMessage('');
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
      <div className="p-4 border-b bg-slate-50 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ArrowLeft size={20}/></button>
        <h3 className="font-bold text-slate-800">{targetMember?.full_name}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_id === currentMemberId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${msg.sender_id === currentMemberId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none shadow-sm border'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
        <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Mesaj yazın..." className="flex-1 bg-slate-100 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        <button className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"><Send size={20}/></button>
      </form>
    </div>
  );
}

/**
 * Messages: Ana mesajlaşma listesi
 */
export default function Messages({ currentMemberId }: { currentMemberId: string }) {
  const [view, setView] = useState<'conversations' | 'new'>('conversations');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConversations = async () => {
      setLoading(true);
      // Mevcut konuşmaları çek
      const { data: messages } = await supabase
        .from('direct_messages')
        .select('sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${currentMemberId},receiver_id.eq.${currentMemberId}`)
        .order('created_at', { ascending: false });

      const partnerIds = new Set<string>();
      const lastMsgs = new Map();

      messages?.forEach(m => {
        const partnerId = m.sender_id === currentMemberId ? m.receiver_id : m.sender_id;
        if (!partnerIds.has(partnerId)) {
          partnerIds.add(partnerId);
          lastMsgs.set(partnerId, m);
        }
      });

      if (partnerIds.size > 0) {
        const { data: partners } = await supabase.from('members').select('id, full_name').in('id', Array.from(partnerIds));
        const list = partners?.map(p => ({ ...p, lastMessage: lastMsgs.get(p.id) })) || [];
        setConversations(list);
      }
      setLoading(false);
    };

    if (view === 'conversations') loadConversations();
    else {
      const loadAll = async () => {
        const { data } = await supabase.from('members').select('*').neq('id', currentMemberId).eq('is_active', true);
        if (data) setMembers(data as Member[]);
      };
      loadAll();
    }
  }, [view, currentMemberId]);

  if (selectedId) return <ChatScreen currentMemberId={currentMemberId} targetMemberId={selectedId} onBack={() => setSelectedId(null)} />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        {/* Sol üstteki Yeni Mesaj butonu */}
        <button 
          onClick={() => setView(view === 'conversations' ? 'new' : 'conversations')}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all shadow-md text-sm font-bold"
        >
          {view === 'conversations' ? <><Plus size={18}/> Yeni Mesaj</> : <><ArrowLeft size={18}/> Geri</>}
        </button>
        <h2 className="text-2xl font-black text-slate-800">
          {view === 'conversations' ? 'Mesajlarım' : 'Yeni Sohbet Başlat'}
        </h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium">Yükleniyor...</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {(view === 'conversations' ? conversations : members).map(item => (
              <button 
                key={item.id} 
                onClick={() => setSelectedId(item.id)}
                className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg">
                    {item.full_name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{item.full_name}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">
                      {view === 'conversations' ? item.lastMessage?.content : 'Yeni bir sohbet başlatmak için tıklayın'}
                    </p>
                  </div>
                </div>
                {view === 'conversations' && (
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(item.lastMessage?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </button>
            ))}
            {(view === 'conversations' ? conversations : members).length === 0 && (
              <div className="p-12 text-center text-slate-400">
                {view === 'conversations' ? 'Henüz mesaj geçmişiniz bulunmuyor.' : 'Üye bulunamadı.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
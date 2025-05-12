import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Phone, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CallHistoryItem {
  id: string;
  user_id: string;
  peer_id: string;
  type: string;
  status: string;
  timestamp: string;
  chat_id?: string;
  duration?: number;
  peer?: {
    username?: string;
    full_name?: string;
    avatar?: string;
  };
}

export default function CallHistory() {
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line
  }, [user]);

  async function fetchHistory() {
    if (!user?.id) return;
    setLoading(true);
    // 1. Fetch call history (no join)
    const { data: calls, error } = await supabase
      .from('call_history')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });
    if (error || !calls) {
      setHistory([]);
      setLoading(false);
      return;
    }
    // 2. Fetch peer profiles for all unique peer_ids
    const peerIds = Array.from(new Set(calls.map(call => call.peer_id)));
    let profilesMap: Record<string, { username?: string; full_name?: string; avatar?: string }> = {};
    if (peerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', peerIds);
      if (profiles) {
        profilesMap = Object.fromEntries(
          profiles.map((p: any) => [p.id, { username: p.username, full_name: p.full_name, avatar: p.avatar_url }])
        );
      }
    }
    // 3. Merge peer info into call history
    const merged = calls.map(call => ({
      ...call,
      peer: profilesMap[call.peer_id] || undefined
    }));
    // Only show the most recent entry per chat_id and peer_id
    const uniqueHistory = [];
    const seen = new Set();
    for (const call of merged) {
      const key = `${call.chat_id || ''}_${call.peer_id}`;
      if (!seen.has(key)) {
        uniqueHistory.push(call);
        seen.add(key);
      }
    }
    setHistory(uniqueHistory);
    setLoading(false);
  }

  async function deleteCall(id: string) {
    await supabase.from('call_history').delete().eq('id', id);
    setHistory(h => h.filter(call => call.id !== id));
  }

  async function deleteAllCalls() {
    if (!user?.id) return;
    await supabase.from('call_history').delete().eq('user_id', user.id);
    setHistory([]);
  }

  function handleCall(chat_id: string | undefined, peer_id: string) {
    if (chat_id) {
      navigate(`/chat/${chat_id}?call=1`);
    } else {
      navigate(`/chat?startCallWith=${peer_id}`);
    }
  }

  function handlePeerClick(peer_id: string) {
    navigate(`/profile/${peer_id}`);
  }

  return (
    <div className="p-2 sm:p-6 max-w-2xl mx-auto">
      {/* Header with back button */}
      <div className="flex items-center mb-2 sm:mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Call History</h1>
        <div className="flex-1" />
        {history.length > 0 && (
          <Button variant="destructive" size="sm" onClick={deleteAllCalls}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete All
          </Button>
        )}
      </div>
      {loading ? (
        <div className="flex justify-center items-center min-h-[200px]">Loading...</div>
      ) : history.length === 0 ? (
        <div className="flex justify-center items-center min-h-[200px]">No call history found.</div>
      ) : (
        <ul className="space-y-3">
          {history.map(call => {
            const displayName = call.peer?.full_name || call.peer?.username;
            const avatarLetter = (call.peer?.full_name || call.peer?.username || 'U')[0];
            return (
              <li key={call.id} className="bg-zinc-800/80 rounded-xl shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border border-zinc-700">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={call.peer?.avatar || undefined} alt={displayName || call.peer_id} />
                    <AvatarFallback>{avatarLetter}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold capitalize truncate">
                      {call.type} call with{' '}
                      <span
                        className={`font-semibold ${displayName ? 'text-yuhu-primary cursor-pointer hover:underline' : 'text-gray-400'}`}
                        onClick={displayName ? () => handlePeerClick(call.peer_id) : undefined}
                        title={displayName || call.peer_id}
                      >
                        {displayName || call.peer_id}
                      </span>
                      <span className="ml-2 text-sm text-gray-400">({call.status})</span>
                    </div>
                    <div className="text-sm text-gray-400 truncate">
                      {new Date(call.timestamp).toLocaleString()} {call.duration ? `- ${Math.floor(call.duration/60)}m ${call.duration%60}s` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <Button size="icon" variant="ghost" title="Call again" onClick={() => handleCall(call.chat_id, call.peer_id)}>
                    <Phone className="h-5 w-5 text-green-500" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Delete" onClick={() => deleteCall(call.id)}>
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
} 
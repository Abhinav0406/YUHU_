
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import ChatList from '@/components/ChatList';
import ChatWindow from '@/components/ChatWindow';

const Chat = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [activeChatId, setActiveChatId] = useState<string | undefined>(chatId);
  
  return (
    <Layout requireAuth={true}>
      <div className="h-[calc(100vh-64px)] flex overflow-hidden">
        <div className="w-full md:w-1/3 lg:w-1/4 border-r h-full bg-white/50">
          <div className="p-3">
            <h2 className="text-xl font-bold text-yuhu-primary mb-2 px-2">Messages</h2>
          </div>
          <ChatList activeChatId={activeChatId} onChatSelect={setActiveChatId} />
        </div>
        
        <div className="hidden md:flex md:w-2/3 lg:w-3/4 h-full flex-col">
          <ChatWindow chatId={activeChatId} />
        </div>
      </div>
    </Layout>
  );
};

export default Chat;

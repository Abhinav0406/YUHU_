import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface MessageProps {
  id: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    avatar: string;
  };
  text: string;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  isFirst?: boolean;
  isConsecutive?: boolean;
}

const Message: React.FC<MessageProps> = ({
  senderId,
  sender,
  text,
  time,
  status = 'sent',
  isFirst = true,
  isConsecutive = false,
}) => {
  const { user } = useAuth();
  const isMe = senderId === user?.id;
  
  return (
    <div
      className={cn(
        "flex w-full mb-1",
        isMe ? "justify-end" : "justify-start"
      )}
    >
      {!isMe && isFirst && (
        <div className="flex-shrink-0 mr-2 mt-auto">
          <Avatar className="h-7 w-7">
            <AvatarImage src={sender.avatar} alt={sender.name} />
            <AvatarFallback>{sender.name[0]}</AvatarFallback>
          </Avatar>
        </div>
      )}
      
      {!isMe && !isFirst && <div className="w-7 mr-2" />}
      
      <div className={cn("flex flex-col", isMe && "items-end")}>
        {isFirst && !isMe && (
          <div className="text-xs text-muted-foreground ml-1 mb-0.5">
            {sender.name}
          </div>
        )}
        
        <div className="flex items-end gap-1">
          <div
            className={cn(
              "chat-bubble",
              isMe ? "chat-bubble-sent" : "chat-bubble-received",
              isConsecutive && isMe && "rounded-tr-md",
              isConsecutive && !isMe && "rounded-tl-md",
            )}
          >
            <p className="text-sm">{text}</p>
          </div>
        </div>
        
        <div
          className={cn(
            "flex items-center gap-1 text-[10px] px-2",
            isMe ? "justify-end text-muted-foreground" : "justify-start text-muted-foreground"
          )}
        >
          <span>{time}</span>
          {isMe && status === 'read' && (
            <span className="text-yuhu-primary">• Read</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;

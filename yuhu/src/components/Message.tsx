import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MoreVertical, Trash2, Play, Pause } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteMessage } from '@/services/chatService';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

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
  chatId: string;
  type?: string;
}

const Message: React.FC<MessageProps> = ({
  id,
  senderId,
  sender,
  text,
  time,
  status = 'sent',
  isFirst = true,
  isConsecutive = false,
  chatId,
  type = 'text'
}) => {
  const { user } = useAuth();
  const isMe = senderId === user?.id;
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<string>('');
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (type === 'voice' && text) {
      const audio = new window.Audio(text);
      audio.addEventListener('loadedmetadata', () => {
        const dur = audio.duration;
        if (!isNaN(dur)) {
          const mins = Math.floor(dur / 60);
          const secs = Math.floor(dur % 60);
          setDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
        }
      });
      // Preload metadata
      audio.load();
    }
  }, [type, text]);

  const deleteMessageMutation = useMutation({
    mutationFn: () => deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      setIsDeleteDialogOpen(false);
    },
  });

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(text);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const renderMessageContent = () => {
    if (type === 'voice') {
      return (
        <div className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-zinc-900 rounded-xl border border-yuhu-primary/30 max-w-xs md:max-w-md">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-white dark:bg-zinc-800 border border-yuhu-primary text-yuhu-primary shadow"
            onClick={togglePlay}
            style={{ zIndex: 2 }}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          <div className="flex-1 flex items-center gap-2">
            <svg height="24" width="60" className="text-yuhu-primary">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                points="0,12 5,8 10,16 15,6 20,18 25,8 30,16 35,6 40,18 45,8 50,16 55,12 60,12"
              />
            </svg>
            <span className="text-xs text-zinc-500 font-mono min-w-[32px] text-right">{duration || '0:00'}</span>
          </div>
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-line break-words">{text}</p>;
  };
  
  return (
    <>
      <div
        className={cn(
          "flex w-full mb-1 group relative",
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
        
        {isMe ? (
          <>
            <div className="flex items-end mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-muted/50"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    className="text-red-600 cursor-pointer hover:bg-red-50"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Message
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className={cn("flex flex-col relative items-end")}> 
              <div className="flex items-end gap-1">
                <div
                  className={cn(
                    "chat-bubble relative group/message",
                    "chat-bubble-sent",
                    isConsecutive && "rounded-tr-md",
                    "max-w-xs md:max-w-md break-words whitespace-pre-line"
                  )}
                >
                  {renderMessageContent()}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] px-2 justify-end text-muted-foreground mt-1">
                <span>{time}</span>
                {status === 'read' && (
                  <span className="text-yuhu-primary">• Read</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className={cn("flex flex-col relative")}> 
            {isFirst && (
              <div className="text-xs text-muted-foreground ml-1 mb-0.5">
                {sender.name}
              </div>
            )}
            <div className="flex items-end gap-1">
              <div
                className={cn(
                  "chat-bubble relative group/message",
                  "chat-bubble-received",
                  isConsecutive && "rounded-tl-md",
                  "max-w-xs md:max-w-md break-words whitespace-pre-line"
                )}
              >
                {renderMessageContent()}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] px-2 justify-start text-muted-foreground mt-1">
              <span>{time}</span>
            </div>
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteMessageMutation.mutate()}
        title="Delete Message"
        description="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete Message"
        cancelText="Cancel"
      />
    </>
  );
};

export default Message;

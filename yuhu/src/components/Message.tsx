import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MoreVertical, Trash2, Play, Pause, FileText } from 'lucide-react';
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
  replyTo?: string;
  replyToMessage?: { id: string; text: string; senderId: string };
  onReply?: () => void;
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
  type = 'text',
  replyTo,
  replyToMessage,
  onReply,
}) => {
  const { user } = useAuth();
  const isMe = senderId === user?.id;
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<string>('');
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Add state for dropdown open
  const [dropdownOpen, setDropdownOpen] = useState(false);
  let longPressTimer: NodeJS.Timeout | null = null;

  // Parse JSON content if present
  let parsed = null;
  let isVoiceMessage = false;
  let audioUrl = '';

  if (type === 'voice') {
    isVoiceMessage = true;
    audioUrl = text;
  } else if (typeof text === 'string' && text.startsWith('{') && text.endsWith('}')) {
    try {
      parsed = JSON.parse(text);
      if (parsed && parsed.type === 'voice' && parsed.content) {
        isVoiceMessage = true;
        audioUrl = parsed.content;
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }

  useEffect(() => {
    if (isVoiceMessage && audioUrl) {
      const audio = new window.Audio(audioUrl);
      audio.addEventListener('loadedmetadata', () => {
        const dur = audio.duration;
        if (isFinite(dur) && !isNaN(dur) && dur > 0) {
          const mins = Math.floor(dur / 60);
          const secs = Math.floor(dur % 60);
          setDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
        } else {
          setDuration('0:00');
        }
      });
      audio.load();
    }
  }, [isVoiceMessage, audioUrl]);

  const deleteMessageMutation = useMutation({
    mutationFn: () => deleteMessage(id, (type === 'voice' || type === 'image' || type === 'pdf') ? text : undefined),
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
      audioRef.current = new Audio(audioUrl);
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
    console.log('Voice message debug:', { type, text });
    
    // Handle voice messages (both direct and JSON-encoded)
    if (isVoiceMessage) {
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
            {duration && (
              <span className="text-xs text-muted-foreground ml-2">{duration}</span>
            )}
          </div>
        </div>
      );
    }

    let displayText = text;
    // Try to parse JSON if present for other types
    if (typeof text === 'string' && text.startsWith('{') && text.endsWith('}')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.type === 'text' && parsed.content) {
          displayText = parsed.content;
        } else if (parsed && parsed.type && parsed.content) {
          displayText = parsed.content;
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }

    // --- Enhancement: Auto-detect image/audio links in plain text ---
    const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi;
    const audioRegex = /(https?:\/\/[^\s]+\.(webm|mp3|wav|ogg))/gi;
    if (type === 'text' && typeof displayText === 'string' && (imageRegex.test(displayText) || audioRegex.test(displayText))) {
      imageRegex.lastIndex = 0;
      audioRegex.lastIndex = 0;
      const parts = displayText.split(/(\s+)/);
      return (
        <div className="max-w-xs md:max-w-md space-y-2">
          {parts.map((part, idx) => {
            if (imageRegex.test(part)) {
              return <img key={idx} src={part} alt="sent image" className="rounded-lg max-w-full max-h-60 border border-zinc-300 dark:border-zinc-700" />;
            }
            if (audioRegex.test(part)) {
              return <audio key={idx} src={part} controls className="w-full" />;
            }
            return <span key={idx}>{part}</span>;
          })}
        </div>
      );
    }
    // --- End enhancement ---

    if (type === 'image') {
      return (
        <div className="max-w-xs md:max-w-md">
          <img src={text} alt="sent image" className="rounded-lg max-w-full max-h-60 border border-zinc-300 dark:border-zinc-700" />
        </div>
      );
    }
    if (type === 'pdf') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-300 dark:border-zinc-700 max-w-xs md:max-w-md">
          <FileText className="h-6 w-6 text-yuhu-primary" />
          <a
            href={text}
            target="_blank"
            rel="noopener noreferrer"
            className="text-yuhu-primary underline break-all"
          >
            Open PDF
          </a>
        </div>
      );
    }
    return <p className="text-sm whitespace-pre-line break-words">{displayText}</p>;
  };

  // Render reply preview if replyTo exists
  const renderReplyPreview = () => {
    if (!replyToMessage) return null;
    let replyText = replyToMessage.text;
    // Try to parse JSON if present
    if (typeof replyText === 'string' && replyText.startsWith('{') && replyText.endsWith('}')) {
      try {
        const parsed = JSON.parse(replyText);
        if (parsed && parsed.type === 'text' && parsed.content) {
          replyText = parsed.content;
        } else if (parsed && parsed.type && parsed.content) {
          replyText = parsed.content;
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }
    return (
      <div className="text-xs bg-muted rounded px-2 py-1 mb-1 text-muted-foreground">
        Replying to: {replyText}
      </div>
    );
  };

  // Handler for long press
  const handleLongPressStart = () => {
    longPressTimer = setTimeout(() => {
      setDropdownOpen(true);
    }, 500); // 500ms for long press
  };
  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex w-full mb-1 group relative",
          isMe ? "justify-end" : "justify-start"
        )}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
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
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
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
                  <DropdownMenuItem onClick={onReply} className="cursor-pointer">
                    Reply
                  </DropdownMenuItem>
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
                  {renderReplyPreview()}
                  {renderMessageContent()}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] px-2 justify-end text-muted-foreground mt-1">
                <span className="message-time">{time}</span>
                {status === 'read' && (
                  <span className="text-yuhu-primary">• Read</span>
                )}
              </div>
            </div>
          </>
        ) : (
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
                  <DropdownMenuItem onClick={onReply} className="cursor-pointer">
                    Reply
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                  {renderReplyPreview()}
                  {renderMessageContent()}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] px-2 justify-start text-muted-foreground mt-1">
                <span className="message-time">{time}</span>
              </div>
            </div>
          </>
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

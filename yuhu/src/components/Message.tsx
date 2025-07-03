import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MoreVertical, Trash2, Play, Pause, FileText, Download, X, ZoomIn, ZoomOut } from 'lucide-react';
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
import { Dialog, DialogContent } from '@/components/ui/dialog';

// Image Modal Component
const ImageModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText?: string;
}> = ({ isOpen, onClose, imageUrl, altText = "Image" }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset zoom and position when modal opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.5, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.5, 0.5));

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Controls */}
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleDownload}
            >
              <Download className="h-5 w-5" />
            </Button>
          </div>

          {/* Image */}
          <img
            src={imageUrl}
            alt={altText}
            className="max-w-full max-h-full object-contain cursor-move"
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

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
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');

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

  const handleImageClick = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };

  const renderMessageContent = () => {
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
              return (
                <img 
                  key={idx} 
                  src={part} 
                  alt="sent image" 
                  className="rounded-lg max-w-full max-h-60 border border-zinc-300 dark:border-zinc-700 cursor-pointer hover:opacity-90 transition-opacity" 
                  onClick={() => handleImageClick(part)}
                />
              );
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
          <img 
            src={text} 
            alt="sent image" 
            className="rounded-lg max-w-full max-h-60 border border-zinc-300 dark:border-zinc-700 cursor-pointer hover:opacity-90 transition-opacity" 
            onClick={() => handleImageClick(text)}
          />
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

      <ImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        imageUrl={selectedImageUrl}
        altText="Chat Image"
      />

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

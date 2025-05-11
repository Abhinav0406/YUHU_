import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MoreVertical, Trash2 } from 'lucide-react';
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
}) => {
  const { user } = useAuth();
  const isMe = senderId === user?.id;
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
        
        {/* Sent message: show menu just left of the bubble */}
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
                  <p className="text-sm whitespace-pre-line break-words">{text}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] px-2 justify-end text-muted-foreground">
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
                <p className="text-sm whitespace-pre-line break-words">{text}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] px-2 justify-start text-muted-foreground">
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

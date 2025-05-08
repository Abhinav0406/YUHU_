
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Smile, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage,
  disabled = false
}) => {
  const [message, setMessage] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || disabled) return;
    
    onSendMessage(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-3 bg-background">
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          <Paperclip className="h-5 w-5" />
          <span className="sr-only">Attach</span>
        </Button>
        
        <div className={cn(
          "relative flex-1 rounded-md border shadow-sm focus-within:ring-1 focus-within:ring-ring",
          disabled && "opacity-50"
        )}>
          <Textarea
            placeholder="Type a message..."
            className="min-h-12 resize-none px-3 py-2 border-none shadow-none focus-visible:ring-0"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
          />
        </div>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          <Smile className="h-5 w-5" />
          <span className="sr-only">Emoji</span>
        </Button>
        
        <Button
          type="submit"
          size="icon"
          className={cn(
            "flex-shrink-0",
            message.trim() ? "bg-yuhu-primary hover:bg-yuhu-dark" : "bg-muted text-muted-foreground hover:bg-muted"
          )}
          disabled={!message.trim() || disabled}
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </form>
  );
};

export default MessageInput;

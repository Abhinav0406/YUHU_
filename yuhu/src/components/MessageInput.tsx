import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Smile, Loader2, Mic, Square, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';

interface MessageInputProps {
  onSendMessage: (message: string | { type: string; content: string }) => void;
  disabled?: boolean;
  replyTo?: string | null;
  replyToMessage?: any;
  onCancelReply?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage,
  disabled = false,
  replyTo,
  replyToMessage,
  onCancelReply
}) => {
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [shouldFocus, setShouldFocus] = useState(false);
  const [lastSentTime, setLastSentTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout>();

  // Aggressive focus restoration
  useEffect(() => {
    if (shouldFocus && textareaRef.current) {
      const focusTextarea = () => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            textareaRef.current.value.length,
            textareaRef.current.value.length
          );
        }
      };

      // Multiple timing strategies
      focusTextarea(); // Immediate
      requestAnimationFrame(focusTextarea); // Next frame
      setTimeout(focusTextarea, 50); // Short delay
      setTimeout(focusTextarea, 150); // After scroll
      setTimeout(focusTextarea, 300); // Final attempt

      setShouldFocus(false);
    }
  }, [shouldFocus]);

  // Monitor for focus loss and restore if it was recently sent
  useEffect(() => {
    const handleFocusOut = (e: FocusEvent) => {
      const now = Date.now();
      if (now - lastSentTime < 1000 && e.target === textareaRef.current) {
        // Focus was lost within 1 second of sending, restore it
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 10);
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('focusout', handleFocusOut);
      return () => textarea.removeEventListener('focusout', handleFocusOut);
    }
  }, [lastSentTime]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (!message.trim() || disabled) return;
    const currentMessage = message.trim();
    setLastSentTime(Date.now());
    if (replyTo) {
      onSendMessage({ type: 'text', content: currentMessage, replyTo });
    } else {
      onSendMessage(currentMessage);
    }
    setMessage('');
    setShouldFocus(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSendMessage();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      toast({
        title: "Invalid file type",
        description: "Please select an image or PDF file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('chat-files').upload(fileName, file);
      
      if (error) {
        throw new Error(error.message);
      }

      const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(fileName);
      onSendMessage({ type: isImage ? 'image' : 'pdf', content: urlData.publicUrl });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `voice-${Date.now()}.webm`;
        
        setUploading(true);
        try {
          const { data, error } = await supabase.storage
            .from('voice-messages')
            .upload(fileName, audioBlob);

          if (error) throw error;

          const { data: urlData } = supabase.storage
            .from('voice-messages')
            .getPublicUrl(fileName);

          onSendMessage({ type: 'voice', content: urlData.publicUrl });
        } catch (error) {
          console.error('Voice message upload error:', error);
          toast({
            title: "Upload failed",
            description: "Failed to upload voice message. Please try again.",
            variant: "destructive"
          });
        } finally {
          setUploading(false);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Recording failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Restore focus when shouldFocus is true
  useEffect(() => {
    if (shouldFocus && textareaRef.current) {
      // Use a longer delay to ensure it happens after scrollToBottom
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
      setShouldFocus(false);
    }
  }, [shouldFocus]);

  return (
    <form onSubmit={handleFormSubmit} className="border-t p-3 bg-background">
      {replyToMessage && (
        <div className="mb-2 p-2 bg-muted rounded flex items-center justify-between">
          <div className="text-xs text-muted-foreground truncate max-w-xs">
            Replying to: <span className="font-semibold">{replyToMessage.sender?.name || 'Message'}</span>: {replyToMessage.text || replyToMessage.content}
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
          <span className="sr-only">Attach</span>
        </Button>
        <input
          type="file"
          accept="image/*,application/pdf"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />
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
            disabled={disabled || uploading || isRecording}
            rows={1}
            ref={textareaRef}
          />
          {isRecording && (
            <div className="absolute bottom-2 right-2 text-sm text-red-500">
              {formatTime(recordingTime)}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "flex-shrink-0",
            isRecording ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || uploading}
        >
          {isRecording ? (
            <Square className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
          <span className="sr-only">{isRecording ? "Stop Recording" : "Record Voice Message"}</span>
        </Button>
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
          type="button"
          size="icon"
          className={cn(
            "flex-shrink-0",
            message.trim() ? "bg-yuhu-primary hover:bg-yuhu-dark" : "bg-muted text-muted-foreground hover:bg-muted"
          )}
          disabled={(!message.trim() && !uploading) || disabled || isRecording}
          onClick={handleSendMessage}
        >
          {disabled || uploading ? (
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

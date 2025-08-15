import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Smile, Loader2, Mic, Square, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';

interface MessageInputProps {
  onSendMessage: (message: string | { type: string; content: string | string[]; replyTo?: string }) => void;
  disabled?: boolean;
  replyTo?: string | null;
  replyToMessage?: any;
  onCancelReply?: () => void;
}

interface SelectedFile {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
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
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
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
    if ((!message.trim() && selectedFiles.length === 0) || disabled) return;
    
    const currentMessage = message.trim();
    setLastSentTime(Date.now());

    if (selectedFiles.length > 0) {
      // Send multiple images
      const imageUrls = selectedFiles.map(f => f.url).filter(Boolean) as string[];
      if (imageUrls.length > 0) {
        if (replyTo) {
          onSendMessage({ type: 'multiple-images', content: imageUrls, replyTo });
        } else {
          onSendMessage({ type: 'multiple-images', content: imageUrls });
        }
      }
    }

    if (currentMessage) {
      if (replyTo) {
        onSendMessage({ type: 'text', content: currentMessage, replyTo });
      } else {
        onSendMessage(currentMessage);
      }
    }

    setMessage('');
    setSelectedFiles([]);
    setShouldFocus(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSendMessage();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter for images only
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: "Invalid file type",
        description: "Please select image files only for multiple upload",
        variant: "destructive"
      });
      return;
    }

    // Limit to 10 images
    if (imageFiles.length > 10) {
      toast({
        title: "Too many files",
        description: "Please select maximum 10 images at once",
        variant: "destructive"
      });
      return;
    }

    // Validate file sizes (max 5MB each)
    const oversizedFiles = imageFiles.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "Files too large",
        description: "Some files exceed 5MB limit. Please select smaller images.",
        variant: "destructive"
      });
      return;
    }

    // Add files to selected files with previews
    const newFiles: SelectedFile[] = imageFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);

    // Upload files
    await uploadFiles(newFiles);
  };

  const uploadFiles = async (files: SelectedFile[]) => {
    setUploading(true);
    
    try {
      const uploadPromises = files.map(async (fileObj) => {
        setSelectedFiles(prev => 
          prev.map(f => 
            f.id === fileObj.id ? { ...f, uploading: true } : f
          )
        );

        try {
          const fileExt = fileObj.file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
          const bucket = 'chat-files';
          
          const { data, error } = await supabase.storage.from(bucket).upload(fileName, fileObj.file);
          if (error) throw error;

          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
          
          setSelectedFiles(prev => 
            prev.map(f => 
              f.id === fileObj.id ? { ...f, uploading: false, uploaded: true, url: urlData.publicUrl } : f
            )
          );

          return urlData.publicUrl;
        } catch (error) {
          setSelectedFiles(prev => 
            prev.map(f => 
              f.id === fileObj.id ? { ...f, uploading: false } : f
            )
          );
          throw error;
        }
      });

      await Promise.all(uploadPromises);
      
      toast({
        title: "Upload complete",
        description: `Successfully uploaded ${files.length} image${files.length > 1 ? 's' : ''}`,
      });

    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload some files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        const newFiles: SelectedFile[] = imageFiles.map(file => ({
          id: `${Date.now()}-${Math.random()}`,
          file,
          preview: URL.createObjectURL(file),
          uploading: false,
          uploaded: false
        }));
        setSelectedFiles(prev => [...prev, ...newFiles]);
        uploadFiles(newFiles);
      }
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

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

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
      
      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="mb-3 p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''} selected
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFiles([])}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
            {selectedFiles.map((file) => (
              <div key={file.id} className="relative group">
                <img
                  src={file.preview}
                  alt="Preview"
                  className="w-full h-20 object-cover rounded border"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.id)}
                    className="h-6 w-6 text-white hover:bg-white/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {file.uploading && (
                  <div className="absolute inset-0 bg-black/30 rounded flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </div>
                )}
                {file.uploaded && (
                  <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1">
                    <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div 
        className={cn(
          "flex items-end gap-2",
          isDragOver && "ring-2 ring-dashed ring-primary"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-5 w-5" />
          <span className="sr-only">Attach Images</span>
        </Button>
        <input
          type="file"
          accept="image/*"
          multiple
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
            placeholder="Type a message or drag & drop images..."
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
            (message.trim() || selectedFiles.length > 0) ? "bg-yuhu-primary hover:bg-yuhu-dark" : "bg-muted text-muted-foreground hover:bg-muted"
          )}
          disabled={(!message.trim() && selectedFiles.length === 0) || disabled || isRecording}
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

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MoreVertical, Trash2, Play, Pause, FileText, Download, X, ZoomIn, ZoomOut, ImageIcon, ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react';
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
  imageUrls?: string[];
  currentIndex?: number;
}> = ({ isOpen, onClose, imageUrl, altText = "Image", imageUrls, currentIndex = 0 }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentImageIndex, setCurrentImageIndex] = useState(currentIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset zoom and position when modal opens or image changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setCurrentImageIndex(currentIndex);
      setIsImageLoading(true);
    }
  }, [isOpen, currentIndex]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Home') {
        if (imageUrls && imageUrls.length > 1) {
          setCurrentImageIndex(0);
          setZoom(1);
          setPosition({ x: 0, y: 0 });
          setIsImageLoading(true);
        }
      }
      if (e.key === 'End') {
        if (imageUrls && imageUrls.length > 1) {
          setCurrentImageIndex(imageUrls.length - 1);
          setZoom(1);
          setPosition({ x: 0, y: 0 });
          setIsImageLoading(true);
        }
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, currentImageIndex, imageUrls]);

  const handleDownload = async () => {
    try {
      const currentImage = imageUrls && imageUrls.length > 0 ? imageUrls[currentImageIndex] : imageUrl;
      const response = await fetch(currentImage);
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

  const handlePrevious = () => {
    if (imageUrls && imageUrls.length > 1) {
      setIsImageLoading(true);
      setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : imageUrls.length - 1));
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      // Add visual feedback
      const img = document.querySelector('.image-modal-img') as HTMLElement;
      if (img) {
        img.style.transform = 'scale(0.95)';
        setTimeout(() => {
          if (img) img.style.transform = 'scale(1)';
        }, 150);
      }
    }
  };

  const handleNext = () => {
    if (imageUrls && imageUrls.length > 1) {
      setIsImageLoading(true);
      setCurrentImageIndex(prev => (prev < imageUrls.length - 1 ? prev + 1 : 0));
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      // Add visual feedback
      const img = document.querySelector('.image-modal-img') as HTMLElement;
      if (img) {
        img.style.transform = 'scale(0.95)';
        setTimeout(() => {
          if (img) img.style.transform = 'scale(1)';
        }, 150);
      }
    }
  };

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

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && hasMultipleImages) {
      handleNext();
    } else if (isRightSwipe && hasMultipleImages) {
      handlePrevious();
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleImageLoad = () => {
    setIsImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsImageLoading(false);
    setImageError(true);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const currentImage = imageUrls && imageUrls.length > 0 ? imageUrls[currentImageIndex] : imageUrl;
  const hasMultipleImages = imageUrls && imageUrls.length > 1;

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
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Navigation buttons - hidden on mobile */}
          {hasMultipleImages && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 hover:scale-110 transition-transform duration-200 bg-black/30 hover:bg-black/50 hidden md:flex",
                  currentImageIndex === 0 && "opacity-50 cursor-not-allowed"
                )}
                onClick={handlePrevious}
                disabled={currentImageIndex === 0}
              >
                <ChevronLeft className="h-8 w-8 md:h-10 md:w-10" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 hover:scale-110 transition-transform duration-200 bg-black/30 hover:bg-black/50 hidden md:flex",
                  currentImageIndex === imageUrls.length - 1 && "opacity-50 cursor-not-allowed"
                )}
                onClick={handleNext}
                disabled={currentImageIndex === imageUrls.length - 1}
              >
                <ChevronRight className="h-8 w-8 md:h-10 md:w-10" />
              </Button>
            </>
          )}

          {/* Image counter and navigation hints */}
          {hasMultipleImages && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-center">
              <div className="text-white bg-black/50 px-3 py-1 rounded-full text-sm mb-2 text-center min-w-[3rem]">
                {currentImageIndex + 1} / {imageUrls.length}
              </div>
              {/* Progress dots */}
              <div className="flex justify-center gap-2 mb-2">
                {imageUrls.map((url, index) => (
                  <div
                    key={index}
                    className={cn(
                      "relative w-3 h-3 md:w-2 md:h-2 rounded-full transition-all duration-200",
                      index === currentImageIndex 
                        ? "bg-white scale-125" 
                        : "bg-white/50 hover:bg-white/70 cursor-pointer"
                    )}
                    onClick={() => {
                      setCurrentImageIndex(index);
                      setZoom(1);
                      setPosition({ x: 0, y: 0 });
                      setIsImageLoading(true);
                    }}
                    onMouseEnter={(e) => {
                      // Show thumbnail preview on hover
                      const tooltip = e.currentTarget.querySelector('.thumbnail-preview');
                      if (tooltip) {
                        (tooltip as HTMLElement).style.opacity = '1';
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Hide thumbnail preview
                      const tooltip = e.currentTarget.querySelector('.thumbnail-preview');
                      if (tooltip) {
                        (tooltip as HTMLElement).style.opacity = '0';
                      }
                    }}
                  >
                    {/* Thumbnail preview - hidden on mobile */}
                    <div className="thumbnail-preview absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 transition-opacity duration-200 pointer-events-none z-30 hidden md:block">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-16 h-16 object-cover rounded border-2 border-white shadow-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-white/70 bg-black/30 px-2 py-1 rounded text-xs hidden md:block">
                Use ← → keys, swipe, or click buttons to navigate
              </div>
              <div className="text-white/50 bg-black/20 px-2 py-1 rounded text-xs mt-1 hidden md:block">
                Home/End: First/Last • F: Fullscreen
              </div>
              {/* Mobile-friendly navigation hint */}
              <div className="text-white/70 bg-black/30 px-2 py-1 rounded text-xs md:hidden">
                Swipe left/right to navigate
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          )}

          {/* Image */}
          <img
            src={currentImage}
            alt={altText}
            className="max-w-full max-h-full object-contain cursor-move image-modal-img"
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease',
              opacity: isImageLoading ? 0.7 : 1,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onLoad={handleImageLoad}
            onError={handleImageError}
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
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[] | undefined>();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Add state for dropdown open
  const [dropdownOpen, setDropdownOpen] = useState(false);
  let longPressTimer: NodeJS.Timeout | null = null;

  // Parse JSON content if present
  let parsed = null;
  let isVoiceMessage = false;
  let audioUrl = '';

  if (type === 'voice' || type === 'audio') {
    isVoiceMessage = true;
    audioUrl = text;
  } else if (typeof text === 'string' && text.startsWith('{') && text.endsWith('}')) {
    try {
      parsed = JSON.parse(text);
      if (parsed && (parsed.type === 'voice' || parsed.type === 'audio') && parsed.content) {
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

  const handleImageClick = (imageUrl: string, imageUrls?: string[], index?: number) => {
    setSelectedImageUrl(imageUrl);
    setIsImageModalOpen(true);
    // Store the image array and index for navigation
    if (imageUrls && index !== undefined) {
      setSelectedImageUrls(imageUrls);
      setSelectedImageIndex(index);
    } else {
      setSelectedImageUrls(undefined);
      setSelectedImageIndex(0);
    }
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
                  onClick={() => handleImageClick(part, undefined, 0)}
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
            onClick={() => handleImageClick(text, undefined, 0)}
          />
        </div>
      );
    }

    // Handle multiple images
    if (type === 'multiple-images') {
      try {
        const imageUrls = typeof text === 'string' ? JSON.parse(text) : text;
        if (Array.isArray(imageUrls)) {
          return (
            <div className="max-w-xs md:max-w-md">
              <div className={cn(
                "grid gap-1 rounded-lg overflow-hidden",
                imageUrls.length === 1 && "grid-cols-1",
                imageUrls.length === 2 && "grid-cols-2",
                imageUrls.length === 3 && "grid-cols-2",
                imageUrls.length === 4 && "grid-cols-2",
                imageUrls.length >= 5 && "grid-cols-3"
              )}>
                {imageUrls.map((imageUrl: string, index: number) => (
                  <div
                    key={index}
                    className={cn(
                      "relative cursor-pointer group overflow-hidden",
                      imageUrls.length === 3 && index === 2 && "col-span-2",
                      imageUrls.length === 4 && "aspect-square",
                      imageUrls.length >= 5 && "aspect-square"
                    )}
                    onClick={() => handleImageClick(imageUrl, imageUrls, index)}
                  >
                    <img
                      src={imageUrl}
                      alt={`Image ${index + 1}`}
                      className="w-full h-full object-cover border border-zinc-300 dark:border-zinc-700 transition-transform duration-200 group-hover:scale-105"
                    />
                    {imageUrls.length > 4 && index === 4 && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <span className="text-white font-bold text-xl">
                          +{imageUrls.length - 4}
                        </span>
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                    {/* Click indicator for multiple images */}
                    {imageUrls.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                {imageUrls.length} image{imageUrls.length > 1 ? 's' : ''}
                {imageUrls.length > 1 && (
                  <span className="text-xs text-blue-500 ml-1 hidden md:inline">
                    • Click to view • Use ← → keys or buttons to navigate
                  </span>
                )}
              </div>
            </div>
          );
        }
      } catch (e) {
        console.error('Error parsing multiple images:', e);
      }
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
    if (type === 'audio') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-300 dark:border-zinc-700 max-w-xs md:max-w-md">
          <audio controls src={text} className="w-full" />
          <a
            href={text}
            target="_blank"
            rel="noopener noreferrer"
            className="text-yuhu-primary underline break-all ml-2"
          >
            Download
          </a>
        </div>
      );
    }
    // --- Video file message ---
    if (type === 'video') {
      return (
        <div className="flex flex-col gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-300 dark:border-zinc-700 max-w-xs md:max-w-md">
          <video controls src={text} className="w-full max-h-60 rounded-lg" />
          <a
            href={text}
            target="_blank"
            rel="noopener noreferrer"
            className="text-yuhu-primary underline break-all"
          >
            Download MP4
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
        imageUrls={selectedImageUrls}
        currentIndex={selectedImageIndex}
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

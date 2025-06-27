import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { notificationService } from '@/services/notificationService';

interface NotificationSoundProps {
  type: 'message' | 'call' | 'friend_request' | 'system';
  enabled: boolean;
}

interface NotificationSoundRef {
  playSound: () => void;
}

const NotificationSound = forwardRef<NotificationSoundRef, NotificationSoundProps>(
  ({ type, enabled }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
      if (!enabled || !audioRef.current) return;

      // Set the appropriate sound file based on notification type
      const getSoundFile = () => {
        switch (type) {
          case 'call':
            return '/assets/call-notification.mp3';
          case 'message':
            return '/assets/notification.mp3';
          case 'friend_request':
            return '/assets/friend-request.mp3';
          case 'system':
            return '/assets/system-notification.mp3';
          default:
            return '/assets/notification.mp3';
        }
      };

      audioRef.current.src = getSoundFile();
      audioRef.current.load();
    }, [type, enabled]);

    const playSound = () => {
      if (!enabled || !audioRef.current) return;

      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        console.warn('Failed to play notification sound:', error);
      });
    };

    // Expose playSound method to parent components
    useImperativeHandle(ref, () => ({
      playSound,
    }));

    return (
      <audio
        ref={audioRef}
        preload="auto"
        style={{ display: 'none' }}
      />
    );
  }
);

NotificationSound.displayName = 'NotificationSound';

export default NotificationSound; 
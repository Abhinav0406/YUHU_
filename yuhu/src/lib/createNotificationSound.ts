// Utility to create notification sounds programmatically
// This is a fallback when actual sound files are not available

export const createNotificationSound = (type: 'message' | 'call' | 'friend_request' | 'system' = 'message'): string => {
  // Create a simple beep sound using Web Audio API
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  // Different frequencies for different notification types
  const frequencies = {
    message: 800,
    call: 1200,
    friend_request: 600,
    system: 1000
  };

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime);
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);

  // Return a data URL for the sound (this is a simplified approach)
  return 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
};

// Alternative: Use the browser's built-in notification sound
export const playSystemNotificationSound = () => {
  try {
    // Try to play a system notification sound
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Fallback to Web Audio API
      createNotificationSound('message');
    });
  } catch (error) {
    // Fallback to Web Audio API
    createNotificationSound('message');
  }
};

// Update the notification service to use this fallback
export const getNotificationSoundUrl = (type: 'message' | 'call' | 'friend_request' | 'system'): string => {
  // Try to load the actual sound file first
  const soundFiles = {
    message: '/assets/notification.mp3',
    call: '/assets/call-notification.mp3',
    friend_request: '/assets/friend-request.mp3',
    system: '/assets/system-notification.mp3'
  };

  // For now, return the fallback data URL
  // In production, you would check if the file exists and return the actual URL
  return createNotificationSound(type);
}; 
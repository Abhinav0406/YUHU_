import React from 'react';
import NotificationTest from '@/components/NotificationTest';

const TestNotifications: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Notification Testing</h1>
        <NotificationTest />
      </div>
    </div>
  );
};

export default TestNotifications; 
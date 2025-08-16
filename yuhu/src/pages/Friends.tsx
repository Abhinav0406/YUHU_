import React from 'react';
import Layout from '../components/Layout';
import FriendsList from '../components/FriendsList';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const Friends: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStartChat = (friendEmail: string) => {
    // Navigate to chat page
    navigate('/chat');
  };

  if (!user?.email) {
    return (
      <Layout requireAuth={true}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth={true}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Friends</h1>
          <p className="text-gray-600">Manage your friends and connection requests</p>
        </div>
        <FriendsList userEmail={user.email} onStartChat={handleStartChat} />
      </div>
    </Layout>
  );
};

export default Friends;

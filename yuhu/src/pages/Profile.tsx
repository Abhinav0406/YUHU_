import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Layout from '@/components/Layout';
import UserProfile from '@/components/UserProfile';
import FriendsList from '@/components/FriendsList';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStartChat = (friendEmail: string) => {
    // Navigate to chat with the selected friend
    navigate(`/chat/${friendEmail}`);
  };
  
  return (
    <Layout requireAuth={true}>
      <div className="container py-8 px-4 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-yuhu-primary">Your Profile</h1>
        
        <Tabs 
          defaultValue="profile" 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="w-full mx-auto"
        >
          <div className="flex justify-center mb-8">
            <TabsList className="bg-yuhu-primary/10">
              <TabsTrigger 
                value="profile"
                className="data-[state=active]:bg-yuhu-primary data-[state=active]:text-white"
              >
                Profile
              </TabsTrigger>
              <TabsTrigger 
                value="friends"
                className="data-[state=active]:bg-yuhu-primary data-[state=active]:text-white"
              >
                Friends
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="profile" className="animate-fade-in focus-visible:outline-none">
            <UserProfile />
          </TabsContent>
          
          <TabsContent value="friends" className="animate-fade-in focus-visible:outline-none">
            {user?.email && (
              <FriendsList 
                userEmail={user.email} 
                onStartChat={handleStartChat}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Profile;

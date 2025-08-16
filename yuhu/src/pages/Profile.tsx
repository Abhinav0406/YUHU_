import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Layout from '@/components/Layout';
import InstagramProfile from '@/components/InstagramProfile';
import FriendsList from '@/components/FriendsList';
import UserProfileView from '@/components/UserProfileView';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Routes, Route, useParams } from 'react-router-dom';

const Profile = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  // If userId is provided, show the UserProfileView for that user
  if (userId && userId !== profile?.id) {
    return (
      <Layout>
        <UserProfileView />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800 border-gray-700">
            <TabsTrigger 
              value="profile" 
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300 hover:text-white"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger 
              value="friends" 
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300 hover:text-white"
            >
              Friends
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="animate-fade-in focus-visible:outline-none">
            <InstagramProfile />
          </TabsContent>
          
          <TabsContent value="friends" className="animate-fade-in focus-visible:outline-none">
            <FriendsList />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Profile;

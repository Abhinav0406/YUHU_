import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowLeft, Settings, Users, UserPlus, MessageCircle, MoreHorizontal, Grid, Bookmark, UserCheck, CheckCircle, Camera, X, Heart, MessageCircle as CommentIcon } from 'lucide-react';
import { getFriends } from '@/services/friendService';
import { getPendingRequests } from '@/services/friendService';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  college: string | null;
  major: string | null;
  createdAt: string;
}

interface ProfileStats {
  friends: number;
  pendingRequests: number;
}

interface Post {
  id: string;
  imageUrl: string;
  caption: string;
  createdAt: Date;
  likes: number;
  comments: number;
}

const UserProfileView = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ friends: 0, pendingRequests: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [showLargeAvatar, setShowLargeAvatar] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;
      
      try {
        // Fetch user profile from Supabase
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setProfile(data);
          
          // Check if current user is friends with this user
          const currentUser = supabase.auth.getUser();
          if (currentUser) {
            const { data: friendsData } = await supabase
              .from('friends')
              .select('*')
              .or(`user1.eq.${currentUser.data.user?.id},user2.eq.${currentUser.data.user?.id}`)
              .or(`user1.eq.${userId},user2.eq.${userId}`);

            setIsFriend(friendsData && friendsData.length > 0);
          }

          // Fetch stats
          const [friends, pendingRequests] = await Promise.all([
            getFriends(data.email),
            getPendingRequests(data.email)
          ]);
          
          setStats({
            friends: friends.length,
            pendingRequests: pendingRequests.length
          });

          // Load posts (in a real app, this would come from a database)
          const savedPosts = localStorage.getItem(`posts_${userId}`);
          if (savedPosts) {
            setPosts(JSON.parse(savedPosts));
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        toast({
          title: "Error",
          description: "Failed to load user profile",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, toast]);

  const handleSendFriendRequest = async () => {
    if (!profile || !userId) return;
    
    setIsLoadingAction(true);
    try {
      const currentUser = supabase.auth.getUser();
      if (!currentUser.data.user) {
        throw new Error('User not authenticated');
      }

      // Check if request already exists
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('from_user', currentUser.data.user.id)
        .eq('to_user', userId)
        .single();

      if (existingRequest) {
        toast({
          title: "Friend request already sent",
          description: "You've already sent a friend request to this user",
        });
        return;
      }

      // Send friend request
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user: currentUser.data.user.id,
          to_user: userId,
          status: 'pending'
        });

      if (error) {
        throw error;
      }

      setFriendRequestSent(true);
      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${profile.username}`,
      });
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive"
      });
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleMessage = () => {
    // Navigate to chat with this user
    navigate(`/chat/${userId}`);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        return (
          <div className="p-4">
            {posts.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 border-2 border-gray-600 rounded mx-auto mb-4 flex items-center justify-center bg-gray-800">
                  <Camera className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">No Posts Yet</h3>
                <p className="text-gray-400">This user hasn't shared any posts yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="aspect-square bg-gray-800 relative group cursor-pointer overflow-hidden border border-gray-700"
                  >
                    <img
                      src={post.imageUrl}
                      alt={post.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                      <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center">
                        <div className="flex items-center justify-center gap-4 mb-2">
                          <div className="flex items-center gap-1">
                            <Heart className="w-4 h-4" />
                            <span className="text-sm">{post.likes}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CommentIcon className="w-4 h-4" />
                            <span className="text-sm">{post.comments}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'saved':
        return (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-2 border-gray-600 rounded mx-auto mb-4 flex items-center justify-center bg-gray-800">
              <Bookmark className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">No Saved Posts</h3>
            <p className="text-gray-400">This user hasn't saved any posts yet.</p>
          </div>
        );
      case 'tagged':
        return (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-2 border-gray-600 rounded mx-auto mb-4 flex items-center justify-center bg-gray-800">
              <UserCheck className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">No Tagged Posts</h3>
            <p className="text-gray-400">This user hasn't been tagged in any posts yet.</p>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-4 animate-pulse"></div>
          <div className="h-4 bg-gray-700 rounded w-32 mx-auto animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16">
        <h3 className="text-xl font-semibold mb-2 text-white">User Not Found</h3>
        <p className="text-gray-400">The user you're looking for doesn't exist.</p>
        <Button 
          className="mt-4 bg-blue-500 hover:bg-blue-600"
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-gray-900 rounded-lg shadow-lg border border-gray-800">
      {/* Back Button */}
      <div className="p-4 border-b border-gray-800">
        <Button
          variant="ghost"
          className="text-gray-300 hover:text-white hover:bg-gray-800"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Profile Header */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 p-4 md:p-8">
        {/* Profile Picture */}
        <div className="flex-shrink-0 flex justify-center md:justify-start">
          <div className="relative">
            <Avatar 
              className="h-24 w-24 md:h-32 md:w-32 border-4 border-gray-800 shadow-xl ring-4 ring-gray-700 cursor-pointer hover:ring-blue-500 transition-all duration-200" 
              onClick={() => setShowLargeAvatar(true)}
            >
              <AvatarImage src={profile.avatar || ''} alt={profile.username} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl md:text-4xl font-bold">
                {profile.username ? profile.username[0].toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            {/* Verification Badge */}
            <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1 shadow-lg">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Username and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-light truncate text-white">{profile.username}</h1>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isFriend ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-gray-600 text-gray-300 text-sm px-3 md:px-4 py-2 h-8 md:h-9 hover:bg-gray-800 hover:border-gray-500 hover:text-white"
                  disabled
                >
                  <Users className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  Friends
                </Button>
              ) : friendRequestSent ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-gray-600 text-gray-300 text-sm px-3 md:px-4 py-2 h-8 md:h-9 hover:bg-gray-800 hover:border-gray-500 hover:text-white"
                  disabled
                >
                  <UserCheck className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  Request Sent
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-gray-600 text-gray-300 text-sm px-3 md:px-4 py-2 h-8 md:h-9 hover:bg-gray-800 hover:border-gray-500 hover:text-white"
                  onClick={handleSendFriendRequest}
                  disabled={isLoadingAction}
                >
                  <UserPlus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  {isLoadingAction ? 'Sending...' : 'Add Friend'}
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 md:gap-8">
            <div className="text-center">
              <span className="font-semibold text-base md:text-lg text-white">{stats.friends}</span>
              <div className="text-xs md:text-sm text-gray-400">friends</div>
            </div>
            <div className="text-center">
              <span className="font-semibold text-base md:text-lg text-white">{stats.pendingRequests}</span>
              <div className="text-xs md:text-sm text-gray-400">pending</div>
            </div>
            <div className="text-center">
              <span className="font-semibold text-base md:text-lg text-white">{posts.length}</span>
              <div className="text-xs md:text-sm text-gray-400">posts</div>
            </div>
          </div>

          {/* Bio and Details */}
          <div className="space-y-2">
            {profile.fullName && (
              <div className="font-semibold text-sm md:text-base text-white">{profile.fullName}</div>
            )}
            
            {profile.bio && (
              <div className="text-xs md:text-sm text-gray-300 whitespace-pre-wrap max-w-md">{profile.bio}</div>
            )}
            
            {profile.college && (
              <div className="text-xs md:text-sm text-gray-400">
                🎓 {profile.college}
                {profile.major && ` • ${profile.major}`}
              </div>
            )}
            
            <div className="text-xs md:text-sm text-gray-400">
              📧 {profile.email}
            </div>
            
            <div className="text-xs md:text-sm text-gray-500">
              Member since {new Date(profile.createdAt).getFullYear()}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              className="bg-blue-500 hover:bg-blue-600 text-white text-xs md:text-sm px-4 md:px-6 py-2 h-8 md:h-9 shadow-lg"
              onClick={handleMessage}
            >
              <MessageCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Message</span>
              <span className="sm:hidden">Msg</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Story Highlights Placeholder */}
      <div className="px-4 md:px-8 pb-4 md:pb-6">
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex-shrink-0 text-center">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-gray-600 bg-gray-800 flex items-center justify-center mb-1 hover:border-gray-500 transition-colors cursor-pointer">
                <div className="w-6 h-6 md:w-8 md:h-8 border-2 border-gray-500 rounded-full"></div>
              </div>
              <div className="text-xs text-gray-400">New</div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-2 bg-gray-800" />

      {/* Profile Tabs */}
      <div className="flex justify-center border-t border-gray-800">
        <div className="flex space-x-6 md:space-x-8">
          <button 
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-1 md:gap-2 py-3 md:py-4 px-2 text-xs md:text-sm font-medium transition-colors ${
              activeTab === 'posts' 
                ? 'border-t-2 border-blue-500 text-blue-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Grid className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">POSTS</span>
            <span className="sm:hidden">POSTS</span>
          </button>
          <button 
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-1 md:gap-2 py-3 md:py-4 px-2 text-xs md:text-sm font-medium transition-colors ${
              activeTab === 'saved' 
                ? 'border-t-2 border-blue-500 text-blue-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Bookmark className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">SAVED</span>
            <span className="sm:hidden">SAVED</span>
          </button>
          <button 
            onClick={() => setActiveTab('tagged')}
            className={`flex items-center gap-1 md:gap-2 py-3 md:py-4 px-2 text-xs md:text-sm font-medium transition-colors ${
              activeTab === 'tagged' 
                ? 'border-t-2 border-blue-500 text-blue-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <UserCheck className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">TAGGED</span>
            <span className="sm:hidden">TAGGED</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Large Avatar Modal */}
      <Dialog open={showLargeAvatar} onOpenChange={setShowLargeAvatar}>
        <DialogContent className="max-w-2xl max-h-[90vh] bg-gray-900 border-gray-700 p-0 overflow-hidden">
          <div className="relative">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-10 h-8 w-8 p-0 bg-gray-800/80 hover:bg-gray-700/80 text-white border border-gray-600"
              onClick={() => setShowLargeAvatar(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* Profile Image */}
            <div className="flex items-center justify-center p-8">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={`${profile.username}'s profile picture`}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                />
              ) : (
                <div className="w-64 h-64 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-6xl font-bold shadow-2xl">
                  {profile.username ? profile.username[0].toUpperCase() : 'U'}
                </div>
              )}
            </div>
            
            {/* Profile Info Below Image */}
            <div className="px-8 pb-8 text-center">
              <h3 className="text-xl font-semibold text-white mb-2">{profile.username}</h3>
              {profile.fullName && (
                <p className="text-gray-300">{profile.fullName}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserProfileView;

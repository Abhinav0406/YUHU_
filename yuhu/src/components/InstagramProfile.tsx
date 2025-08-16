import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Settings, Users, UserPlus, MessageCircle, MoreHorizontal, Grid, Bookmark, UserCheck, CheckCircle, Camera, Save, Loader2, X, Plus, Heart, MessageCircle as CommentIcon, Share2 } from 'lucide-react';
import { getFriends } from '@/services/friendService';
import { getPendingRequests } from '@/services/friendService';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';

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

// Define form schemas
const profileSchema = z.object({
  fullName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }).optional(),
  bio: z.string().optional(),
  college: z.string().optional(),
  major: z.string().optional(),
});

const postSchema = z.object({
  caption: z.string().min(1, { message: "Caption is required." }).max(500, { message: "Caption must be less than 500 characters." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PostFormValues = z.infer<typeof postSchema>;

const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=default';

const InstagramProfile = () => {
  const { profile, user, updateProfile } = useAuth();
  const [stats, setStats] = useState<ProfileStats>({ friends: 0, pendingRequests: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showLargeAvatar, setShowLargeAvatar] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const postImageRef = useRef<HTMLInputElement>(null);

  // Initialize forms with react-hook-form
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.fullName || '',
      username: profile?.username || '',
      email: profile?.email || '',
      bio: profile?.bio || '',
      college: profile?.college || '',
      major: profile?.major || '',
    },
  });

  const postForm = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      caption: '',
    },
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.email) return;
      
      try {
        const [friends, pendingRequests] = await Promise.all([
          getFriends(user.email),
          getPendingRequests(user.email)
        ]);
        
        setStats({
          friends: friends.length,
          pendingRequests: pendingRequests.length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user?.email]);

  // Update form when profile changes
  useEffect(() => {
    if (profile) {
      form.reset({
        fullName: profile.fullName || '',
        username: profile.username || '',
        email: profile.email || '',
        bio: profile.bio || '',
        college: profile.college || '',
        major: profile.major || '',
      });
    }
  }, [profile, form]);

  // Load posts from localStorage (in a real app, this would come from a database)
  useEffect(() => {
    const savedPosts = localStorage.getItem(`posts_${profile?.id}`);
    if (savedPosts) {
      setPosts(JSON.parse(savedPosts));
    }
  }, [profile?.id]);

  // Save posts to localStorage whenever posts change
  useEffect(() => {
    if (profile?.id) {
      localStorage.setItem(`posts_${profile.id}`, JSON.stringify(posts));
    }
  }, [posts, profile?.id]);

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      const success = await updateProfile({
        fullName: data.fullName,
        username: data.username,
        bio: data.bio || null,
        college: data.college || null,
        major: data.major || null
      });
      
      if (success) {
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
        });
        setIsEditing(false);
      } else {
        toast({
          title: "Update failed",
          description: "There was a problem updating your profile. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Avatar upload handler
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 2MB",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    setAvatarUploading(true);
    try {
      // Generate a unique file name
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) {
        throw new Error('Invalid file extension. Please use JPG, PNG, or GIF.');
      }

      if (!profile?.id) {
        throw new Error('User profile not found. Please try logging in again.');
      }

      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
      
      // Upload file to Supabase storage
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (uploadError) {
        if (uploadError.message.includes('row-level security')) {
          throw new Error('Permission denied. Please make sure you are logged in.');
        }
        throw new Error(uploadError.message);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const success = await updateProfile({ avatar: publicUrl });
      
      if (success) {
        toast({ 
          title: 'Avatar updated', 
          description: 'Your profile picture has been updated successfully.' 
        });
      } else {
        throw new Error('Failed to update profile with new avatar');
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      toast({ 
        title: 'Upload failed', 
        description: err instanceof Error ? err.message : 'Could not upload avatar. Please try again.',
        variant: 'destructive' 
      });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Post image selection handler
  const handlePostImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB for posts)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    setSelectedImage(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Create post handler
  const handleCreatePost = async (data: PostFormValues) => {
    if (!selectedImage) {
      toast({
        title: "No image selected",
        description: "Please select an image for your post",
        variant: "destructive"
      });
      return;
    }

    setIsCreatingPost(true);
    try {
      // In a real app, you would upload the image to storage and save post to database
      // For now, we'll create a local post with the image preview
      const newPost: Post = {
        id: Date.now().toString(),
        imageUrl: imagePreview,
        caption: data.caption,
        createdAt: new Date(),
        likes: 0,
        comments: 0,
      };

      setPosts(prev => [newPost, ...prev]);
      
      // Reset form and close modal
      postForm.reset();
      setSelectedImage(null);
      setImagePreview('');
      setShowCreatePost(false);
      
      toast({
        title: "Post created",
        description: "Your post has been shared successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCreatingPost(false);
    }
  };

  // Like post handler
  const handleLikePost = (postId: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, likes: post.likes + 1 }
        : post
    ));
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-4 animate-pulse"></div>
          <div className="h-4 bg-gray-700 rounded w-32 mx-auto animate-pulse"></div>
        </div>
      </div>
    );
  }

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
                <p className="text-gray-400 mb-4">When you share photos and videos, they'll appear on your profile.</p>
                <Button 
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm shadow-lg"
                  onClick={() => setShowCreatePost(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Share Your First Photo
                </Button>
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
            <p className="text-gray-400">Save photos and videos that you want to see again.</p>
          </div>
        );
      case 'tagged':
        return (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-2 border-gray-600 rounded mx-auto mb-4 flex items-center justify-center bg-gray-800">
              <UserCheck className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">No Tagged Posts</h3>
            <p className="text-gray-400">When people tag you in photos, they'll appear here.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-900 rounded-lg shadow-lg border border-gray-800">
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
          
          {/* Avatar Upload Button */}
          {isEditing && (
            <>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleAvatarChange}
                disabled={avatarUploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 hover:text-white"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
                ) : (
                  <>Change Avatar</>
                )}
              </Button>
            </>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Username and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-light truncate text-white">{profile.username}</h1>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-600 text-gray-300 text-sm px-3 md:px-4 py-2 h-8 md:h-9 hover:bg-gray-800 hover:border-gray-500 hover:text-white"
                onClick={() => setIsEditing(!isEditing)}
                disabled={isSubmitting}
              >
                {isEditing ? (
                  <>
                    <Save className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Save</span>
                    <span className="sm:hidden">Save</span>
                  </>
                ) : (
                  <>
                    <Edit className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Edit Profile</span>
                    <span className="sm:hidden">Edit</span>
                  </>
                )}
              </Button>
              {isEditing && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-gray-600 text-gray-300 text-sm px-3 md:px-4 py-2 h-8 md:h-9 hover:bg-gray-800 hover:border-gray-500 hover:text-white"
                  onClick={() => {
                    setIsEditing(false);
                    form.reset();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 text-sm px-3 md:px-4 py-2 h-8 md:h-9 hover:bg-gray-800 hover:border-gray-500 hover:text-white">
                <Settings className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
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

          {/* Bio and Details - Edit Form */}
          {isEditing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Full Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="Your name" 
                            disabled={isSubmitting}
                            className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Username</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="username" 
                            disabled={isSubmitting}
                            className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="college"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">College</FormLabel>
                        <Select
                          disabled={isSubmitting}
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-blue-500">
                              <SelectValue placeholder="Select your college" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="engineering">College of Engineering</SelectItem>
                            <SelectItem value="arts">College of Arts & Sciences</SelectItem>
                            <SelectItem value="business">School of Business</SelectItem>
                            <SelectItem value="education">College of Education</SelectItem>
                            <SelectItem value="medicine">School of Medicine</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="major"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Major</FormLabel>
                        <Select
                          disabled={isSubmitting}
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-blue-500">
                              <SelectValue placeholder="Select your major" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="cs">Computer Science</SelectItem>
                            <SelectItem value="mech">Mechanical Engineering</SelectItem>
                            <SelectItem value="bio">Biology</SelectItem>
                            <SelectItem value="business">Business Administration</SelectItem>
                            <SelectItem value="psych">Psychology</SelectItem>
                            <SelectItem value="english">English</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Bio</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          placeholder="Tell us a little about yourself" 
                          disabled={isSubmitting}
                          className="min-h-[120px] bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button 
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-6 py-2 shadow-lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
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
                Member since 2024
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white text-xs md:text-sm px-4 md:px-6 py-2 h-8 md:h-9 shadow-lg">
              <MessageCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Message</span>
              <span className="sm:hidden">Msg</span>
            </Button>
            <Button variant="outline" className="border-gray-600 text-gray-300 text-xs md:text-sm px-4 md:px-6 py-2 h-8 md:h-9 hover:bg-gray-800 hover:border-gray-500 hover:text-white">
              <UserPlus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Add Friend</span>
              <span className="sm:hidden">Add</span>
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

      {/* Create Post Button - Fixed Position */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 shadow-lg"
          onClick={() => setShowCreatePost(true)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

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

      {/* Create Post Modal */}
      <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Post</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Image Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Post Image</label>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
                {imagePreview ? (
                  <div className="space-y-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-lg"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview('');
                      }}
                    >
                      Change Image
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Camera className="w-12 h-12 mx-auto text-gray-400" />
                    <div className="text-gray-400">
                      <Button
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        onClick={() => postImageRef.current?.click()}
                      >
                        Select Image
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">JPG, PNG, GIF up to 5MB</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={postImageRef}
                  className="hidden"
                  onChange={handlePostImageSelect}
                />
              </div>
            </div>

            {/* Caption */}
            <Form {...postForm}>
              <form onSubmit={postForm.handleSubmit(handleCreatePost)} className="space-y-4">
                <FormField
                  control={postForm.control}
                  name="caption"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Caption</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          placeholder="Write a caption..." 
                          className="min-h-[100px] bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    onClick={() => setShowCreatePost(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                    disabled={!selectedImage || isCreatingPost}
                  >
                    {isCreatingPost ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Share Post'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstagramProfile;

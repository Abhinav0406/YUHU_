import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { Edit, Save, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// Define form schema
const profileSchema = z.object({
  fullName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }).optional(),
  bio: z.string().optional(),
  college: z.string().optional(),
  major: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=default';

const UserProfile = () => {
  const { profile, updateProfile, deleteProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeletePhotoDialog, setShowDeletePhotoDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  
  // Initialize form with react-hook-form
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

  // Delete profile handler
  const handleDeleteProfile = async () => {
    setIsSubmitting(true);
    try {
      const success = await deleteProfile();
      if (success) {
        toast({ title: 'Profile deleted', description: 'Your profile has been deleted.' });
      } else {
        toast({ title: 'Delete failed', description: 'Could not delete your profile.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Delete failed', description: 'An error occurred while deleting your profile.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  };

  // Delete profile photo handler
  const handleDeletePhoto = async () => {
    if (!profile?.avatar) return;
    setIsDeletingPhoto(true);
    try {
      // Remove from Supabase Storage if not default
      const url = profile.avatar;
      if (!url.includes('dicebear.com')) {
        const path = url.split('/avatars/')[1];
        if (path) {
          await supabase.storage.from('avatars').remove([path]);
        }
      }
      // Set avatar to default
      const success = await updateProfile({ avatar: DEFAULT_AVATAR });
      if (success) {
        toast({ title: 'Profile photo removed', description: 'Your profile photo has been reset to default.' });
      } else {
        toast({ title: 'Failed', description: 'Could not remove profile photo.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Could not remove profile photo.', variant: 'destructive' });
    } finally {
      setIsDeletingPhoto(false);
      setShowDeletePhotoDialog(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto shadow-lg border-opacity-50 animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-yuhu-primary">My Profile</CardTitle>
            <CardDescription className="text-muted-foreground">
              Update your personal information and preferences
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsEditing(!isEditing)}
            className="border-yuhu-primary text-yuhu-primary hover:bg-yuhu-primary/10"
            disabled={isSubmitting}
          >
            {isEditing ? (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            ) : (
              <>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col items-center mb-6">
              <Avatar className="h-24 w-24 border-4 border-yuhu-primary/20">
                <AvatarImage src={profile?.avatar || ''} alt={profile?.username} />
                <AvatarFallback className="bg-yuhu-primary text-white text-xl">
                  {profile?.username ? profile.username[0].toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              {/* Change Avatar button (only when editing) */}
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
                    variant="link"
                    className="mt-2 text-yuhu-primary"
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
              {/* Delete Photo button (always if avatar exists) */}
              {profile?.avatar && !avatarUploading && (
                <Button
                  type="button"
                  variant="destructive"
                  className="mt-2"
                  onClick={() => setShowDeletePhotoDialog(true)}
                  disabled={isDeletingPhoto}
                >
                  {isDeletingPhoto ? 'Deleting...' : 'Delete Photo'}
                </Button>
              )}
              <Dialog open={showDeletePhotoDialog} onOpenChange={setShowDeletePhotoDialog}>
                <DialogContent className="max-w-xs text-center">
                  <h2 className="text-lg font-bold mb-2">Delete Profile Photo?</h2>
                  <p className="mb-4">Are you sure you want to delete your profile photo? It will be reset to the default avatar.</p>
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={() => setShowDeletePhotoDialog(false)} disabled={isDeletingPhoto}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDeletePhoto} disabled={isDeletingPhoto}>
                      {isDeletingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        placeholder="Your name" 
                        disabled={!isEditing || isSubmitting}
                        className="focus-visible:ring-yuhu-primary"
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
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        placeholder="username" 
                        disabled={!isEditing || isSubmitting}
                        className="focus-visible:ring-yuhu-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        placeholder="your.email@college.edu" 
                        disabled={true} // Email can't be changed
                        className="focus-visible:ring-yuhu-primary bg-gray-50"
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
                    <FormLabel>College</FormLabel>
                    <Select
                      disabled={!isEditing || isSubmitting}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="focus-visible:ring-yuhu-primary">
                          <SelectValue placeholder="Select your college" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Major</FormLabel>
                    <Select
                      disabled={!isEditing || isSubmitting}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="focus-visible:ring-yuhu-primary">
                          <SelectValue placeholder="Select your major" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field}
                        placeholder="Tell us a little about yourself" 
                        disabled={!isEditing || isSubmitting}
                        className="min-h-[120px] focus-visible:ring-yuhu-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isEditing && (
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                  className="border-yuhu-primary text-yuhu-primary hover:bg-yuhu-primary/10"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-yuhu-primary hover:bg-yuhu-dark"
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
            )}
          </form>
        </Form>
      </CardContent>
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-xs text-center">
          <h2 className="text-lg font-bold mb-2">Delete Profile?</h2>
          <p className="mb-4">Are you sure you want to delete your profile? This action cannot be undone.</p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProfile} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default UserProfile;

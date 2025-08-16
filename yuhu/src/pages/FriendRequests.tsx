import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, UserPlus, RefreshCw, AlertTriangle, Database, Trash2 } from 'lucide-react';
import { getPendingRequests, fetchAllUsersExceptCurrent, respondToFriendRequest, isUserProfileValid, cleanupInvalidUserReferences, cleanupDeletedUsers, removeSpecificUsers, checkProfilesTableSchema, checkUserExistence, cleanupOrphanedProfiles } from '../services/friendService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const FriendRequests: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [manualCleanupInput, setManualCleanupInput] = useState('');

  // Fetch pending requests
  useEffect(() => {
    const fetchRequests = async () => {
      if (!user?.email) return;
      
      setLoading(true);
      try {
        const requests = await getPendingRequests(user.email);
        // Fetch sender profiles
        const senderEmails = requests.map(r => r.sender_email);
        let profiles = [];
        if (senderEmails.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, email, avatar_url')
            .in('email', senderEmails);
          profiles = data || [];
        }
        // Attach profile to each request
        const requestsWithProfiles = requests.map(r => ({
          ...r,
          profile: profiles.find(p => p.email === r.sender_email)
        }));
        setPendingRequests(requestsWithProfiles);
      } catch (error) {
        console.error('Error fetching requests:', error);
        toast({
          title: "Error",
          description: "Failed to fetch friend requests",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [user?.email, toast]);

  // Fetch suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!user?.email) return;
      
      try {
        const allUsers = await fetchAllUsersExceptCurrent(user.email);
        
        // Additional filtering to ensure we only show valid, active users
        const validUsers = allUsers.filter(isUserProfileValid);
        
        // Remove users who are already friends or have pending requests
        const pendingEmails = pendingRequests.map(r => r.sender_email);
        const suggestions = validUsers.filter(u => !pendingEmails.includes(u.email));
        
        // Store debug information
        setDebugInfo({
          total: allUsers.length,
          valid: validUsers.length,
          filtered: suggestions.length,
          invalidUsers: allUsers.filter(u => !isUserProfileValid(u)).map(u => ({
            id: u.id,
            email: u.email,
            username: u.username
          }))
        });
        
        console.log('Fetched suggestions:', {
          total: allUsers.length,
          valid: validUsers.length,
          filtered: suggestions.length,
          invalidUsers: allUsers.filter(u => !isUserProfileValid(u))
        });
        
        setSuggestions(suggestions);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        toast({
          title: "Error",
          description: "Failed to fetch user suggestions",
          variant: "destructive",
        });
      }
    };
    fetchSuggestions();
  }, [user?.email, pendingRequests, toast]);

  // Handle cleanup of invalid user references
  const handleCleanup = async () => {
    if (!user?.email) return;
    
    setCleaningUp(true);
    try {
      const result = await cleanupInvalidUserReferences();
      
      toast({
        title: "Cleanup completed",
        description: `Found ${result.invalidProfiles} invalid profiles and cleaned up ${result.orphanedFriends} orphaned friend records.`,
      });
      
      // Refresh suggestions after cleanup
      const allUsers = await fetchAllUsersExceptCurrent(user.email);
      const validUsers = allUsers.filter(isUserProfileValid);
      const pendingEmails = pendingRequests.map(r => r.sender_email);
      const newSuggestions = validUsers.filter(u => !pendingEmails.includes(u.email));
      setSuggestions(newSuggestions);
      
      // Update debug info
      setDebugInfo({
        total: allUsers.length,
        valid: validUsers.length,
        filtered: newSuggestions.length,
        invalidUsers: allUsers.filter(u => !isUserProfileValid(u)).map(u => ({
          id: u.id,
          email: u.email,
          username: u.username
        }))
      });
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      toast({
        title: "Error",
        description: "Failed to perform cleanup",
        variant: "destructive",
      });
    } finally {
      setCleaningUp(false);
    }
  };

  // Handle cleanup of deleted users
  const handleCleanupDeletedUsers = async () => {
    if (!user?.email) return;
    
    setCleaningUp(true);
    try {
      const result = await cleanupDeletedUsers();
      
      toast({
        title: "Deleted Users Cleanup completed",
        description: `Deleted ${result.deleted} suspicious profiles out of ${result.total} total profiles. Also cleaned up ${result.orphanedFriends} orphaned friend records.`,
      });
      
      // Refresh suggestions after cleanup
      const allUsers = await fetchAllUsersExceptCurrent(user.email);
      const validUsers = allUsers.filter(isUserProfileValid);
      const pendingEmails = pendingRequests.map(r => r.sender_email);
      const newSuggestions = validUsers.filter(u => !pendingEmails.includes(u.email));
      setSuggestions(newSuggestions);
      
      // Update debug info
      setDebugInfo({
        total: allUsers.length,
        valid: validUsers.length,
        filtered: newSuggestions.length,
        invalidUsers: allUsers.filter(u => !isUserProfileValid(u)).map(u => ({
          id: u.id,
          email: u.email,
          username: u.username
        }))
      });
      
    } catch (error) {
      console.error('Error during deleted users cleanup:', error);
      toast({
        title: "Error",
        description: "Failed to perform deleted users cleanup",
        variant: "destructive",
      });
    } finally {
      setCleaningUp(false);
    }
  };

  // Handle manual cleanup of specific users
  const handleManualCleanup = async () => {
    if (!user?.email || !manualCleanupInput.trim()) return;
    
    const identifiers = manualCleanupInput.split(',').map(id => id.trim()).filter(id => id.length > 0);
    if (identifiers.length === 0) return;
    
    setCleaningUp(true);
    try {
      const result = await removeSpecificUsers(identifiers);
      
      toast({
        title: "Manual Cleanup completed",
        description: `Deleted ${result.deleted} profiles matching your criteria. Also cleaned up ${result.orphanedFriends} orphaned friend records.`,
      });
      
      // Clear input
      setManualCleanupInput('');
      
      // Refresh suggestions after cleanup
      const allUsers = await fetchAllUsersExceptCurrent(user.email);
      const validUsers = allUsers.filter(isUserProfileValid);
      const pendingEmails = pendingRequests.map(r => r.sender_email);
      const newSuggestions = validUsers.filter(u => !pendingEmails.includes(u.email));
      setSuggestions(newSuggestions);
      
      // Update debug info
      setDebugInfo({
        total: allUsers.length,
        valid: validUsers.length,
        filtered: newSuggestions.length,
        invalidUsers: allUsers.filter(u => !isUserProfileValid(u)).map(u => ({
          id: u.id,
          email: u.email,
          username: u.username
        }))
      });
      
    } catch (error) {
      console.error('Error during manual cleanup:', error);
      toast({
        title: "Error",
        description: "Failed to perform manual cleanup",
        variant: "destructive",
      });
    } finally {
      setCleaningUp(false);
    }
  };

  // Handle cleanup of orphaned profiles
  const handleCleanupOrphanedProfiles = async () => {
    if (!user?.email) return;
    
    setCleaningUp(true);
    try {
      const result = await cleanupOrphanedProfiles();
      
      toast({
        title: "Orphaned Profiles Cleanup completed",
        description: `Deleted ${result.deleted} orphaned profiles out of ${result.total} total profiles. Also cleaned up ${result.orphanedFriends} orphaned friend records.`,
      });
      
      // Refresh suggestions after cleanup
      const allUsers = await fetchAllUsersExceptCurrent(user.email);
      const validUsers = allUsers.filter(isUserProfileValid);
      const pendingEmails = pendingRequests.map(r => r.sender_email);
      const newSuggestions = validUsers.filter(u => !pendingEmails.includes(u.email));
      setSuggestions(newSuggestions);
      
      // Update debug info
      setDebugInfo({
        total: allUsers.length,
        valid: validUsers.length,
        filtered: newSuggestions.length,
        invalidUsers: allUsers.filter(u => !isUserProfileValid(u)).map(u => ({
          id: u.id,
          email: u.email,
          username: u.username
        }))
      });
      
    } catch (error) {
      console.error('Error during orphaned profiles cleanup:', error);
      toast({
        title: "Error",
        description: "Failed to perform orphaned profiles cleanup",
        variant: "destructive",
      });
    } finally {
      setCleaningUp(false);
    }
  };

  // Check user existence in both tables
  const handleCheckUserExistence = async () => {
    try {
      const result = await checkUserExistence();
      
      toast({
        title: "User Existence Check Complete",
        description: `Found ${result.total} total profiles, ${result.orphaned} orphaned profiles. Check console for details.`,
      });
      
      console.log('User existence check result:', result);
      
    } catch (error) {
      console.error('Error checking user existence:', error);
      toast({
        title: "Error",
        description: "Failed to check user existence",
        variant: "destructive",
      });
    }
  };

  // Check database schema for debugging
  const handleCheckSchema = async () => {
    try {
      const columns = await checkProfilesTableSchema();
      if (columns) {
        toast({
          title: "Schema Check Complete",
          description: `Found ${columns.length} columns in profiles table. Check console for details.`,
        });
      }
    } catch (error) {
      console.error('Error checking schema:', error);
      toast({
        title: "Error",
        description: "Failed to check database schema",
        variant: "destructive",
      });
    }
  };

  const handleRespondToRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      await respondToFriendRequest(requestId, status);
      
      // Remove the request from the local state
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      
      // Show success message
      toast({
        title: status === 'accepted' ? "Friend request accepted" : "Friend request rejected",
        description: status === 'accepted' 
          ? "You are now friends!" 
          : "Friend request has been rejected",
      });
    } catch (error) {
      console.error('Error responding to request:', error);
      toast({
        title: "Error",
        description: "Failed to respond to friend request",
        variant: "destructive",
      });
    }
  };

  const handleSendFriendRequest = async (receiverEmail: string) => {
    if (!user?.email) return;
    
    try {
      await supabase.from('friend_requests').insert([
        { sender_email: user.email, receiver_email: receiverEmail, status: 'pending' }
      ]);
      
      // Remove from suggestions
      setSuggestions(prev => prev.filter(s => s.email !== receiverEmail));
      
      toast({
        title: "Friend request sent",
        description: "Your friend request has been sent successfully",
      });
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive",
      });
    }
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Friend Requests</h1>
          <p className="text-gray-600">Manage your friend requests and discover new people</p>
          
          {/* Debug and Cleanup Section */}
          {debugInfo && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h3 className="font-medium text-yellow-800">Debug Information</h3>
              </div>
              <div className="text-sm text-yellow-700 space-y-1">
                <p>Total users fetched: {debugInfo.total}</p>
                <p>Valid users: {debugInfo.valid}</p>
                <p>Filtered suggestions: {debugInfo.filtered}</p>
                {debugInfo.invalidUsers.length > 0 && (
                  <div>
                    <p className="font-medium">Invalid users found: {debugInfo.invalidUsers.length}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer">Click to see details</summary>
                      <div className="mt-2 space-y-1">
                        {debugInfo.invalidUsers.map((invalidUser: any, index: number) => (
                          <div key={index} className="text-xs bg-yellow-100 p-2 rounded">
                            ID: {invalidUser.id}, Email: {invalidUser.email}, Username: {invalidUser.username}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
              <Button 
                onClick={handleCleanup} 
                disabled={cleaningUp}
                variant="outline" 
                size="sm" 
                className="mt-3 mr-2"
              >
                {cleaningUp ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  'Clean Up Invalid Users'
                )}
              </Button>
              
              <Button 
                onClick={handleCleanupDeletedUsers} 
                disabled={cleaningUp}
                variant="outline" 
                size="sm" 
                className="mt-3 mr-2"
              >
                {cleaningUp ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clean Deleted Users
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleCheckSchema} 
                variant="outline" 
                size="sm" 
                className="mt-3"
              >
                <Database className="h-4 w-4 mr-2" />
                Check Schema
              </Button>
              
              <Button 
                onClick={handleCheckUserExistence} 
                variant="outline" 
                size="sm" 
                className="mt-3 ml-2"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Check User Existence
              </Button>
              
              <Button 
                onClick={handleCleanupOrphanedProfiles} 
                disabled={cleaningUp}
                variant="outline" 
                size="sm" 
                className="mt-3 ml-2"
              >
                {cleaningUp ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clean Orphaned Profiles
                  </>
                )}
              </Button>

              {/* Manual Cleanup Section */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Manual Cleanup</h4>
                <p className="text-sm text-blue-700 mb-2">
                  Remove specific users by entering their email or username (comma-separated for multiple)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., chary, abhinav, test@email.com"
                    value={manualCleanupInput}
                    onChange={(e) => setManualCleanupInput(e.target.value)}
                    className="flex-1 px-3 py-2 border border-blue-300 rounded-md text-sm"
                  />
                  <Button 
                    onClick={handleManualCleanup} 
                    disabled={cleaningUp || !manualCleanupInput.trim()}
                    variant="outline" 
                    size="sm"
                  >
                    {cleaningUp ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Cleaning...
                      </>
                    ) : (
                      'Remove Users'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Pending Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Pending Requests
              </CardTitle>
              <CardDescription>
                {pendingRequests.length} pending friend request{pendingRequests.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading requests...
                </div>
              ) : pendingRequests.length > 0 ? (
                <div className="space-y-4">
                  {pendingRequests.map(request => (
                    <div 
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={request.profile?.avatar_url} alt={request.profile?.username} />
                          <AvatarFallback>{request.profile?.username?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="ml-3">
                          <div className="text-sm font-medium">{request.profile?.username}</div>
                          <div className="text-xs text-muted-foreground">{request.profile?.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-500"
                          onClick={() => handleRespondToRequest(request.id, 'rejected')}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Reject</span>
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 w-8 p-0 bg-yuhu-primary hover:bg-yuhu-dark"
                          onClick={() => handleRespondToRequest(request.id, 'accepted')}
                        >
                          <Check className="h-4 w-4" />
                          <span className="sr-only">Accept</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No pending requests
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle>People You May Know</CardTitle>
              <CardDescription>
                Discover and connect with new people
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestions.length > 0 ? (
                <div className="space-y-3">
                  {suggestions.map(suggestion => (
                    <div 
                      key={suggestion.email}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={suggestion.avatar_url} alt={suggestion.username} />
                          <AvatarFallback>{suggestion.username?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="ml-3">
                          <div className="text-sm font-medium">{suggestion.username}</div>
                          <div className="text-xs text-muted-foreground">{suggestion.email}</div>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleSendFriendRequest(suggestion.email)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No suggestions available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default FriendRequests;

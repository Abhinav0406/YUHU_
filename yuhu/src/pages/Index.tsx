import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import AuthForm from '@/components/AuthForm';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users, Calendar, Bookmark, FileText } from 'lucide-react';

const Index = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat');
    }
  }, [isAuthenticated, navigate]);
  
  if (isAuthenticated) {
    return null;
  }
  
  return (
    <Layout showHeader={true}>
      <div className="min-h-[90vh] flex flex-col md:flex-row bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
        {/* Hero section */}
        <div className="flex-1 p-6 md:p-12 flex flex-col justify-center">
          <div className="max-w-xl mx-auto md:mx-0">
            <div className="inline-block mb-4">
              <div className="flex items-center bg-yuhu-primary/20 text-yuhu-primary rounded-full px-3 py-1 text-sm font-medium">
                <span className="w-2 h-2 bg-yuhu-primary rounded-full mr-2"></span>
                New! Study Buddy Matching
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-white flex items-center">
              
              <span className="text-yuhu-primary">Yuhu:</span>
             
              <span className="ml-2 block md:inline">Your Campus, <br className="md:hidden" />Connected</span>
            </h1>
            <p className="text-xl text-zinc-300 mb-8">
              The chat platform designed specifically for college students. Connect with classmates, form study groups, and keep up with campus events - all in one place.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="flex items-start">
                <div className="p-2 bg-yuhu-primary/20 rounded-lg mr-3">
                  <MessageSquare className="h-5 w-5 text-yuhu-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1 text-white">Real-time Chat</h3>
                  <p className="text-zinc-300 text-sm">Connect instantly with classmates and friends</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="p-2 bg-yuhu-primary/20 rounded-lg mr-3">
                  <Users className="h-5 w-5 text-yuhu-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1 text-white">Study Groups</h3>
                  <p className="text-zinc-300 text-sm">Create and manage study sessions</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="p-2 bg-yuhu-primary/20 rounded-lg mr-3">
                  <Calendar className="h-5 w-5 text-yuhu-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1 text-white">Event Notifications</h3>
                  <p className="text-zinc-300 text-sm">Stay updated on campus activities</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="p-2 bg-yuhu-primary/20 rounded-lg mr-3">
                  <FileText className="h-5 w-5 text-yuhu-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1 text-white">Note Sharing</h3>
                  <p className="text-zinc-300 text-sm">Exchange notes and study materials</p>
                </div>
              </div>
            </div>
            
            <div className="hidden md:block">
              <Button className="bg-yuhu-primary hover:bg-yuhu-dark text-white" size="lg">
                Get Started
              </Button>
              <Button variant="outline" className="ml-4 border-zinc-600 text-zinc-200 hover:bg-zinc-800" size="lg">
                Learn More
              </Button>
            </div>
          </div>
        </div>
        
        {/* Auth form section */}
        <div className="flex-1 p-6 md:p-12 flex items-center justify-center bg-zinc-900">
          <div className="w-full max-w-md">
            <AuthForm />
          </div>
        </div>
      </div>
      
      <div className="md:hidden p-6 flex justify-center space-x-4 border-t border-zinc-800 bg-zinc-900">
        <Button className="bg-yuhu-primary hover:bg-yuhu-dark text-white">
          Get Started
        </Button>
        <Button variant="outline" className="border-zinc-600 text-zinc-200 hover:bg-zinc-800">
          Learn More
        </Button>
      </div>
    </Layout>
  );
};

export default Index;

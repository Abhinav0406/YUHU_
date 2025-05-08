
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import AuthForm from '@/components/AuthForm';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users, Calendar, Bookmark, FileText } from 'lucide-react';

const Index = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  if (isAuthenticated) {
    navigate('/chat');
    return null;
  }
  
  return (
    <Layout showHeader={true}>
      <div className="min-h-[90vh] flex flex-col md:flex-row">
        {/* Hero section */}
        <div className="flex-1 p-6 md:p-12 flex flex-col justify-center">
          <div className="max-w-xl mx-auto md:mx-0">
            <div className="inline-block mb-4">
              <div className="flex items-center bg-yuhu-primary/10 text-yuhu-primary rounded-full px-3 py-1 text-sm font-medium">
                <span className="w-2 h-2 bg-yuhu-primary rounded-full mr-2"></span>
                New! Study Buddy Matching
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              <span className="text-yuhu-primary">Yuhu:</span> Your Campus, <br />Connected
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              The chat platform designed specifically for college students. Connect with classmates, form study groups, and keep up with campus events - all in one place.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="flex items-start">
                <div className="p-2 bg-yuhu-primary/10 rounded-lg mr-3">
                  <MessageSquare className="h-5 w-5 text-yuhu-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Real-time Chat</h3>
                  <p className="text-gray-600 text-sm">Connect instantly with classmates and friends</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="p-2 bg-yuhu-primary/10 rounded-lg mr-3">
                  <Users className="h-5 w-5 text-yuhu-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Study Groups</h3>
                  <p className="text-gray-600 text-sm">Create and manage study sessions</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="p-2 bg-yuhu-primary/10 rounded-lg mr-3">
                  <Calendar className="h-5 w-5 text-yuhu-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Event Notifications</h3>
                  <p className="text-gray-600 text-sm">Stay updated on campus activities</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="p-2 bg-yuhu-primary/10 rounded-lg mr-3">
                  <FileText className="h-5 w-5 text-yuhu-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Note Sharing</h3>
                  <p className="text-gray-600 text-sm">Exchange notes and study materials</p>
                </div>
              </div>
            </div>
            
            <div className="hidden md:block">
              <Button className="bg-yuhu-primary hover:bg-yuhu-dark" size="lg">
                Get Started
              </Button>
              <Button variant="outline" className="ml-4" size="lg">
                Learn More
              </Button>
            </div>
          </div>
        </div>
        
        {/* Auth form section */}
        <div className="flex-1 p-6 md:p-12 flex items-center justify-center bg-gradient-to-b from-yuhu-light to-white">
          <div className="w-full max-w-md">
            <AuthForm />
          </div>
        </div>
      </div>
      
      <div className="md:hidden p-6 flex justify-center space-x-4 border-t">
        <Button className="bg-yuhu-primary hover:bg-yuhu-dark">
          Get Started
        </Button>
        <Button variant="outline">
          Learn More
        </Button>
      </div>
    </Layout>
  );
};

export default Index;

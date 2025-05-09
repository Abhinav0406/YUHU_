import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MessageSquare, User, Settings, LogOut, UserPlus } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import UserExplorer from './UserExplorer';

const Header: React.FC = () => {
  const { user, profile, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  // Don't show navigation on login page
  if (location.pathname === '/' && !isAuthenticated) {
    return (
      <header className="bg-white border-b border-gray-100 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-yuhu-primary">Yuhu</h1>
          <span className="ml-2 text-sm text-gray-500">Your Campus, Connected</span>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-gray-100 py-3 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <Link to={isAuthenticated ? "/chat" : "/"}>
          <h1 className="text-2xl font-bold text-yuhu-primary">Yuhu</h1>
        </Link>
      </div>

      {isAuthenticated ? (
        <div className="flex items-center space-x-4">
          <nav className="hidden md:flex items-center space-x-1">
            <Button variant="ghost" size="sm" className="text-gray-600" asChild>
              <Link to="/chat">
                <MessageSquare className="h-5 w-5 mr-1" />
                <span>Chats</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-600" asChild>
              <Link to="/profile">
                <User className="h-5 w-5 mr-1" />
                <span>Profile</span>
              </Link>
            </Button>
          </nav>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-yuhu-primary" title="Add Friend">
                <UserPlus className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-full">
              <UserExplorer />
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar>
                  <AvatarImage src={profile?.avatar} alt={profile?.username} />
                  <AvatarFallback>{profile?.username ? getInitials(profile.username) : 'U'}</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-medium">{profile?.fullName}</p>
                  <p className="text-xs text-muted-foreground">@{profile?.username}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/chat" className="flex items-center cursor-pointer">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  <span>Chats</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center cursor-pointer" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="flex items-center space-x-3">
          <Button variant="ghost" asChild>
            <Link to="/">Login</Link>
          </Button>
          <Button className="bg-yuhu-primary hover:bg-yuhu-dark" asChild>
            <Link to="/">Sign Up</Link>
          </Button>
        </div>
      )}
    </header>
  );
};

export default Header;

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
import { MessageSquare, User, Settings, LogOut, UserPlus, Menu, X, MoreVertical } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import UserExplorerTabs from './UserExplorer';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onSidebarToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSidebarToggle }) => {
  const { user, profile, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <header className="bg-zinc-900 border-b border-zinc-800 py-4 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center">
          <img src="./images/logo2.webp" alt="Yuhu Logo" className="h-8 w-8 mr-2" />
          <h1 className="text-xl sm:text-2xl font-bold text-white">Yuhu</h1>
          <span className="ml-2 text-sm text-zinc-400 hidden sm:inline">Your Campus, Connected</span>
        </div>
      </header>
    );
  }

  // Use dark header for chat page
  const isChatPage = location.pathname.startsWith('/chat');

  return (
    <header className={cn(
      "border-b py-3 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50",
      isChatPage ? "bg-zinc-900 text-white" : "bg-white text-yuhu-primary"
    )}>
      <div className="flex items-center">
        {/* Hamburger for mobile */}
        {onSidebarToggle && isChatPage && (
          <button
            className="md:hidden mr-2 p-2 rounded-full bg-zinc-800 text-white"
            onClick={onSidebarToggle}
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}
        <Link to={isAuthenticated ? "/chat" : "/"} className="flex items-center">
          <img src="/images/logo2.webp" alt="Yuhu Logo" className="h-8 w-8 mr-2" />
          <h1 className="text-xl sm:text-2xl font-bold">Yuhu</h1>
        </Link>
      </div>

      {isAuthenticated ? (
        <>
          {/* Mobile Menu Button (right side) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <MoreVertical className="h-6 w-6" />}
          </Button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <nav className="flex items-center space-x-1">
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
                <UserExplorerTabs />
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

          {/* Mobile Navigation */}
          <div
            className={cn(
              "fixed inset-0 bg-zinc-900 text-white z-40 transform transition-transform duration-300 ease-in-out md:hidden",
              isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-xl font-semibold">Menu</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <nav className="flex-1 p-4 space-y-4">
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link to="/chat" onClick={() => setIsMobileMenuOpen(false)}>
                    <MessageSquare className="h-5 w-5 mr-2" />
                    <span>Chats</span>
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                    <User className="h-5 w-5 mr-2" />
                    <span>Profile</span>
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)}>
                    <Settings className="h-5 w-5 mr-2" />
                    <span>Settings</span>
                  </Link>
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start">
                      <UserPlus className="h-5 w-5 mr-2" />
                      <span>Add Friend</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg w-full">
                    <UserExplorerTabs />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-600"
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  <span>Logout</span>
                </Button>
              </nav>
            </div>
          </div>
        </>
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

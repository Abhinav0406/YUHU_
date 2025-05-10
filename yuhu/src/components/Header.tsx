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
  const [showAvatarModal, setShowAvatarModal] = useState(false);

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
          <img src="./images/Logo2.png" alt="Yuhu Logo" className="h-8 w-8 mr-2" />
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
          <img src="/images/Logo2.png" alt="Yuhu Logo" className="h-8 w-8 mr-2" />
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

          {/* Enhanced Mobile Navigation */}
          <div
            className={cn(
              "fixed inset-0 z-50 flex md:hidden",
              isMobileMenuOpen ? "backdrop-blur-md bg-black/40" : "pointer-events-none"
            )}
          >
            {/* Slide-in menu */}
            <aside className={cn(
              "relative w-4/5 max-w-xs h-full bg-zinc-900 shadow-2xl rounded-r-3xl p-6 flex flex-col transition-transform duration-300",
              isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
              {/* Profile */}
              <div className="flex flex-col items-center mb-8">
                <Avatar className="h-16 w-16 shadow-lg border-4 border-yuhu-primary mb-2 cursor-pointer" onClick={() => setShowAvatarModal(true)}>
                  <AvatarImage src={profile?.avatar || ''} alt={profile?.username} />
                  <AvatarFallback>{profile?.username ? getInitials(profile.username) : 'U'}</AvatarFallback>
                </Avatar>
                <div className="text-lg font-bold text-white">{profile?.fullName}</div>
                <div className="text-sm text-yuhu-primary">@{profile?.username}</div>
              </div>
              {/* Menu Items */}
              <nav className="flex-1 flex flex-col gap-4">
                <Button className="w-full py-3 rounded-xl bg-yuhu-primary/80 text-white hover:bg-yuhu-dark transition" asChild>
                  <Link to="/chat" onClick={() => setIsMobileMenuOpen(false)}>
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Chats
                  </Link>
                </Button>
                <Button className="w-full py-3 rounded-xl bg-zinc-800 text-white hover:bg-yuhu-primary/60 transition" asChild>
                  <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                    <User className="h-5 w-5 mr-2" />
                    Profile
                  </Link>
                </Button>
                <Button className="w-full py-3 rounded-xl bg-zinc-800 text-white hover:bg-yuhu-primary/60 transition" asChild>
                  <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)}>
                    <Settings className="h-5 w-5 mr-2" />
                    Settings
                  </Link>
                </Button>
                <Button className="w-full py-3 rounded-xl bg-red-600 text-white mt-auto hover:bg-red-700 transition" onClick={handleLogout}>
                  <LogOut className="h-5 w-5 mr-2" />
                  Logout
                </Button>
              </nav>
              {/* Close button */}
              <button
                className="absolute top-4 right-4 text-white bg-black/30 rounded-full p-2"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </aside>
            {/* Avatar Modal for mobile sidebar */}
            <Dialog open={showAvatarModal} onOpenChange={setShowAvatarModal}>
              <DialogContent className="flex items-center justify-center bg-black p-0 max-w-xs sm:max-w-md">
                <img
                  src={profile?.avatar || ''}
                  alt="Profile"
                  className="max-w-full max-h-[80vh] rounded-lg object-contain"
                  style={{ background: '#222' }}
                />
              </DialogContent>
            </Dialog>
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

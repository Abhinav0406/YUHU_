import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, User, Settings, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

const FooterNavigation: React.FC = () => {
  const location = useLocation();

  const navItems = [
    {
      path: '/chat',
      icon: MessageSquare,
      label: 'Chats',
      active: location.pathname.startsWith('/chat')
    },
    {
      path: '/profile',
      icon: User,
      label: 'Profile',
      active: location.pathname.startsWith('/profile')
    },
    {
      path: '/settings',
      icon: Settings,
      label: 'Settings',
      active: location.pathname.startsWith('/settings')
    },
    {
      path: '/call-history',
      icon: Phone,
      label: 'Calls',
      active: location.pathname.startsWith('/call-history')
    }
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 z-50 md:hidden">
      <nav className="flex items-center justify-around py-2 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 touch-target",
                item.active
                  ? "text-yuhu-primary bg-yuhu-primary/10"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 mb-1 transition-transform",
                item.active && "scale-110"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                item.active ? "text-yuhu-primary" : "text-zinc-400"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </footer>
  );
};

export default FooterNavigation;


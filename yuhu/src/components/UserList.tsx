import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  username?: string;
  email: string;
  avatar_url?: string;
}

interface UserListProps {
  users: User[];
  onUserSelect: (user: User) => void;
  onUserDelete?: (user: User) => void;
  selectedUserId?: string;
  showDeleteButton?: boolean;
}

const UserList: React.FC<UserListProps> = ({ 
  users, 
  onUserSelect, 
  onUserDelete, 
  selectedUserId,
  showDeleteButton = false 
}) => {
  const handleDelete = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    if (onUserDelete) {
      onUserDelete(user);
    }
  };

  return (
    <div className="space-y-0">
      <AnimatePresence>
        {users.map((user) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className={`relative w-full transition-all duration-200 group
              ${selectedUserId === user.id ? 'bg-yuhu-primary/10' : 'hover:bg-zinc-800/50'}
            `}
          >
            <button
              className="flex items-center w-full px-4 py-3 text-left touch-target"
              onClick={() => onUserSelect(user)}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0 mr-3">
                <img
                  src={user.avatar_url || '/images/placeholder.svg'}
                  alt={user.username || user.email}
                  className="w-12 h-12 rounded-full object-cover border border-zinc-700/50"
                  onError={(e) => {
                    e.currentTarget.src = '/images/placeholder.svg';
                  }}
                />
                {/* Online indicator */}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900"></div>
              </div>
              
              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-medium text-zinc-100 truncate">
                    {user.username || user.email.split('@')[0]}
                  </h3>
                  <span className="text-xs text-zinc-500 ml-2">now</span>
                </div>
                <p className="text-sm text-zinc-400 truncate mt-0.5">
                  Tap to start chatting
                </p>
              </div>
              
              {/* Delete button */}
              {showDeleteButton && onUserDelete && (
                <div
                  className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100 ml-2 rounded-md flex items-center justify-center cursor-pointer"
                  onClick={(e) => handleDelete(e, user)}
                  title="Remove friend"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDelete(e as any, user);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </div>
              )}
            </button>
            
            {/* WhatsApp-style separator */}
            <div className="absolute bottom-0 left-16 right-4 h-px bg-zinc-800/50"></div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {users.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No friends yet</h3>
          <p className="text-sm text-zinc-500">Add friends to start chatting</p>
        </div>
      )}
    </div>
  );
};

export default UserList;

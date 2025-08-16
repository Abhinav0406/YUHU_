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
    <div className="space-y-1">
      <AnimatePresence>
        {users.map((user) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl transition group shadow-sm
              ${selectedUserId === user.id ? 'bg-yuhu-primary/20 ring-2 ring-yuhu-primary' : 'bg-zinc-900 hover:bg-zinc-800'}
            `}
          >
            <button
              className="flex items-center gap-3 flex-1 text-left"
              onClick={() => onUserSelect(user)}
            >
              <div className="relative">
                <img
                  src={user.avatar_url}
                  alt={user.username || user.email}
                  className="w-10 h-10 rounded-full border border-zinc-700 object-cover shadow"
                />
              </div>
              <span className="text-base font-medium text-zinc-100 truncate flex-1 group-hover:text-yuhu-primary">
                {user.username || user.email}
              </span>
            </button>
            
            {showDeleteButton && onUserDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => handleDelete(e, user)}
                title="Remove friend"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default UserList;

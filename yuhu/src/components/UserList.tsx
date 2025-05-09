import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: string;
  username?: string;
  email: string;
  avatar_url?: string;
}

interface UserListProps {
  users: User[];
  onUserSelect: (user: User) => void;
  selectedUserId?: string;
}

const UserList: React.FC<UserListProps> = ({ users, onUserSelect, selectedUserId }) => {
  return (
    <div className="space-y-1">
      <AnimatePresence>
        {users.map((user) => (
          <motion.button
            key={user.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition group shadow-sm
              ${selectedUserId === user.id ? 'bg-yuhu-primary/20 ring-2 ring-yuhu-primary' : 'bg-zinc-900 hover:bg-zinc-800'}
            `}
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
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default UserList;

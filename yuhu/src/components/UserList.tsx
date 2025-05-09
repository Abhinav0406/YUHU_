import React from 'react';

interface User {
  id: string;
  username?: string;
  email: string;
  avatar_url?: string;
}

interface UserListProps {
  users: User[];
  onUserSelect: (user: User) => void;
}

const UserList: React.FC<UserListProps> = ({ users, onUserSelect }) => {
  return (
    <div className="space-y-1">
      {users.map((user) => (
        <button
          key={user.id}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition group shadow-sm"
          onClick={() => onUserSelect(user)}
        >
          <div className="relative">
            <img
              src={user.avatar_url}
              alt={user.username || user.email}
              className="w-10 h-10 rounded-full border border-zinc-700 object-cover"
            />
          </div>
          <span className="text-base font-medium text-zinc-100 truncate flex-1 group-hover:text-yuhu-primary">
            {user.username || user.email}
          </span>
        </button>
      ))}
    </div>
  );
};

export default UserList;

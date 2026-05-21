'use client';

import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { disconnectAll } from '@/lib/socket';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    disconnectAll();
    logout();
    router.push('/login');
  };

  return (
    <div className="flex-1 p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="bg-white rounded-lg shadow-sm p-6 max-w-md">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xl font-bold">
            {user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-semibold text-lg">{user?.username}</p>
            <p className="text-gray-500">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
          Sign Out
        </button>
      </div>
    </div>
  );
}

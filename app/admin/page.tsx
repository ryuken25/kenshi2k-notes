'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, UserPlus, FolderLock, X } from 'lucide-react';

interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

interface FolderOption {
  id: number;
  name: string;
  path: string;
}

interface Permission {
  id: number;
  user_id: number;
  folder_id: number;
  name: string;
  path: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accessUserId, setAccessUserId] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState('');

  async function loadAll() {
    const [usersRes, foldersRes, permsRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/folders'),
      fetch('/api/admin/permissions'),
    ]);

    if (usersRes.status === 403 || usersRes.status === 401) {
      router.push('/');
      return;
    }

    const usersData = await usersRes.json();
    const foldersData = await foldersRes.json();
    const permsData = await permsRes.json();

    setUsers(usersData.users);
    setFolders(foldersData.folders);
    setPermissions(permsData.permissions);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to add user');
      return;
    }

    setUsername('');
    setPassword('');
    setRole('user');
    await loadAll();
  }

  async function handleDeleteUser(id: number) {
    if (!confirm('Delete this user?')) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to delete user');
      return;
    }
    await loadAll();
  }

  async function handleGrantAccess() {
    if (!accessUserId || !selectedFolderId) return;
    const res = await fetch('/api/admin/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: accessUserId, folderId: Number(selectedFolderId) }),
    });
    if (res.ok) {
      setSelectedFolderId('');
      await loadAll();
    }
  }

  async function handleRevokeAccess(userId: number, folderId: number) {
    const res = await fetch(
      `/api/admin/permissions?userId=${userId}&folderId=${folderId}`,
      { method: 'DELETE' }
    );
    if (res.ok) await loadAll();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#8a8a8a]">
        Loading…
      </div>
    );
  }

  const regularUsers = users.filter((u) => u.role === 'user');
  const permsForUser = (userId: number) =>
    permissions.filter((p) => p.user_id === userId);

  return (
    <div className="flex-1 bg-[#1e1e1e] px-8 py-6">
      <button
        onClick={() => router.push('/')}
        className="mb-4 flex items-center gap-1 text-sm text-[#8a8a8a] hover:text-white"
      >
        <ArrowLeft size={14} /> Back to vault
      </button>

      <h1 className="mb-6 text-lg font-semibold text-[#dcddde]">
        Admin Dashboard
      </h1>

      <div className="mb-8 flex flex-wrap gap-6">
        {/* Add user */}
        <div className="w-full max-w-md rounded-lg border border-[#363636] bg-[#262626] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#dcddde]">
            <UserPlus size={16} /> Add User
          </h2>
          <form onSubmit={handleAddUser} className="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-md border border-[#363636] bg-[#1e1e1e] px-3 py-2 text-sm text-[#dcddde] outline-none focus:border-[#7f6df2]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-[#363636] bg-[#1e1e1e] px-3 py-2 text-sm text-[#dcddde] outline-none focus:border-[#7f6df2]"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-[#363636] bg-[#1e1e1e] px-3 py-2 text-sm text-[#dcddde] outline-none focus:border-[#7f6df2]"
            >
              <option value="user">user</option>
              <option value="super_admin">super_admin</option>
            </select>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-md bg-[#7f6df2] px-3 py-2 text-sm font-medium text-white hover:bg-[#6c5ce0]"
            >
              Add User
            </button>
          </form>
        </div>

        {/* Folder access control */}
        <div className="w-full max-w-md rounded-lg border border-[#363636] bg-[#262626] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#dcddde]">
            <FolderLock size={16} /> Grant Folder Access
          </h2>
          {regularUsers.length === 0 ? (
            <p className="text-xs text-[#8a8a8a]">
              No regular users yet. Add one first.
            </p>
          ) : (
            <div className="space-y-3">
              <select
                value={accessUserId ?? ''}
                onChange={(e) => setAccessUserId(Number(e.target.value) || null)}
                className="w-full rounded-md border border-[#363636] bg-[#1e1e1e] px-3 py-2 text-sm text-[#dcddde] outline-none focus:border-[#7f6df2]"
              >
                <option value="">Select user…</option>
                {regularUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full rounded-md border border-[#363636] bg-[#1e1e1e] px-3 py-2 text-sm text-[#dcddde] outline-none focus:border-[#7f6df2]"
              >
                <option value="">Select folder…</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path}
                  </option>
                ))}
              </select>
              <button
                onClick={handleGrantAccess}
                disabled={!accessUserId || !selectedFolderId}
                className="w-full rounded-md bg-[#7f6df2] px-3 py-2 text-sm font-medium text-white hover:bg-[#6c5ce0] disabled:opacity-40"
              >
                Grant Access
              </button>

              {accessUserId && (
                <div className="mt-3 border-t border-[#363636] pt-3">
                  <p className="mb-2 text-xs font-medium text-[#8a8a8a]">
                    Current access for{' '}
                    {regularUsers.find((u) => u.id === accessUserId)?.username}:
                  </p>
                  {permsForUser(accessUserId).length === 0 ? (
                    <p className="text-xs text-[#6b6b6b]">
                      No folders granted yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {permsForUser(accessUserId).map((p) => (
                        <span
                          key={p.id}
                          className="flex items-center gap-1 rounded-full bg-[#37373d] px-2 py-1 text-xs text-[#dcddde]"
                        >
                          {p.path}
                          <button
                            onClick={() => handleRevokeAccess(p.user_id, p.folder_id)}
                            className="text-[#8a8a8a] hover:text-red-400"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl">
        <h2 className="mb-3 text-sm font-medium text-[#dcddde]">All Users</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#363636] text-left text-[#8a8a8a]">
              <th className="py-2 font-medium">Username</th>
              <th className="py-2 font-medium">Role</th>
              <th className="py-2 font-medium">Folder Access</th>
              <th className="py-2 font-medium">Created</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[#2a2a2a] text-[#dcddde]">
                <td className="py-2">{u.username}</td>
                <td className="py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      u.role === 'super_admin'
                        ? 'bg-[#7f6df2]/20 text-[#a89bfa]'
                        : 'bg-[#2a2a2a] text-[#b3b3b3]'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-2 text-xs text-[#8a8a8a]">
                  {u.role === 'super_admin'
                    ? 'Full access'
                    : permsForUser(u.id).length > 0
                      ? `${permsForUser(u.id).length} folder(s)`
                      : 'No access granted'}
                </td>
                <td className="py-2 text-[#8a8a8a]">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="py-2 text-right">
                  {u.username !== 'kenshi2k' && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-[#8a8a8a] hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

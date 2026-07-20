'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Download,
  LogOut,
  Shield,
  FileText,
  Network,
  Calendar,
  FolderTree as FolderTreeIcon,
  Sun,
  Moon,
  Pencil,
  Save,
  X as XIcon,
} from 'lucide-react';
import FolderTree, { TreeNode } from '@/components/FolderTree';
import MarkdownViewer from '@/components/MarkdownViewer';
import GraphView from '@/components/GraphView';

interface Me {
  id: number;
  username: string;
  role: 'super_admin' | 'editor' | 'user';
}

type ViewMode = 'files' | 'graph' | 'daily';

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<Me | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('files');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  // Daily: selected note content shown in-panel (not switching to files)
  const [dailyContent, setDailyContent] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const [dailySelectedId, setDailySelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadTree = useCallback(async () => {
    const res = await fetch('/api/tree');
    if (res.ok) {
      const data = await res.json();
      setTree(data.tree);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const meData = await meRes.json();
      setMe(meData.user);
      await loadTree();
      setLoading(false);
    })();
  }, [router, loadTree]);

  async function handleSelectFile(fileId: string) {
    setSelectedFileId(fileId);
    setViewMode('files');
    setIsEditing(false);
    const numericId = fileId.replace('file-', '');
    const res = await fetch(`/api/files/${numericId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedFile({ name: data.file.name, content: data.file.content });
    }
  }

  function handleStartEdit() {
    if (!selectedFile) return;
    setDraftContent(selectedFile.content);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setDraftContent('');
  }

  async function handleSaveEdit() {
    if (!selectedFileId) return;
    setSaving(true);
    const numericId = selectedFileId.replace('file-', '');
    try {
      const res = await fetch(`/api/files/${numericId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedFile({ name: data.file.name, content: data.file.content });
        setIsEditing(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectDaily(fileId: string) {
    setDailySelectedId(fileId);
    const numericId = fileId.replace('file-', '');
    const res = await fetch(`/api/files/${numericId}`);
    if (res.ok) {
      const data = await res.json();
      setDailyContent({ name: data.file.name, content: data.file.content });
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/files', { method: 'POST', body: formData });
    if (res.ok) {
      await loadTree();
    } else {
      const data = await res.json();
      alert(data.error || 'Upload failed');
    }
    e.target.value = '';
  }

  async function handleDownload() {
    if (!selectedFileId || downloading) return;
    const numericId = selectedFileId.replace('file-', '');
    setDownloading(true);

    try {
      // Prefer fetch+blob so cookies stay on same-origin request and
      // browsers reliably save a file instead of opening a blank tab.
      const res = await fetch(`/api/files/${numericId}?download=1`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/octet-stream' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Download failed (${res.status})`);
        return;
      }

      const buffer = await res.arrayBuffer();
      // Force non-previewable MIME even if a proxy rewrote Content-Type.
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const cd = res.headers.get('Content-Disposition') || '';
      const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const plain = cd.match(/filename=\"?([^\";]+)\"?/i);
      let filename =
        (star?.[1] ? decodeURIComponent(star[1]) : null) ||
        plain?.[1] ||
        selectedFile?.name ||
        'note.md';
      filename = filename.replace(/^[\"']|[\"']$/g, '').trim() || 'note.md';
      if (!/\.[A-Za-z0-9]{1,8}$/.test(filename)) {
        filename = `${filename}.md`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.setAttribute('download', filename);
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('Download error:', err);
      // Last-resort fallback for stubborn webviews.
      try {
        window.location.assign(`/api/files/${numericId}?download=1`);
      } catch {
        alert('Download failed. Coba lagi.');
      }
    } finally {
      setDownloading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // Navigate to a file via wikilink name (finds matching file in tree)
  function handleWikilink(fileName: string) {
    const target = findFileByName(tree, fileName.toLowerCase());
    if (target) {
      handleSelectFile(target.id);
    }
  }

  function findFileByName(nodes: TreeNode[], name: string): TreeNode | null {
    for (const n of nodes) {
      if (n.type === 'file') {
        const nodeName = n.name.replace(/\.md$/, '').toLowerCase();
        if (nodeName === name) return n;
      }
      if (n.children) {
        const found = findFileByName(n.children, name);
        if (found) return found;
      }
    }
    return null;
  }

  // Collect daily notes from tree
  function getDailyNotes(): TreeNode[] {
    const dailyFolder = tree.find(
      (n) => n.type === 'folder' && n.name === 'Daily'
    );
    if (!dailyFolder || !dailyFolder.children) return [];
    return [...dailyFolder.children].sort((a, b) =>
      b.name.localeCompare(a.name)
    );
  }

  // Collect all file nodes for graph view
  function getAllFiles(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    for (const n of nodes) {
      if (n.type === 'file') result.push(n);
      if (n.children) result.push(...getAllFiles(n.children));
    }
    return result;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1e1e1e] text-[#8a8a8a]">
        Loading vault…
      </div>
    );
  }

  const canWrite = me?.role === 'super_admin' || me?.role === 'editor';

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-[#1e1e1e]' : 'bg-[#ffffff]';
  const sidebarBg = isDark ? 'bg-[#181818]' : 'bg-[#f5f5f5]';
  const border = isDark ? 'border-[#2b2b2b]' : 'border-[#e0e0e0]';
  const textPrimary = isDark ? 'text-[#e8e8e8]' : 'text-[#1a1a1a]';
  const textSecondary = isDark ? 'text-[#acacac]' : 'text-[#555555]';
  const textMuted = isDark ? 'text-[#777777]' : 'text-[#999999]';
  const hoverBg = isDark ? 'hover:bg-[#2a2d2e]' : 'hover:bg-[#e8e8e8]';

  return (
    <div className={`flex h-screen overflow-hidden ${bg}`}>
      {/* Sidebar */}
      <aside className={`flex w-64 shrink-0 flex-col border-r ${border} ${sidebarBg}`}>
        {/* Header */}
        <div className={`border-b ${border} px-3 py-3`}>
          <span className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
            kenshi2k personal notes
          </span>
        </div>

        {/* Actions */}
        <div className={`flex items-center gap-1 border-b ${border} px-2 py-2`}>
          {canWrite && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload .md file"
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${textSecondary} ${hoverBg}`}
              >
                <Upload size={13} /> Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md"
                className="hidden"
                onChange={handleUpload}
              />
            </>
          )}
          {me?.role === 'super_admin' && (
            <button
              onClick={() => router.push('/admin')}
              title="Admin dashboard"
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${textSecondary} ${hoverBg}`}
            >
              <Shield size={13} /> Admin
            </button>
          )}
        </div>

        {/* View mode tabs */}
        <div className={`flex border-b ${border}`}>
          {([
            { mode: 'files' as ViewMode, icon: FolderTreeIcon, label: 'Files' },
            { mode: 'graph' as ViewMode, icon: Network, label: 'Graph' },
            { mode: 'daily' as ViewMode, icon: Calendar, label: 'Daily' },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex flex-1 items-center justify-center gap-1 py-2 text-xs transition-colors ${
                viewMode === mode
                  ? `border-b-2 border-[#7f6df2] ${textPrimary}`
                  : `${textMuted} ${hoverBg}`
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto py-1">
          {viewMode === 'files' && (
            tree.length === 0 ? (
              <p className={`px-3 py-2 text-xs ${textMuted}`}>No files yet.</p>
            ) : (
              <FolderTree
                nodes={[...tree].sort((a, b) => {
                  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })}
                onSelectFile={handleSelectFile}
                selectedFileId={selectedFileId}
                theme={theme}
              />
            )
          )}
          {viewMode === 'graph' && (
            <p className={`px-3 py-3 text-xs ${textMuted}`}>
              Graph displayed in main panel →
            </p>
          )}
          {viewMode === 'daily' && (
            <p className={`px-3 py-3 text-xs ${textMuted}`}>
              Daily notes displayed in main panel →
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between border-t ${border} px-3 py-2`}>
          <span className={`text-xs ${textMuted}`}>{me?.username}</span>
          <button
            onClick={handleLogout}
            title="Logout"
            className={`rounded p-1 ${textMuted} ${hoverBg}`}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main panel */}
      <main className={`flex flex-1 flex-col overflow-hidden ${bg}`}>
        {/* Top bar */}
        <div className={`flex shrink-0 items-center justify-between border-b ${border} px-6 py-2.5`}>
          <h1 className={`flex items-center gap-2 text-sm font-medium ${textPrimary}`}>
            {viewMode === 'files' && selectedFile && (
              <>
                <FileText size={15} className={textMuted} />
                {selectedFile.name}
              </>
            )}
            {viewMode === 'graph' && (
              <>
                <Network size={15} className="text-[#7f6df2]" />
                Graph View
              </>
            )}
            {viewMode === 'daily' && (
              <>
                <Calendar size={15} className="text-[#7f6df2]" />
                Daily Notes
              </>
            )}
            {viewMode === 'files' && !selectedFile && (
              <span className={textMuted}>No file selected</span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            {viewMode === 'files' && selectedFile && !isEditing && (
              <>
                {canWrite && (
                  <button
                    onClick={handleStartEdit}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      isDark
                        ? 'border-[#363636] text-[#dcddde] hover:bg-[#2a2d2e]'
                        : 'border-[#d4d4d4] text-[#1a1a1a] hover:bg-[#e8e8e8]'
                    }`}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                )}
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 rounded-md bg-[#7f6df2] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#6c5ce0] disabled:opacity-50"
                >
                  <Download size={13} /> {downloading ? 'Downloading…' : 'Download'}
                </button>
              </>
            )}
            {viewMode === 'files' && selectedFile && isEditing && (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                    isDark
                      ? 'border-[#363636] text-[#dcddde] hover:bg-[#2a2d2e]'
                      : 'border-[#d4d4d4] text-[#1a1a1a] hover:bg-[#e8e8e8]'
                  }`}
                >
                  <XIcon size={13} /> Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-md bg-[#7f6df2] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#6c5ce0] disabled:opacity-50"
                >
                  <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`rounded-md p-2 ${textSecondary} ${hoverBg} transition`}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'files' && selectedFile && isEditing && (
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className={`h-full w-full resize-none px-8 py-6 font-mono text-sm outline-none ${
                isDark ? 'bg-[#1e1e1e] text-[#d4d4d4]' : 'bg-white text-[#1f2937]'
              }`}
              spellCheck={false}
              autoFocus
            />
          )}
          {viewMode === 'files' && selectedFile && !isEditing && (
            <MarkdownViewer content={selectedFile.content} theme={theme} onNavigate={handleWikilink} />
          )}
          {viewMode === 'files' && !selectedFile && (
            <div className={`flex h-full flex-col items-center justify-center gap-2 ${textMuted}`}>
              <FileText size={48} strokeWidth={1} />
              <p className="text-sm">Select a note from the sidebar</p>
            </div>
          )}
          {viewMode === 'graph' && (
            <GraphView
              files={getAllFiles(tree)}
              onSelectFile={handleSelectFile}
              theme={theme}
            />
          )}
          {viewMode === 'daily' && (
            <DailyView
              notes={getDailyNotes()}
              selectedId={dailySelectedId}
              onSelectNote={handleSelectDaily}
              noteContent={dailyContent}
              theme={theme}
              onNavigate={handleWikilink}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// Daily notes: left list + right content, all inside the main panel
function DailyView({
  notes,
  selectedId,
  onSelectNote,
  noteContent,
  theme,
  onNavigate,
}: {
  notes: TreeNode[];
  selectedId: string | null;
  onSelectNote: (id: string) => void;
  noteContent: { name: string; content: string } | null;
  theme: 'dark' | 'light';
  onNavigate: (name: string) => void;
}) {
  const isDark = theme === 'dark';

  if (notes.length === 0) {
    return (
      <div className={`flex h-full items-center justify-center ${isDark ? 'text-[#555]' : 'text-[#aaa]'}`}>
        <p>No daily notes found in the Daily/ folder.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Daily list */}
      <div className={`w-56 shrink-0 overflow-y-auto border-r ${isDark ? 'border-[#2b2b2b]' : 'border-[#e0e0e0]'} p-3`}>
        <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-[#888]' : 'text-[#999]'}`}>
          Journal
        </p>
        <div className="space-y-1">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition ${
                selectedId === note.id
                  ? isDark
                    ? 'bg-[#37373d] text-white'
                    : 'bg-[#dcdcdc] text-[#111]'
                  : isDark
                    ? 'text-[#ccc] hover:bg-[#2a2d2e]'
                    : 'text-[#333] hover:bg-[#eee]'
              }`}
            >
              <Calendar size={13} className="shrink-0 text-[#7f6df2]" />
              {note.name.replace(/\.md$/, '')}
            </button>
          ))}
        </div>
      </div>

      {/* Daily content */}
      <div className="flex-1 overflow-y-auto">
        {noteContent ? (
          <MarkdownViewer content={noteContent.content} theme={theme} onNavigate={onNavigate} />
        ) : (
          <div className={`flex h-full items-center justify-center ${isDark ? 'text-[#555]' : 'text-[#bbb]'}`}>
            <p className="text-sm">Select a daily note to view</p>
          </div>
        )}
      </div>
    </div>
  );
}

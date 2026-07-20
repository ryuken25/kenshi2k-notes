'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';

export interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: TreeNode[];
}

interface FolderTreeProps {
  nodes: TreeNode[];
  onSelectFile: (fileId: string) => void;
  selectedFileId: string | null;
  theme?: 'dark' | 'light';
}

export default function FolderTree({
  nodes,
  onSelectFile,
  selectedFileId,
  theme = 'dark',
}: FolderTreeProps) {
  return (
    <div className="text-[13px]">
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          onSelectFile={onSelectFile}
          selectedFileId={selectedFileId}
          theme={theme}
        />
      ))}
    </div>
  );
}

function TreeItem({
  node,
  depth,
  onSelectFile,
  selectedFileId,
  theme,
}: {
  node: TreeNode;
  depth: number;
  onSelectFile: (fileId: string) => void;
  selectedFileId: string | null;
  theme: 'dark' | 'light';
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isFile = node.type === 'file';
  const isSelected = isFile && node.id === selectedFileId;
  const isDark = theme === 'dark';

  const itemBg = isSelected
    ? isDark ? 'bg-[#37373d] text-white' : 'bg-[#d0d0d0] text-[#111]'
    : isDark ? 'text-[#cccccc]' : 'text-[#333333]';
  const hoverBg = isDark ? 'hover:bg-[#2a2d2e]' : 'hover:bg-[#e4e4e4]';
  const iconColor = isDark ? 'text-[#999]' : 'text-[#777]';

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-[5px] transition-colors ${hoverBg} ${itemBg}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => (isFile ? onSelectFile(node.id) : setExpanded((e) => !e))}
        title={node.name}
      >
        {!isFile && (
          <span className={`shrink-0 ${iconColor}`}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        {isFile && <span className="w-3 shrink-0" />}
        <span className={`shrink-0 ${iconColor}`}>
          {isFile ? (
            <FileText size={14} />
          ) : expanded ? (
            <FolderOpen size={14} />
          ) : (
            <Folder size={14} />
          )}
        </span>
        <span className="truncate">{node.name.replace(/\.md$/, '')}</span>
      </div>

      {!isFile && expanded && node.children && (
        <div>
          {[...node.children]
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                onSelectFile={onSelectFile}
                selectedFileId={selectedFileId}
                theme={theme}
              />
            ))}
        </div>
      )}
    </div>
  );
}

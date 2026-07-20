'use client';

import { useEffect, useRef, useState } from 'react';
import { Network } from 'lucide-react';
import { TreeNode } from './FolderTree';

interface GraphViewProps {
  files: TreeNode[];
  onSelectFile: (id: string) => void;
  theme: 'dark' | 'light';
}

interface GraphNode {
  id: string;
  name: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export default function GraphView({ files, onSelectFile, theme }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    async function loadLinks() {
      const allLinks: GraphLink[] = [];
      const fileNames = new Map(
        files.map((f) => [f.name.replace(/\.md$/, '').toLowerCase(), f.id])
      );

      const graphNodes: GraphNode[] = files.map((f) => ({
        id: f.id,
        name: f.name.replace(/\.md$/, ''),
      }));

      for (const file of files) {
        const numericId = file.id.replace('file-', '');
        try {
          const res = await fetch(`/api/files/${numericId}`);
          if (!res.ok) continue;
          const data = await res.json();
          const content = data.file.content || '';
          const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
          for (const m of matches) {
            const targetName = m[1].toLowerCase().split('|')[0].trim();
            const targetId = fileNames.get(targetName);
            if (targetId && targetId !== file.id) {
              allLinks.push({ source: file.id, target: targetId });
            }
          }
        } catch {
          // skip
        }
      }
      
      setNodes(graphNodes);
      setLinks(allLinks);
      setLoaded(true);
    }
    if (files.length > 0) loadLinks();
  }, [files]);

  useEffect(() => {
    if (!loaded || !svgRef.current || nodes.length === 0) return;

    const svg = svgRef.current;
    const width = svg.clientWidth;
    const height = svg.clientHeight;

    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // D3 force simulation — wider spacing so labels stay readable
    const simulation = (window as any).d3
      .forceSimulation(nodes)
      .force(
        'link',
        (window as any).d3
          .forceLink(links)
          .id((d: GraphNode) => d.id)
          .distance(140)
      )
      .force('charge', (window as any).d3.forceManyBody().strength(-260))
      .force('center', (window as any).d3.forceCenter(width / 2, height / 2))
      .force('collision', (window as any).d3.forceCollide().radius(48));

    const g = (window as any).d3.select(svg).append('g');

    // Zoom behavior
    const zoom = (window as any).d3
      .zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event: any) => {
        g.attr('transform', event.transform);
      });
    (window as any).d3.select(svg).call(zoom);

    // Links
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', isDark ? '#444' : '#ccc')
      .attr('stroke-width', 1.5);

    // Nodes — default gray, purple only appears on hover
    const node = g
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 6)
      .attr('fill', isDark ? '#5a5a5a' : '#b0b0b0')
      .attr('stroke', isDark ? '#1e1e1e' : '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(
        (window as any).d3
          .drag()
          .on('start', (event: any, d: GraphNode) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event: any, d: GraphNode) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event: any, d: GraphNode) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (_event: any, d: GraphNode) => {
        onSelectFile(d.id);
      });

    // Hover: highlight connected nodes, dim others
    node
      .on('mouseover', (_event: any, d: GraphNode) => {
        const connectedIds = new Set<string>();
        connectedIds.add(d.id);
        links.forEach((l: any) => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          if (sid === d.id) connectedIds.add(tid);
          if (tid === d.id) connectedIds.add(sid);
        });

        node.attr('opacity', (n: GraphNode) => connectedIds.has(n.id) ? 1 : 0.15);
        node.attr('r', (n: GraphNode) => n.id === d.id ? 10 : connectedIds.has(n.id) ? 7 : 4);
        node.attr('fill', (n: GraphNode) =>
          connectedIds.has(n.id) ? '#7f6df2' : isDark ? '#5a5a5a' : '#b0b0b0'
        );
        link.attr('opacity', (l: any) => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          return sid === d.id || tid === d.id ? 1 : 0.05;
        });
        link.attr('stroke', (l: any) => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          return sid === d.id || tid === d.id ? '#7f6df2' : isDark ? '#444' : '#ccc';
        });
        link.attr('stroke-width', (l: any) => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          return sid === d.id || tid === d.id ? 2.5 : 1;
        });
        label.attr('opacity', (n: GraphNode) => connectedIds.has(n.id) ? 1 : 0.1);
        label.attr('font-weight', (n: GraphNode) => n.id === d.id ? 'bold' : 'normal');
        label.attr('fill', (n: GraphNode) =>
          connectedIds.has(n.id) ? (isDark ? '#e8e8e8' : '#111') : isDark ? '#ddd' : '#333'
        );
      })
      .on('mouseout', () => {
        node.attr('opacity', 1);
        node.attr('r', 6);
        node.attr('fill', isDark ? '#5a5a5a' : '#b0b0b0');
        link.attr('opacity', 1);
        link.attr('stroke', isDark ? '#444' : '#ccc');
        link.attr('stroke-width', 1.5);
        label.attr('opacity', 1);
        label.attr('font-weight', 'normal');
        label.attr('fill', isDark ? '#ddd' : '#333');
      });

    // Labels
    const label = g
      .append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d: GraphNode) => d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name)
      .attr('font-size', 11)
      .attr('text-anchor', 'middle')
      .attr('dy', 20)
      .attr('fill', isDark ? '#ddd' : '#333')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('cx', (d: GraphNode) => d.x!).attr('cy', (d: GraphNode) => d.y!);

      label.attr('x', (d: GraphNode) => d.x!).attr('y', (d: GraphNode) => d.y!);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, loaded, isDark, onSelectFile]);

  if (!loaded) {
    return (
      <div className={`flex h-full items-center justify-center ${isDark ? 'text-[#555]' : 'text-[#aaa]'}`}>
        <p>Loading graph...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          className={`h-full w-full ${isDark ? 'bg-[#141414]' : 'bg-white'}`}
        />
      </div>
      <div className={`border-t px-6 py-3 text-center text-xs ${isDark ? 'border-[#2b2b2b] text-[#888]' : 'border-[#e0e0e0] text-[#999]'}`}>
        {nodes.length} notes · {links.length} wikilinks · drag nodes, scroll to zoom
      </div>
      {links.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 px-6 pb-4">
          {files
            .filter((f) =>
              links.some(
                (l: any) => l.source === f.id || l.target === f.id || l.source.id === f.id || l.target.id === f.id
              )
            )
            .slice(0, 15)
            .map((f) => (
              <button
                key={f.id}
                onClick={() => onSelectFile(f.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                  isDark
                    ? 'border-[#333] text-[#ccc] hover:border-[#7f6df2] hover:text-white'
                    : 'border-[#ddd] text-[#333] hover:border-[#7f6df2] hover:text-[#7f6df2]'
                }`}
              >
                <Network size={11} className="text-[#7f6df2]" />
                {f.name.replace(/\.md$/, '')}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

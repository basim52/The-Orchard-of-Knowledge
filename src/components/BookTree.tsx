import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { BookData, LeafDetail } from '../types';

interface BookTreeProps {
  book: BookData;
  onLeafClick: (leaf: LeafDetail, branchName: string) => void;
  selectedLeafName?: string;
}

export default function BookTree({ book, onLeafClick, selectedLeafName }: BookTreeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous elements
    d3.select(svgRef.current).selectAll('*').remove();

    // Responsive sizing but maintaining a beautiful minimum layout spread for readability
    const width = Math.max(containerRef.current.clientWidth || 700, 680);
    const height = 550;

    // Setup SVG
    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('direction', 'ltr'); // Force LTR for SVG co-ordinates logic for perfect symmetry

    // 1. Prepare hierarchy data
    // Poetic botanical transformation: root is at the bottom, branches grow upwards
    interface HierarchyNode {
      name: string;
      isTrunk?: boolean;
      isBranch?: boolean;
      isLeaf?: boolean;
      branchName?: string;
      leafData?: LeafDetail;
      children?: HierarchyNode[];
    }

    const rootData: HierarchyNode = {
      name: book.title, // Use title/essence for root
      isTrunk: true,
      children: book.branches.map(branch => ({
        name: branch.name,
        isBranch: true,
        children: branch.leaves.map(leaf => ({
          name: leaf.name,
          isLeaf: true,
          branchName: branch.name,
          leafData: leaf
        }))
      }))
    };

    // Calculate D3 structure
    const root = d3.hierarchy<HierarchyNode>(rootData);
    
    // Using simple tree layout
    const treeLayout = d3.tree<HierarchyNode>()
      .size([width - 120, height - 160]);

    treeLayout(root);

    // Poetic Coordinate Translation: Growing upwards!
    // Normally roots are at Y=0 (top) and leaves at Y=height (bottom).
    // We invert the Y coordinate: newY = height - margin - oldY
    // Root is centered at the bottom.
    root.each(d => {
      const origX = d.x as number;
      const origY = d.y as number;

      // Center horizontally, space vertically starting from bottom (y=height-60)
      d.x = origX + 60; // offset margin left
      d.y = height - 80 - origY; // growing upwards
    });

    // Create a shadow/glow filter for organic aesthetic
    const defs = svg.append('defs');
    
    const filter = defs.append('filter')
      .attr('id', 'soft-glow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
      
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');
      
    filter.append('feComposite')
      .attr('in', 'SourceGraphic')
      .attr('in2', 'blur')
      .attr('operator', 'over');

    // 2. Draw Connections (Links / Organic Branches)
    // Draw links using curved paths to look like natural plant branches
    svg.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(root.links())
      .enter()
      .append('path')
      .attr('d', d => {
        const sourceX = d.source.x as number;
        const sourceY = d.source.y as number;
        const targetX = d.target.x as number;
        const targetY = d.target.y as number;
        
        // Control points for a graceful organic curve (S-curve towards leaves)
        const cpY = (sourceY + targetY) / 2;
        return `M ${sourceX} ${sourceY} C ${sourceX} ${cpY}, ${targetX} ${cpY}, ${targetX} ${targetY}`;
      })
      .attr('fill', 'none')
      .attr('stroke', d => {
        // Trunk connects with thick warm brown tree trunks, leaves get lighter green stalks
        const isToLeaf = d.target.data.isLeaf;
        return isToLeaf ? '#86efac' : '#b45309'; // grass-green and amber/brown trunk
      })
      .attr('stroke-width', d => {
        // Deep roots are thicker, small leaves have thin delicate stems
        if (d.source.data.isTrunk) return 7;
        if (d.source.data.isBranch) return 4;
        return 2;
      })
      .attr('opacity', 0.85);

    // 3. Draw Nodes (Elements / Foliage / Blooms)
    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('class', 'group cursor-pointer');

    // Draw customized botanical icons / designs for each node category
    node.each(function(d) {
      const g = d3.select(this);
      
      if (d.data.isTrunk) {
        // Draw standard steady tree trunk node
        g.append('rect')
          .attr('x', -24)
          .attr('y', -24)
          .attr('width', 48)
          .attr('height', 48)
          .attr('rx', 14)
          .attr('fill', '#78350f') // Deep soil brown
          .attr('stroke', '#fef3c7')
          .attr('stroke-width', 3)
          .attr('filter', 'url(#soft-glow)');

        g.append('text')
          .attr('dy', '.3em')
          .attr('text-anchor', 'middle')
          .attr('fill', '#fef3c7')
          .style('font-size', '15px')
          .style('font-weight', 'bold')
          .style('pointer-events', 'none')
          .text('🌳'); // Poetic Tree Trunk Icon
      } 
      else if (d.data.isBranch) {
        // Dynamic branch node represented as an amber shield/stone
        g.append('circle')
          .attr('r', 18)
          .attr('fill', '#d97706') // Amber
          .attr('stroke', '#fef3c7')
          .attr('stroke-width', 2);

        g.append('text')
          .attr('dy', '.3em')
          .attr('text-anchor', 'middle')
          .attr('fill', '#ffffff')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .text('🌿');
      } 
      else {
        // Delicate leaves
        const isSelected = selectedLeafName === d.data.name;
        
        // Leaf shape via path
        g.append('path')
          .attr('d', 'M 0 -13 C 8 -13, 14 -5, 0 11 C -14 -5, -8 -13, 0 -13 Z') // Beautiful organic leaf vector
          .attr('fill', isSelected ? '#3b82f6' : '#15803d') // Blue if active, dark forest-green otherwise
          .attr('stroke', isSelected ? '#93c5fd' : '#bbf7d0')
          .attr('stroke-width', isSelected ? 3 : 1.5)
          .attr('filter', isSelected ? 'url(#soft-glow)' : null)
          .style('transition', 'all 0.3s ease');

        // Tiny flower/drop indicator inside active leaf
        if (isSelected) {
          g.append('circle')
            .attr('cx', 0)
            .attr('cy', -2)
            .attr('r', 4)
            .attr('fill', '#fef08a'); // gold center bloom
        }
      }
    });

    // 4. Elegant Text Labeling (Arabic text with Cairo/Tajawal look)
    const textLabels = node.append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', d => {
        if (d.data.isTrunk) return '#0f172a';
        if (d.data.name === selectedLeafName) return '#2563eb';
        return '#334155';
      })
      .style('font-size', d => {
        if (d.data.isTrunk) return '16.5px';
        if (d.data.isBranch) return '15px';
        return '13.5px'; // Scaled font sizes
      })
      .style('font-family', '"Cairo", "Tajawal", sans-serif')
      .style('font-weight', d => (d.data.isTrunk || d.data.isBranch || d.data.name === selectedLeafName) ? 'bold' : '500')
      .style('pointer-events', 'none');

    textLabels.each(function(d) {
      const el = d3.select(this);
      const name = d.data.name;
      
      if (d.data.isTrunk) {
        el.attr('dy', 40).text(name);
      } else if (d.data.isBranch) {
        el.attr('dy', -28).text(name);
      } else {
        // Find leaf index within its siblings to alternate stagger vertically
        const index = d.parent ? d.parent.children?.indexOf(d) || 0 : 0;
        const isStaggered = index % 2 === 1;
        const baseDy = isStaggered ? 45 : 28;
        
        // Split and wrap into tspans if the name is multi-word to fit narrow leaf gaps
        const words = name.split(' ');
        if (words.length > 1 && name.length > 8) {
          const lines: string[] = [];
          let currentLine = '';
          words.forEach(word => {
            if (!currentLine) {
              currentLine = word;
            } else if ((currentLine + ' ' + word).length > 10) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine += ' ' + word;
            }
          });
          if (currentLine) lines.push(currentLine);
          
          lines.forEach((lineText, lineIdx) => {
            el.append('tspan')
              .attr('x', 0)
              .attr('dy', lineIdx === 0 ? baseDy : 14)
              .text(lineText);
          });
        } else {
          el.attr('dy', baseDy).text(name);
        }
      }
    });

    // 5. Click Triggers on nodes
    node.on('click', (event, d) => {
      if (d.data.isLeaf && d.data.leafData && d.data.branchName) {
        onLeafClick(d.data.leafData, d.data.branchName);
      }
    });

  }, [book, onLeafClick, selectedLeafName]);

  return (
    <div ref={containerRef} className="w-full bg-[#fbfbf9] rounded-3xl border border-emerald-100/50 p-6 shadow-inner relative overflow-hidden flex flex-col">
      
      {/* Dynamic Poetic Scale Legend - Rendered Inline-Flex above the tree to avoid overlapping */}
      <div className="mb-6 bg-white/95 p-4 rounded-2xl border border-emerald-100/40 shadow-tiny">
        <h5 className="text-sm font-black font-serif text-emerald-950 flex items-center gap-1.5 justify-end mb-2.5 border-b border-emerald-50 pb-1.5">
          <span>دليل شجرة الفكر والتنمية</span>
          <span className="text-emerald-800 text-lg">🌳</span>
        </h5>
        
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3.5 text-xs text-slate-700 font-medium">
          <div className="flex items-center gap-2">
            <span>الجذع الراسخ (الكتاب)</span>
            <span className="w-3.5 h-3.5 bg-[#78350f] rounded-xs border border-amber-950"></span>
          </div>
          <div className="flex items-center gap-2">
            <span>الأغصان الرئيسية</span>
            <span className="w-3.5 h-3.5 bg-amber-500 rounded-full border border-amber-600/50"></span>
          </div>
          <div className="flex items-center gap-2">
            <span>الأوراق (مفاهيم ميسرة)</span>
            <span className="w-3.5 h-3.5 bg-emerald-700 rounded-full border border-emerald-800/50"></span>
          </div>
          <div className="flex items-center gap-2 text-blue-800 font-bold">
            <span>الورقة النشطة للتأمل</span>
            <span className="w-4 h-4 bg-blue-500 rounded-full border-2 border-blue-200 animate-pulse"></span>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto custom-scrollbar pt-2 pb-4">
        {/* On mobile, this will enforce a spacious min-width of 680px for a beautiful layout, while scaling normally on desktop */}
        <div className="min-w-[650px] md:min-w-[100%]">
          <svg 
            ref={svgRef} 
            className="w-full block select-none overflow-visible"
          />
        </div>
      </div>

      <div className="text-left pointer-events-none opacity-45 text-xs font-serif text-[#1e293b] mt-4">
        حكيم البستان مرشد التحرّر والتنمية
      </div>
    </div>
  );
}

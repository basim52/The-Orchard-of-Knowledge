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

    // Responsive sizing
    const width = containerRef.current.clientWidth || 700;
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
    node.append('text')
      .attr('dy', d => {
        if (d.data.isTrunk) return 40;
        if (d.data.isBranch) return -26;
        return 28;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', d => {
        if (d.data.isTrunk) return '#1e293b';
        if (d.data.name === selectedLeafName) return '#2563eb';
        return '#334155';
      })
      .style('font-size', d => {
        if (d.data.isTrunk) return '14.5px';
        if (d.data.isBranch) return '13px';
        return '11.5px';
      })
      .style('font-family', '"Cairo", "Tajawal", sans-serif')
      .style('font-weight', d => (d.data.isTrunk || d.data.isBranch || d.data.name === selectedLeafName) ? 'bold' : '500')
      .style('pointer-events', 'none')
      .text(d => d.data.name);

    // 5. Click Triggers on nodes
    node.on('click', (event, d) => {
      if (d.data.isLeaf && d.data.leafData && d.data.branchName) {
        onLeafClick(d.data.leafData, d.data.branchName);
      }
    });

  }, [book, onLeafClick, selectedLeafName]);

  return (
    <div ref={containerRef} className="w-full bg-[#fbfbf9] rounded-2xl border border-emerald-100/40 p-4 shadow-inner relative overflow-hidden">
      
      {/* Dynamic Poetic Scale legend */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 text-right bg-white/75 backdrop-blur-xs p-3 rounded-xl border border-slate-100">
        <h5 className="text-[11px] font-bold font-serif text-emerald-950 flex items-center gap-1 justify-end">
          <span>دليل شجرة الفكر</span>
          <span className="text-emerald-800">🌳</span>
        </h5>
        <div className="flex items-center gap-1.5 justify-end text-[10px] text-slate-600">
          <span>الجذع الراسخ (الكتاب)</span>
          <span className="w-2.5 h-2.5 bg-[#78350f] rounded-xs"></span>
        </div>
        <div className="flex items-center gap-1.5 justify-end text-[10px] text-slate-600">
          <span>الأغصان الرئيسية</span>
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
        </div>
        <div className="flex items-center gap-1.5 justify-end text-[10px] text-slate-600">
          <span>الأوراق (مفاهيم ميسرة)</span>
          <span className="w-2.5 h-2.5 bg-emerald-700 rounded-full"></span>
        </div>
        <div className="flex items-center gap-1.5 justify-end text-[10px] text-blue-600 font-bold">
          <span>الورقة النشطة للتأمل</span>
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 text-left pointer-events-none opacity-45 text-[10px] font-serif text-[#1e293b]">
        حكيم البستان مرشد التحرّر والتنمية
      </div>

      <svg 
        ref={svgRef} 
        className="w-full block select-none overflow-visible"
      />
    </div>
  );
}

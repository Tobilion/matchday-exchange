import React from "react";
import { Player } from "../types";

interface PitchFormationProps {
  players: Player[];
  teamId: string;
}

export const PitchFormation: React.FC<PitchFormationProps> = ({ players }) => {
  // We need to pick exactly 11 starting players: 1 GK, 4 DEF, 4 MID, 2 ATT for a classic 4-4-2
  const gk = players.filter((p) => p.position === "GK")[0];
  const defs = players.filter((p) => p.position === "DEF").slice(0, 4);
  const mids = players.filter((p) => p.position === "MID").slice(0, 4);
  const atts = players.filter((p) => p.position === "ATT").slice(0, 2);

  const getPosClass = (index: number, total: number, row: number) => {
    // We position them on a CSS grid or absolutely.
    // Absolute positioning is best.
    const leftPercent = ((index + 1) / (total + 1)) * 100;
    // Row 0 = GK, 1 = DEF, 2 = MID, 3 = ATT
    const topPercent = row === 0 ? 90 : row === 1 ? 70 : row === 2 ? 40 : 15;
    return { left: `${leftPercent}%`, top: `${topPercent}%` };
  };

  const renderNode = (p: Player, left: string, top: string) => {
    if (!p) return null;
    return (
      <div
        key={p.id}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group z-10"
        style={{ left, top }}
      >
        <div className="w-10 h-10 rounded-full bg-emerald-700 border-2 border-emerald-400 flex flex-col items-center justify-center th-text font-black text-[10px] shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-transform group-hover:scale-110 cursor-default">
          <span className="text-[8px] opacity-80">{p.position}</span>
          <span>{p.rating}</span>
        </div>
        <div className="th-solid border th-border-acc rounded px-1.5 py-0.5 text-[9px] font-bold th-text font-sans max-w-[80px] truncate text-center uppercase tracking-tighter">
          {p.name.split(" ").pop()}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full aspect-[4/3] max-h-[500px] border-2 th-border-acc rounded-lg overflow-hidden bg-[#1f3725]">
      {/* Pitch Lines */}
      <div className="absolute inset-x-0 top-1/2 h-0 border-t-2 th-border2"></div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 th-border2 rounded-full"></div>
      
      {/* Penalty boxes */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[15%] border-x-2 border-b-2 th-border2"></div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[15%] border-x-2 border-t-2 th-border2"></div>
      
      {/* Goal boxes */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[20%] h-[5%] border-x-2 border-b-2 th-border2"></div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[20%] h-[5%] border-x-2 border-t-2 th-border2"></div>

      {gk && renderNode(gk, "50%", "88%")}
      {defs.map((p, i) => {
        const pos = getPosClass(i, defs.length, 1);
        return renderNode(p, pos.left, pos.top);
      })}
      {mids.map((p, i) => {
        const pos = getPosClass(i, mids.length, 2);
        return renderNode(p, pos.left, pos.top);
      })}
      {atts.map((p, i) => {
        const pos = getPosClass(i, atts.length, 3);
        return renderNode(p, pos.left, pos.top);
      })}
    </div>
  );
};


import { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';

interface ScoreBreakdown {
  label: string;
  value: number;
  percentage: number;
}

function parseScoreBreakdown(breakdownArray: string[]): ScoreBreakdown[] {
  if (!Array.isArray(breakdownArray)) return [];
  
  return breakdownArray
    .map((item: string) => {
      // Parse format: "label: value (percentage%)"
      const match = item.match(/^([^:]+):\s+([\d.]+)\s+\((\d+)%\)$/);
      if (!match) return null;
      return {
        label: match[1].trim(),
        value: parseFloat(match[2]),
        percentage: parseInt(match[3]),
      };
    })
    .filter((item): item is ScoreBreakdown => item !== null);
}

interface ScoreTooltipProps {
  searchScore: number;
  scoreBreakdown: string[];
}

const ScoreTooltip = ({ searchScore, scoreBreakdown }: ScoreTooltipProps) => {
  const breakdowns = parseScoreBreakdown(scoreBreakdown);
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffa07a', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e2'];

  // Calculate pie chart segments
  let currentAngle = 0;
  const segments = breakdowns.map((breakdown, idx) => {
    const sliceAngle = (breakdown.percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);
    const largeArc = sliceAngle > 180 ? 1 : 0;

    return {
      breakdown,
      color: colors[idx % colors.length],
      path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
    };
  });

  return (
    <div className="fixed bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 w-80">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase text-gray-600 mb-1">Search Score</p>
          <p className="text-lg font-bold text-sinsay-red">{searchScore.toFixed(4)}</p>
        </div>

        {breakdowns.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-bold uppercase text-gray-600 mb-2">Score Breakdown</p>
            
            <div className="flex gap-4">
              {/* Pie Chart */}
              <svg viewBox="0 0 100 100" className="w-20 h-20 shrink-0">
                {segments.map((seg, idx) => (
                  <path
                    key={idx}
                    d={seg.path}
                    fill={seg.color}
                    stroke="white"
                    strokeWidth="1"
                  />
                ))}
              </svg>

              {/* Breakdown List */}
              <div className="flex-1 space-y-1 text-xs">
                {segments.map((seg, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <div className="flex-1">
                      <span className="font-semibold">{seg.breakdown.label}</span>
                      <span className="text-gray-600 ml-1">({seg.breakdown.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ScoreInfoProps {
  item: any;
}

export const ScoreInfo = ({ item }: ScoreInfoProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const searchScore = item.search_score || item.searchScore || item.md?.search_score;
  const scoreBreakdown = item.score_breakdown || item.scoreBreakdown || item.md?.score_breakdown;
  const hasScoreData = searchScore && scoreBreakdown && Array.isArray(scoreBreakdown);

  useEffect(() => {
    if (!showTooltip || !iconRef.current) return;

    const rect = iconRef.current.getBoundingClientRect();
    setTooltipPos({
      top: rect.top + rect.height + 8,
      left: rect.left - 160,
    });
  }, [showTooltip]);

  if (!hasScoreData) return null;

  return (
    <div
      ref={iconRef}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className="cursor-help"
    >
      <Info size={14} className="text-gray-400 hover:text-gray-600 transition-colors" />
      {showTooltip && (
        <div style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left }}>
          <ScoreTooltip searchScore={searchScore} scoreBreakdown={scoreBreakdown} />
        </div>
      )}
    </div>
  );
};

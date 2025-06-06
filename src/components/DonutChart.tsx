
import React, { useEffect, useState, useRef } from 'react';

interface DonutChartProps {
  protein: number;
  carbs: number;
  fat: number;
  totalCalories: number;
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean; // New prop
}

interface Segment {
  percent: number;
  color: string;
  label: string;
  grams: number;
}

const DonutChart: React.FC<DonutChartProps> = ({
  protein,
  carbs,
  fat,
  totalCalories,
  size = 120,
  strokeWidth = 16,
  showLegend = true, // Default to true
}) => {
  const [mounted, setMounted] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalMacros = protein + carbs + fat;

  if (totalMacros === 0 && totalCalories === 0) {
    return (
      <div style={{ width: size, height: size }} className="flex flex-col items-center justify-center text-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Donut chart showing no data">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - strokeWidth) / 2}
            fill="transparent"
            stroke="#4b5563" // gray-600
            strokeWidth={strokeWidth}
            opacity="0.2"
          />
          <text x="50%" y="45%" className="donut-chart-text text-xs fill-slate-400" dy="0em" dominantBaseline="middle">
            No
          </text>
          <text x="50%" y="55%" className="donut-chart-text text-xs fill-slate-400" dy="0.1em" dominantBaseline="middle">
            Data
          </text>
        </svg>
      </div>
    );
  }

  const proteinPercent = totalMacros > 0 ? (protein / totalMacros) * 100 : 0;
  const carbsPercent = totalMacros > 0 ? (carbs / totalMacros) * 100 : 0;
  const fatPercent = totalMacros > 0 ? (fat / totalMacros) * 100 : 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segmentsData: Segment[] = [
    { percent: proteinPercent, color: '#2dd4bf', label: 'Protein', grams: protein }, // teal-400
    { percent: carbsPercent, color: '#f59e0b', label: 'Carbs', grams: carbs },   // amber-500
    { percent: fatPercent, color: '#a855f7', label: 'Fat', grams: fat },     // purple-500
  ];

  let accumulatedPercent = 0;

  const handleMouseOver = (segment: Segment) => {
    setHoveredSegment(segment);
  };

  const handleMouseOut = () => {
    setHoveredSegment(null);
  };

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div style={{ width: size, height: size, position: 'relative' }} className="transform -rotate-90">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} ref={svgRef} aria-label={`Macro donut chart. Total Calories: ${Math.round(totalCalories)} kcal. Macros: Protein ${Math.round(protein)}g, Carbs ${Math.round(carbs)}g, Fat ${Math.round(fat)}g.`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#374151" // gray-700
            strokeWidth={strokeWidth}
            opacity="0.4"
          />
          {segmentsData.map((segment, index) => {
            if (segment.percent === 0) return null;

            const offset = circumference - (segment.percent / 100) * circumference;
            const rotation = (accumulatedPercent / 100) * 360;
            accumulatedPercent += segment.percent;

            return (
              <g
                key={index}
                onMouseOver={() => handleMouseOver(segment)}
                onMouseOut={handleMouseOut}
                className="cursor-pointer"
                role="presentation"
              >
                <circle
                  className="donut-chart-segment"
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={hoveredSegment === segment ? strokeWidth + 2 : strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={mounted ? offset : circumference}
                  strokeLinecap="round"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: 'stroke-dashoffset 0.7s ease-out, stroke-width 0.2s ease-in-out',
                    transitionDelay: mounted ? `${index * 150}ms` : '0ms',
                  }}
                  aria-label={`${segment.label}: ${Math.round(segment.grams)}g, ${Math.round(segment.percent)}%`}
                />
              </g>
            );
          })}
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center transform rotate-90 text-center"
          aria-hidden="true"
        >
          <span className="text-slate-100 font-bold leading-tight" style={{ fontSize: Math.max(12, size / 5.5) }}>
            {Math.round(totalCalories)}
          </span>
          <span className="text-slate-300 uppercase leading-tight" style={{ fontSize: Math.max(8, size / 10) }}>
            kcal
          </span>
          {totalMacros > 0 && (
             <span className="text-slate-400 mt-0.5" style={{ fontSize: Math.max(8, size / 11)}}>
              {Math.round(totalMacros)}g Macros
            </span>
          )}
        </div>
      </div>

      {hoveredSegment && svgRef.current && (
          <div
            className="absolute p-2 bg-slate-800 text-white text-xs rounded-md shadow-lg pointer-events-none z-10 border border-slate-600"
            style={{
                top: `calc(${svgRef.current.getBoundingClientRect().top + window.scrollY + size / 2 - 15}px)`,
                left: `calc(${svgRef.current.getBoundingClientRect().left + window.scrollX + size / 2 - 30}px)`,
                transform: 'translate(-50%, -50%)',
            }}
            role="tooltip"
          >
            {hoveredSegment.label}: {Math.round(hoveredSegment.grams)}g ({Math.round(hoveredSegment.percent)}%)
          </div>
        )}

      {showLegend && totalMacros > 0 && (
        <div className="mt-3 space-y-1 text-sm w-full" aria-label="Macro legend"> {/* Changed text-xs to text-sm */}
          {segmentsData.map((segment) => (
            segment.percent > 0 && (
              <div key={segment.label} className="flex items-center justify-between px-1">
                <div className="flex items-center">
                  <span
                    className="w-2.5 h-2.5 rounded-full mr-2"
                    style={{ backgroundColor: segment.color }}
                    aria-hidden="true"
                  />
                  <span className="text-slate-300">{segment.label}</span>
                </div>
                <span className="text-slate-200 font-medium">
                  {Math.round(segment.grams)}g ({Math.round(segment.percent)}%)
                </span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default DonutChart;

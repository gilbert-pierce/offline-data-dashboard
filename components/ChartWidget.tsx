import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList 
} from 'recharts';
import { Settings, X } from 'lucide-react';
import { CHART_COLORS } from '../lib/utils';

interface ChartWidgetProps {
  data: any[];
  type: 'bar' | 'line' | 'pie' | 'radar'; 
  title: string;
  config: {
    categoryCol: string;
    valueCol: string;
    showLabels?: boolean;
    unit?: 'wan' | 'yi' | '';
  };
  onRemove?: () => void;
  onEdit?: () => void;
}

const Y_AXIS_WIDTH = 50; // Increased to 50px to fit ~5 digits

const ChartWidget: React.FC<ChartWidgetProps> = ({ data, type, title, config, onRemove, onEdit }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width for dynamic label truncation
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
            setContainerWidth(entry.contentRect.width);
        }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- Data Processing for Unit Scaling ---
  const { unit } = config;
  const divisor = unit === 'wan' ? 10000 : (unit === 'yi' ? 100000000 : 1);
  const unitLabel = unit === 'wan' ? '万' : (unit === 'yi' ? '亿' : '');

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (divisor === 1) return data;
    
    return data.map(item => ({
        ...item,
        // Scale the value but keep precision for tooltip.
        // We do NOT use toFixed(2) here anymore, so Tooltip can show exact value.
        value: Number(item.value) / divisor
    }));
  }, [data, divisor]);

  // Calculate dynamic truncation length
  const getTruncatedLabel = (val: any) => {
      const str = String(val);
      if (!containerWidth || processedData.length === 0) return str;

      // Estimate width logic:
      // Left Y-Axis takes Y_AXIS_WIDTH.
      // Margins take approx 10px.
      // Available width for X-axis ticks
      const availableWidth = containerWidth - (Y_AXIS_WIDTH + 15); 
      const widthPerTick = availableWidth / processedData.length;
      
      // Estimate font size 10px, avg char width 10px (conservative) + '..' width (10px)
      let maxChars = Math.floor((widthPerTick - 6) / 10); 
      
      // Safety bounds
      maxChars = Math.max(1, maxChars); 
      
      if (str.length <= maxChars) return str;
      return str.substring(0, maxChars) + '..';
  };

  // Formatter for Data Labels (Bar/Line)
  // If integer -> integer
  // If decimal -> max 2 decimal places (using Number() to remove trailing zeros like 10.50 -> 10.5)
  const formatLabelValue = (val: number) => {
      if (typeof val !== 'number') return val;
      return Number.isInteger(val) ? val : Number(val.toFixed(2));
  };

  // Formatter for Tooltip (Show specific value)
  const formatTooltipValue = (val: number) => {
      return `${val}${unitLabel}`;
  };

  const renderChart = () => {
    if (!processedData || processedData.length === 0) return <div className="flex items-center justify-center h-full text-gray-400">无数据</div>;

    // Compact margins
    const commonMargin = { top: unitLabel ? 20 : 10, right: 5, left: 0, bottom: 0 };
    const axisStyle = { fontSize: 10, fill: '#6b7280' };

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData} margin={commonMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={axisStyle} 
                tickLine={false} 
                axisLine={false} 
                interval={0} // FORCE SHOW ALL LABELS
                minTickGap={0} // Allow them to be close
                tickFormatter={getTruncatedLabel}
              />
              <YAxis 
                tick={axisStyle} 
                tickLine={false} 
                axisLine={false} 
                width={Y_AXIS_WIDTH} // Updated Width
                label={unitLabel ? { 
                    value: unitLabel, 
                    position: 'top', 
                    offset: 10, 
                    fontSize: 10, 
                    fill: '#9ca3af',
                    dx: 0
                } : undefined}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }} 
                formatter={formatTooltipValue}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} 
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                 {config.showLabels && (
                    <LabelList 
                        dataKey="value" 
                        position="top" 
                        fontSize={10} 
                        fill="#666" 
                        formatter={formatLabelValue} 
                    />
                 )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processedData} margin={commonMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={axisStyle} 
                tickLine={false} 
                axisLine={false}
                interval={0} // FORCE SHOW ALL LABELS
                minTickGap={0}
                tickFormatter={getTruncatedLabel}
              />
              <YAxis 
                tick={axisStyle} 
                tickLine={false} 
                axisLine={false} 
                width={Y_AXIS_WIDTH} // Updated Width
                label={unitLabel ? { 
                    value: unitLabel, 
                    position: 'top', 
                    offset: 10, 
                    fontSize: 10, 
                    fill: '#9ca3af',
                    dx: 0
                } : undefined}
              />
              <Tooltip 
                formatter={formatTooltipValue}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} 
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                dot={{ r: 2 }} 
                activeDot={{ r: 4 }}
              >
                 {config.showLabels && (
                    <LabelList 
                        dataKey="value" 
                        position="top" 
                        offset={10} 
                        fontSize={10} 
                        fill="#666" 
                        formatter={formatLabelValue}
                    />
                 )}
              </Line>
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={60}
                paddingAngle={5}
                dataKey="value"
                // Simplified label
                label={config.showLabels ? ({ percent }) => `${(percent * 100).toFixed(0)}%` : false}
                labelLine={false}
              >
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value}${unitLabel}`, name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
              <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }}/>
            </PieChart>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={processedData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false}/>
              <Radar
                name={`${config.valueCol} ${unitLabel ? `(${unitLabel})` : ''}`}
                dataKey="value"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
              />
              <Tooltip formatter={(value) => `${value}${unitLabel}`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden group">
      <div className="flex items-center justify-between p-1.5 border-b border-gray-100 bg-gray-50 draggable-handle cursor-move h-7 min-h-[28px]">
        <h3 className="font-semibold text-gray-700 text-xs truncate select-none pl-1" title={title}>{title}</h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          {onEdit && (
             <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                onMouseDown={(e) => e.stopPropagation()} 
                className="p-0.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                title="编辑"
             >
               <Settings size={11} />
             </button>
          )}
          {onRemove && (
            <button 
                onClick={(e) => { e.stopPropagation(); onRemove(); }} 
                onMouseDown={(e) => e.stopPropagation()} 
                className="p-0.5 hover:bg-red-100 hover:text-red-500 rounded text-gray-400 transition-colors"
                title="移除"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 p-0 min-h-0 relative" ref={containerRef}>
        {renderChart()}
      </div>
    </div>
  );
};

export default ChartWidget;
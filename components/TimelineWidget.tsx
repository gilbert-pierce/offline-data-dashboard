import React from 'react';
import { Clock, AlignLeft, X } from 'lucide-react';

interface TimelineWidgetProps {
  data: any[]; // Expecting raw rows
  config: {
    dateCol: string;
    eventCol: string;
  };
  title: string;
  onRemove?: () => void;
}

const TimelineWidget: React.FC<TimelineWidgetProps> = ({ data, config, title, onRemove }) => {
  // Sort data by date descending
  const sortedData = React.useMemo(() => {
    if (!data || !config.dateCol) return [];
    return [...data].sort((a, b) => {
      const dateA = new Date(a[config.dateCol]).getTime();
      const dateB = new Date(b[config.dateCol]).getTime();
      return dateB - dateA;
    });
  }, [data, config]);

  return (
    <div className="flex flex-col h-full w-full bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden group">
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50 draggable-handle cursor-move">
         <div className="flex items-center gap-2">
            <Clock size={14} className="text-blue-500"/>
            <h3 className="font-semibold text-gray-700 text-sm truncate select-none">{title}</h3>
         </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          {onRemove && (
            <button onClick={onRemove} onMouseDown={(e) => e.stopPropagation()} className="p-1 hover:bg-red-100 hover:text-red-500 rounded text-gray-400 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {sortedData.length === 0 ? (
           <div className="text-center text-gray-400 text-sm mt-4">暂无事件数据</div>
        ) : (
          <div className="relative border-l-2 border-blue-100 ml-2 space-y-6">
            {sortedData.map((row, idx) => (
              <div key={idx} className="mb-6 ml-4 relative">
                <span className="absolute -left-[25px] top-1 h-4 w-4 rounded-full bg-blue-500 border-4 border-white shadow-sm"></span>
                <time className="block mb-1 text-xs font-bold leading-none text-blue-500 uppercase">
                  {String(row[config.dateCol])}
                </time>
                <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">
                  {String(row[config.eventCol])}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineWidget;

import React, { useState, useEffect } from 'react';
import { BarChart, LineChart, PieChart, Clock, X, Tag, Radar } from 'lucide-react';

interface WidgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: any) => void;
  columns: { numeric: string[], text: string[], date: string[] };
  initialConfig?: {
      type?: 'bar' | 'line' | 'pie' | 'timeline' | 'radar';
      categoryCol?: string;
      valueCol?: string;
      dateCol?: string;
      eventCol?: string;
      title?: string;
      showLabels?: boolean;
      unit?: 'wan' | 'yi' | '';
  } | null;
}

export default function WidgetConfigModal({ isOpen, onClose, onAdd, columns, initialConfig }: WidgetConfigModalProps) {
  const [type, setType] = useState<'bar' | 'line' | 'pie' | 'timeline' | 'radar'>('bar');
  const [title, setTitle] = useState('');
  const [categoryCol, setCategoryCol] = useState('');
  const [valueCol, setValueCol] = useState('');
  const [dateCol, setDateCol] = useState('');
  const [eventCol, setEventCol] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const [unit, setUnit] = useState<'wan' | 'yi' | ''>('');

  // Update state when modal opens or initialConfig changes
  useEffect(() => {
    if (isOpen) {
        if (initialConfig) {
            setType(initialConfig.type || 'bar');
            setTitle(initialConfig.title || '');
            setCategoryCol(initialConfig.categoryCol || '');
            setValueCol(initialConfig.valueCol || '');
            setDateCol(initialConfig.dateCol || '');
            setEventCol(initialConfig.eventCol || '');
            setShowLabels(initialConfig.showLabels || false);
            setUnit(initialConfig.unit || '');
        } else {
            // Default reset
            setType('bar');
            setTitle('');
            setCategoryCol('');
            setValueCol('');
            setDateCol('');
            setEventCol('');
            setShowLabels(false);
            setUnit('');
        }
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title) {
        alert("请输入标题");
        return;
    }

    const config: any = { type, title, showLabels, unit };
    
    if (type === 'timeline') {
        if (!dateCol || !eventCol) {
            alert("请选择时间列和事件列");
            return;
        }
        config.dateCol = dateCol;
        config.eventCol = eventCol;
    } else {
        if (!categoryCol || !valueCol) {
            alert("请选择分类列和数值列");
            return;
        }
        config.categoryCol = categoryCol;
        config.valueCol = valueCol;
    }
    
    onAdd(config);
    // Reset
    setTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">{initialConfig ? '编辑组件' : '添加组件'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>

        <div className="space-y-4">
          {/* Chart Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">组件类型</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'bar', icon: BarChart, label: '柱状图' },
                { id: 'line', icon: LineChart, label: '折线图' },
                { id: 'pie', icon: PieChart, label: '饼图' },
                { id: 'radar', icon: Radar, label: '雷达图' },
                { id: 'timeline', icon: Clock, label: '时间轴' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setType(item.id as any)}
                  className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                    type === item.id 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <item.icon size={18} className="mb-1" />
                  <span className="text-[10px]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              placeholder="例如：每月销售额"
            />
          </div>

          {type === 'timeline' ? (
             <>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">时间列 (Date)</label>
                    <select 
                        value={dateCol}
                        onChange={(e) => setDateCol(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">请选择...</option>
                        {columns.date.length > 0 ? (
                             columns.date.map(c => <option key={c} value={c}>{c}</option>)
                        ) : (
                             columns.text.map(c => <option key={c} value={c}>{c}</option>)
                        )}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">事件内容列 (Text)</label>
                    <select 
                        value={eventCol}
                        onChange={(e) => setEventCol(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">请选择...</option>
                        {columns.text.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
             </>
          ) : (
            <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">分类维度 (X轴)</label>
                      <select 
                          value={categoryCol}
                          onChange={(e) => setCategoryCol(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      >
                          <option value="">请选择...</option>
                          {columns.text.map(c => <option key={c} value={c}>{c}</option>)}
                          {columns.date.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">数值指标 (Y轴)</label>
                      <select 
                          value={valueCol}
                          onChange={(e) => setValueCol(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      >
                          <option value="">请选择...</option>
                          {columns.numeric.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  </div>
                </div>

                {/* Unit Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">数值单位</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {[
                            { value: '', label: '默认' },
                            { value: 'wan', label: '万' },
                            { value: 'yi', label: '亿' }
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setUnit(opt.value as any)}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    unit === opt.value 
                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Show Labels Toggle */}
                <div className="flex items-center gap-2 pt-2">
                    <input 
                        type="checkbox" 
                        id="showLabels"
                        checked={showLabels}
                        onChange={(e) => setShowLabels(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor="showLabels" className="text-sm text-gray-700 select-none cursor-pointer flex items-center gap-1">
                        <Tag size={14} className="text-gray-500"/> 显示数据标签
                    </label>
                </div>
            </>
          )}

          <button 
            onClick={handleSubmit}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition-colors mt-4 active:scale-[0.99] transform"
          >
            {initialConfig ? '保存修改' : '确认添加'}
          </button>
        </div>
      </div>
    </div>
  );
}
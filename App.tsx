import React, { useState, useMemo, useRef } from 'react';
import { 
  Upload, Plus, LayoutDashboard, Filter, Database, FileSpreadsheet, 
  Trash2, Layers, AlertCircle, Hash, Type, Calendar, ArrowLeft, MoreVertical, Edit2, Check,
  Square, CheckSquare, Columns, Maximize2, Grid, Rows, Radar, ChevronDown, ChevronUp, XCircle, X
} from 'lucide-react';
import _ from 'lodash';

import { processExcelFile, Dataset, DataRow } from './lib/data';
import { generateId, cn } from './lib/utils';
import WidgetConfigModal from './components/WidgetConfigModal';
import BoardGrid from './components/BoardGrid';

// --- Types ---
interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

interface WidgetItem {
  i: string;
  datasetId: string; // Link widget to specific dataset
  type: 'bar' | 'line' | 'pie' | 'timeline' | 'radar';
  title: string;
  config: any; 
}

interface Board {
    id: string;
    name: string;
    layout: Layout[];
    widgets: WidgetItem[];
    filters?: { [key: string]: string[] }; // Board-specific filters
    createdAt: number;
}

// Global Slicer State: { [columnName]: [selectedValues] }
interface GlobalSlicerState {
    [column: string]: string[];
}

type ViewMode = 'list' | 'detail' | 'split';
type SplitLayout = 'grid' | 'horizontal' | 'vertical';

export default function App() {
  // --- State ---
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  
  // --- Board State ---
  const [boards, setBoards] = useState<Board[]>([
      { id: 'default', name: '默认看板', layout: [], widgets: [], filters: {}, createdAt: Date.now() }
  ]);
  
  // View State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null); // For 'detail' mode
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);  // For 'split' mode selection
  const [splitLayout, setSplitLayout] = useState<SplitLayout>('grid');     // For split view layout
  
  // Global Slicers
  const [slicers, setSlicers] = useState<GlobalSlicerState>({});
  const [activeSlicerCol, setActiveSlicerCol] = useState<string | null>(null);
  
  // Local Slicer UI State
  const [openFilterBoardId, setOpenFilterBoardId] = useState<string | null>(null); // For Split View
  const [isDetailFilterOpen, setIsDetailFilterOpen] = useState(false); // For Detail View

  // UI State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [initialWidgetConfig, setInitialWidgetConfig] = useState<any>(null); 
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  // Important: track which board is being operated on (added for split view support)
  const [operatingBoardId, setOperatingBoardId] = useState<string | null>(null); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Board Rename State
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [tempBoardName, setTempBoardName] = useState("");

  // Confirmation Modal State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Computed Data ---
  const activeDataset = useMemo(() => 
    datasets.find(d => d.id === activeDatasetId) || null
  , [datasets, activeDatasetId]);

  const activeBoard = useMemo(() => 
    boards.find(b => b.id === activeBoardId) || null
  , [boards, activeBoardId]);

  // Boards to display in split view
  const splitBoards = useMemo(() => 
    boards.filter(b => selectedBoardIds.includes(b.id))
  , [boards, selectedBoardIds]);

  // Updated: Calculate common columns using ALL columns (not just textColumns)
  const commonColumns = useMemo(() => {
      if (datasets.length === 0) return [];
      if (datasets.length === 1) return datasets[0].columns;

      // Global intersection of ALL datasets columns
      const allCols = datasets.map(d => d.columns);
      return _.intersection(...allCols);
  }, [datasets]);

  // --- Helper: Request Confirmation ---
  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
      setConfirmState({
          isOpen: true,
          title,
          message,
          onConfirm
      });
  };

  const handleConfirmAction = () => {
      confirmState.onConfirm();
      setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  // --- Data Logic ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const newData = await processExcelFile(file);
        setDatasets(prev => [...prev, newData]);
        setActiveDatasetId(newData.id);
      } catch (err) {
        alert("文件解析失败，请检查是否为有效的 Excel 文件");
        console.error(err);
      } finally {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      }
    }
  };

  const removeDataset = (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      requestConfirm(
          "删除数据源", 
          "确定要删除此数据源吗？\n删除后，所有看板中依赖此文件的图表也将被自动移除。", 
          () => {
            const newDatasets = datasets.filter(d => d.id !== id);
            setDatasets(newDatasets);
            
            setBoards(prevBoards => prevBoards.map(board => {
                const remainingWidgets = board.widgets.filter(w => w.datasetId !== id);
                const remainingWidgetIds = new Set(remainingWidgets.map(w => w.i));
                const remainingLayout = board.layout.filter(l => remainingWidgetIds.has(l.i));
                return {
                    ...board,
                    widgets: remainingWidgets,
                    layout: remainingLayout
                };
            }));

            if (activeDatasetId === id) {
                setActiveDatasetId(newDatasets.length > 0 ? newDatasets[0].id : null);
            }
          }
      );
  };

  // --- Board Management ---
  const handleAddBoard = () => {
      const newBoard: Board = {
          id: generateId(),
          name: `看板 ${boards.length + 1}`,
          layout: [],
          widgets: [],
          filters: {},
          createdAt: Date.now()
      };
      setBoards(prev => [...prev, newBoard]);
  };

  const handleDeleteBoard = (boardId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      requestConfirm("删除看板", "确定要删除这个看板吗？", () => {
          setBoards(prev => prev.filter(b => b.id !== boardId));
          if (activeBoardId === boardId) {
              setActiveBoardId(null);
              setViewMode('list');
          }
          setSelectedBoardIds(prev => prev.filter(id => id !== boardId));
      });
  };

  const startRenamingBoard = (board: Board, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingBoardId(board.id);
      setTempBoardName(board.name);
  };

  const saveBoardName = (e?: React.FormEvent) => {
      if(e) e.preventDefault();
      if (editingBoardId && tempBoardName.trim()) {
          setBoards(prev => prev.map(b => 
              b.id === editingBoardId ? { ...b, name: tempBoardName.trim() } : b
          ));
      }
      setEditingBoardId(null);
  };

  // --- View Mode Logic ---
  const goToDetailView = (boardId: string) => {
      setActiveBoardId(boardId);
      setViewMode('detail');
      setIsDetailFilterOpen(false); 
      setOperatingBoardId(null);
  };

  const goToListView = () => {
      setActiveBoardId(null);
      setViewMode('list');
      setOperatingBoardId(null);
  };

  const goToSplitView = () => {
      if (selectedBoardIds.length === 0) return;
      setViewMode('split');
      setSplitLayout('grid'); 
      setOperatingBoardId(null);
  };

  const toggleBoardSelection = (boardId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedBoardIds(prev => {
          if (prev.includes(boardId)) return prev.filter(id => id !== boardId);
          return [...prev, boardId];
      });
  };

  // --- Widget Management ---
  const handleSaveWidget = (config: any) => {
    // Determine target board: if editing in split view, use operatingBoardId; otherwise activeBoardId
    const targetBoardId = editingWidgetId ? operatingBoardId : activeBoardId;

    if (!targetBoardId) return;

    if (editingWidgetId) {
        setBoards(prev => prev.map(b => {
            if (b.id !== targetBoardId) return b;
            return {
                ...b,
                widgets: b.widgets.map(w => {
                    if (w.i === editingWidgetId) {
                        return { ...w, type: config.type, title: config.title, config: config };
                    }
                    return w;
                })
            };
        }));
        setEditingWidgetId(null);
        setOperatingBoardId(null);
    } else {
        // Adding new widget
        if (!activeDatasetId) return;
        const id = generateId();
        const newWidget: WidgetItem = {
            i: id,
            datasetId: activeDatasetId,
            type: config.type,
            title: config.title,
            config: config
        };

        const targetBoard = boards.find(b => b.id === targetBoardId);

        const newLayoutItem: Layout = {
            i: id,
            x: (targetBoard?.widgets.length || 0 * 4) % 12,
            y: Infinity,
            w: config.type === 'timeline' ? 3 : 4,
            h: config.type === 'timeline' ? 8 : 6,
            minW: 2, minH: 3
        };

        setBoards(prev => prev.map(b => {
            if (b.id !== targetBoardId) return b;
            return {
                ...b,
                widgets: [...b.widgets, newWidget],
                layout: [...b.layout, newLayoutItem]
            };
        }));
    }
  };

  // Updated to accept boardId to support Split View editing
  const handleEditWidget = (boardId: string, widget: WidgetItem) => {
      setOperatingBoardId(boardId); // Track which board we are editing
      setActiveDatasetId(widget.datasetId);
      setEditingWidgetId(widget.i);
      setInitialWidgetConfig({
          type: widget.type,
          title: widget.title,
          ...widget.config
      });
      setIsConfigOpen(true);
  };

  // Updated to accept boardId to support Split View removing
  const handleRemoveWidget = (boardId: string, widgetId: string) => {
    setBoards(prev => prev.map(b => {
        if (b.id !== boardId) return b;
        return {
            ...b,
            widgets: b.widgets.filter(w => w.i !== widgetId),
            layout: b.layout.filter(l => l.i !== widgetId)
        };
    }));
  };

  // Updated to accept boardId to support Split View layout changes
  const handleLayoutChange = (boardId: string, newLayout: Layout[]) => {
    setBoards(prev => prev.map(b => {
        if (b.id !== boardId) return b;
        return { ...b, layout: newLayout };
    }));
  };

  const handleFieldClick = (field: string, type: 'numeric' | 'text' | 'date') => {
      if (viewMode !== 'detail' || !activeBoardId) {
          alert("请先进入一个看板的详情模式，然后再添加图表。");
          return;
      }
      let config: any = {};
      if (type === 'numeric') {
          config = { type: 'bar', valueCol: field, title: `${field} 分析` };
      } else if (type === 'text') {
          config = { type: 'bar', categoryCol: field, title: `按 ${field} 分布` };
      } else if (type === 'date') {
          config = { type: 'timeline', dateCol: field, title: `${field} 时间轴` };
      }
      setInitialWidgetConfig(config);
      setEditingWidgetId(null); 
      setOperatingBoardId(null); // Ensure we are adding to the active board
      setIsConfigOpen(true);
  };

  // --- Slicer Logic (Global & Local) ---
  const toggleSlicerValue = (col: string, val: string, boardId?: string) => {
    if (boardId) {
        // Update Local Board Slicer
        setBoards(prev => prev.map(b => {
            if (b.id !== boardId) return b;
            const currentFilters = b.filters || {};
            const currentVals = currentFilters[col] || [];
            let newVals;
            if (currentVals.includes(val)) {
                newVals = currentVals.filter(v => v !== val);
            } else {
                newVals = [...currentVals, val];
            }
            return {
                ...b,
                filters: {
                    ...currentFilters,
                    [col]: newVals
                }
            };
        }));
    } else {
        // Update Global Slicer
        setSlicers(prev => {
            const currentVals = prev[col] || [];
            let newVals;
            if (currentVals.includes(val)) {
                newVals = currentVals.filter(v => v !== val);
            } else {
                newVals = [...currentVals, val];
            }
            return { ...prev, [col]: newVals };
        });
    }
  };

  // Used for Global Slicers (All datasets)
  const getGlobalUniqueValues = (col: string) => {
      if (datasets.length === 0) return [];
      let allValues: string[] = [];
      datasets.forEach(ds => {
          if (ds.columns.includes(col)) {
              const vals = ds.rows.map(r => String(r[col]));
              allValues = allValues.concat(vals);
          }
      });
      return _.uniq(allValues).sort().slice(0, 50);
  };

  // --- Board Specific Logic ---
  const getBoardSpecificData = (board: Board) => {
      const usedDatasetIds = new Set(board.widgets.map(w => w.datasetId));
      const usedDatasets = datasets.filter(d => usedDatasetIds.has(d.id));

      if (usedDatasets.length === 0) {
          return { columns: [], getValues: () => [] };
      }

      const datasetColumns = usedDatasets.map(d => d.columns);
      const columns = _.intersection(...datasetColumns);

      const getValues = (col: string) => {
          let allValues: string[] = [];
          usedDatasets.forEach(ds => {
              if (ds.columns.includes(col)) {
                  const vals = ds.rows.map(r => String(r[col]));
                  allValues = allValues.concat(vals);
              }
          });
          return _.uniq(allValues).sort().slice(0, 50);
      };

      return { columns, getValues };
  };

  // --- Render ---
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className={cn(
        "bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-20 shadow-xl",
        isSidebarOpen ? "w-80" : "w-0 overflow-hidden"
      )}>
        {/* Sidebar Header & Upload */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
           <div className="flex items-center gap-2 text-blue-600 mb-4 cursor-pointer" onClick={goToListView}>
                <Database size={24} />
                <h1 className="font-bold text-xl tracking-tight">DataBoard</h1>
           </div>
           
           <div 
                onClick={handleImportClick}
                className="flex items-center justify-center w-full h-12 border border-blue-200 border-dashed rounded-lg cursor-pointer bg-blue-50/50 hover:bg-blue-50 transition-colors group mb-3 shadow-sm select-none"
           >
                <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-700 font-medium group-hover:text-blue-600">导入 Excel</span>
                </div>
                <input 
                    ref={fileInputRef}
                    type="file" 
                    className="hidden" 
                    accept=".xlsx, .xls" 
                    onChange={handleFileChange} 
                />
           </div>

           {/* Dataset List */}
           {datasets.length > 0 && (
               <div className="space-y-2">
                   <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                       数据源文件
                   </p>
                   <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                       {datasets.map(ds => (
                           <div 
                                key={ds.id}
                                className={cn(
                                    "flex items-stretch justify-between rounded-md text-sm border transition-all select-none overflow-hidden h-9",
                                    activeDatasetId === ds.id 
                                        ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm" 
                                        : "bg-white border-transparent hover:bg-gray-100 text-gray-600"
                                )}
                           >
                               <div 
                                   className="flex-1 min-w-0 flex items-center gap-2 px-3 cursor-pointer"
                                   onClick={() => setActiveDatasetId(ds.id)}
                               >
                                   <Layers size={14} className={cn("flex-shrink-0", activeDatasetId === ds.id ? "text-blue-500" : "text-gray-400")}/>
                                   <span className="truncate" title={ds.name}>{ds.name}</span>
                               </div>
                               <button 
                                  type="button"
                                  onClick={(e) => removeDataset(ds.id, e)}
                                  className={cn(
                                      "w-9 flex items-center justify-center cursor-pointer z-10 transition-all",
                                      "hover:bg-red-100 hover:text-red-500 hover:scale-110 active:scale-90",
                                      activeDatasetId === ds.id ? "text-red-400" : "text-gray-300"
                                  )}
                                  title="删除文件"
                               >
                                   <Trash2 size={14} className="pointer-events-none" />
                               </button>
                           </div>
                       ))}
                   </div>
               </div>
           )}
        </div>

        {/* Sidebar Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
            {datasets.length === 0 ? (
                <div className="text-center text-gray-400 mt-10 text-sm p-4">
                    请先导入 Excel 数据源<br/>
                    <span className="text-xs mt-2 block">导入后可在右侧创建看板</span>
                </div>
            ) : (
                <div className="flex flex-col">
                    {/* SECTION 1: Current File Fields */}
                    {activeDataset && viewMode === 'detail' && (
                        <div className="p-4 border-b border-gray-100 bg-white">
                            <div className="flex items-center gap-2 mb-3">
                                <FileSpreadsheet size={16} className="text-green-600"/>
                                <span className="text-sm font-semibold text-gray-800 truncate" title={activeDataset.name}>
                                    字段列表 (点击添加图表)
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {activeDataset.numericColumns.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                                            <Hash size={10}/> <span>数值 (Y轴)</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {activeDataset.numericColumns.map(col => (
                                                <button 
                                                    key={col} 
                                                    onClick={() => handleFieldClick(col, 'numeric')}
                                                    className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 truncate max-w-full hover:bg-green-100 hover:border-green-300 transition-colors"
                                                >
                                                    {col}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {activeDataset.dateColumns.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                                            <Calendar size={10}/> <span>时间 (时间轴)</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {activeDataset.dateColumns.map(col => (
                                                <button 
                                                    key={col} 
                                                    onClick={() => handleFieldClick(col, 'date')}
                                                    className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 truncate max-w-full hover:bg-orange-100 hover:border-orange-300 transition-colors"
                                                >
                                                    {col}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {activeDataset.textColumns.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                                            <Type size={10}/> <span>文本 (X轴/分类)</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {activeDataset.textColumns.map(col => (
                                                <button 
                                                    key={col} 
                                                    onClick={() => handleFieldClick(col, 'text')}
                                                    className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 truncate max-w-full hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                                >
                                                    {col}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {viewMode !== 'detail' && activeDataset && (
                         <div className="p-4 bg-yellow-50 text-yellow-700 text-sm border-b border-yellow-100">
                             请先进入单个看板的详情模式，才能添加或编辑图表。
                         </div>
                    )}

                    {/* SECTION 2: Global Slicers */}
                    <div className="p-4 space-y-4">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                 <Filter size={16}/> <span>公共切片器 (Global)</span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-tight">
                                {commonColumns.length > 0 
                                     ? "筛选将应用到所有可见的看板图表 (所有数据源的公共字段，含文本/数值/日期)" 
                                     : "未发现所有文件共有的字段，无法全局切片"}
                            </p>
                        </div>
                        {commonColumns.slice(0, 10).map(col => {
                            const selectedVals = slicers[col] || [];
                            const selectedCount = selectedVals.length;
                            return (
                                <div key={col} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                    <div 
                                        className="flex justify-between items-center cursor-pointer mb-2"
                                        onClick={() => setActiveSlicerCol(activeSlicerCol === col ? null : col)}
                                    >
                                        <span className="text-sm font-medium text-gray-700 truncate w-4/5">{col}</span>
                                        {selectedCount > 0 && (
                                            <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                                                {selectedCount}
                                            </span>
                                        )}
                                    </div>
                                    {(activeSlicerCol === col || selectedCount > 0) && (
                                        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 mt-2 pl-1 border-t border-gray-100 pt-2">
                                            {getGlobalUniqueValues(col).map(val => (
                                                <label key={val} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        className="rounded text-blue-500 focus:ring-0 w-3 h-3"
                                                        checked={selectedVals.includes(val)}
                                                        onChange={() => toggleSlicerValue(col, val)}
                                                    />
                                                    <span className="truncate">{val}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative bg-gray-100 overflow-hidden">
        
        {/* Toolbar */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm z-30 flex-shrink-0 relative">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                >
                    <FileSpreadsheet size={20} />
                </button>
                
                {viewMode !== 'list' ? (
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={goToListView}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-blue-600 transition-colors"
                            title="返回看板列表"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <span className="text-gray-300">|</span>
                        <h2 className="text-gray-800 font-semibold text-lg">
                            {viewMode === 'split' ? `分窗口查看 (${splitBoards.length})` : activeBoard?.name}
                        </h2>
                    </div>
                ) : (
                    <h2 className="text-gray-800 font-semibold text-lg">所有看板</h2>
                )}
            </div>

            <div className="flex items-center gap-3">
                {/* Mode Specific Buttons */}
                {viewMode === 'list' && (
                    <>
                        {selectedBoardIds.length > 0 && (
                            <button 
                                onClick={goToSplitView}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors border border-indigo-200"
                            >
                                <Columns size={16} />
                                分窗口查看 ({selectedBoardIds.length})
                            </button>
                        )}
                        <button 
                            onClick={handleAddBoard}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                        >
                            <Plus size={16} />
                            新建看板
                        </button>
                    </>
                )}

                {viewMode === 'split' && (
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                        <button 
                            onClick={() => setSplitLayout('grid')}
                            className={cn("p-1.5 rounded transition-all", splitLayout === 'grid' ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700")}
                            title="网格排列 (Grid)"
                        >
                            <Grid size={18} />
                        </button>
                        <button 
                            onClick={() => setSplitLayout('vertical')}
                            className={cn("p-1.5 rounded transition-all", splitLayout === 'vertical' ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700")}
                            title="竖向排列 (Vertical)"
                        >
                            <Rows size={18} />
                        </button>
                        <button 
                            onClick={() => setSplitLayout('horizontal')}
                            className={cn("p-1.5 rounded transition-all", splitLayout === 'horizontal' ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700")}
                            title="横向排列 (Horizontal)"
                        >
                            <Columns size={18} />
                        </button>
                    </div>
                )}

                {viewMode === 'detail' && (
                    <div className="flex items-center gap-2">
                        {/* Detail View Board Filter Toggle */}
                        <button 
                            onClick={() => setIsDetailFilterOpen(!isDetailFilterOpen)}
                            className={cn(
                                "p-2 rounded-lg transition-colors border flex items-center gap-2 text-sm font-medium",
                                isDetailFilterOpen || (activeBoard?.filters && Object.values(activeBoard.filters).some(v => v.length > 0))
                                    ? "bg-blue-50 border-blue-200 text-blue-600" 
                                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                            )}
                            title="当前看板切片器"
                        >
                            <Filter size={16} />
                            {isSidebarOpen ? "看板筛选 (Local)" : ""}
                        </button>
                        
                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <button 
                            onClick={() => {
                                if (!activeDataset) return alert("请先在左侧选择一个数据文件作为绘图数据源");
                                setInitialWidgetConfig(null);
                                setEditingWidgetId(null);
                                setOperatingBoardId(null); // Add widget mode
                                setIsConfigOpen(true);
                            }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm",
                                activeDataset 
                                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                    : "bg-gray-100 text-gray-400" 
                            )}
                        >
                            <Plus size={16} />
                            {activeDataset ? "添加图表" : "请先选择文件"}
                        </button>
                    </div>
                )}
            </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-hidden bg-slate-50 relative flex flex-col">
            
            {/* VIEW 1: Board List */}
            {viewMode === 'list' && (
                <div className="h-full overflow-y-auto custom-scrollbar p-6">
                    <div className="max-w-5xl mx-auto space-y-4">
                        {boards.length === 0 && (
                            <div className="text-center py-20 text-gray-400">
                                <LayoutDashboard size={48} className="mx-auto mb-4 opacity-50"/>
                                <p>暂无看板，请点击右上角新建</p>
                            </div>
                        )}
                        
                        {boards.map(board => {
                            const isSelected = selectedBoardIds.includes(board.id);
                            return (
                                <div 
                                    key={board.id} 
                                    className={cn(
                                        "group bg-white rounded-xl border p-4 transition-all flex items-center justify-between cursor-pointer hover:shadow-md",
                                        isSelected ? "border-blue-300 ring-1 ring-blue-100" : "border-gray-200"
                                    )}
                                    onClick={() => goToDetailView(board.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div 
                                            className="p-2 text-gray-400 hover:text-blue-600 cursor-pointer"
                                            onClick={(e) => toggleBoardSelection(board.id, e)}
                                            title="选择以进行分屏对比"
                                        >
                                            {isSelected ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20} />}
                                        </div>
                                        
                                        <div className="h-12 w-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                            <LayoutDashboard size={24} />
                                        </div>
                                        <div>
                                            {editingBoardId === board.id ? (
                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <input 
                                                        autoFocus
                                                        type="text" 
                                                        value={tempBoardName}
                                                        onChange={e => setTempBoardName(e.target.value)}
                                                        className="border border-blue-300 rounded px-2 py-1 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                        onKeyDown={e => e.key === 'Enter' && saveBoardName()}
                                                    />
                                                    <button onClick={() => saveBoardName()} className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100">
                                                        <Check size={16}/>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group/title">
                                                    <h3 className="text-lg font-semibold text-gray-800">{board.name}</h3>
                                                    <button 
                                                        onClick={(e) => startRenamingBoard(board, e)}
                                                        className="opacity-0 group-hover/title:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-opacity"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {board.widgets.length} 个组件 · 创建于 {new Date(board.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                                            进入看板
                                        </button>
                                        <div className="h-6 w-px bg-gray-200 mx-1"></div>
                                        <button 
                                            onClick={(e) => handleDeleteBoard(board.id, e)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="删除看板"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* VIEW 2: Active Dashboard (Detail) */}
            {viewMode === 'detail' && activeBoard && (
                <div className="h-full flex flex-col relative overflow-hidden">
                    {/* Detail View Filter Panel */}
                    {isDetailFilterOpen && (
                         <div className="bg-white border-b border-gray-200 p-4 shadow-sm z-20 flex-shrink-0 max-h-[35vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                             <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <Filter size={16} className="text-blue-600"/>
                                    <h3 className="text-sm font-bold text-gray-700">【{activeBoard.name}】看板独立筛选</h3>
                                    <span className="text-xs text-gray-400 ml-2">仅显示该看板所用数据源的公共字段 (含数值/日期)</span>
                                </div>
                                <button onClick={() => setIsDetailFilterOpen(false)} className="hover:bg-gray-100 p-1 rounded-full"><X size={18} className="text-gray-500"/></button>
                             </div>
                             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {/* Use board specific logic here */}
                                {(() => {
                                    const { columns, getValues } = getBoardSpecificData(activeBoard);
                                    if (columns.length === 0) return <div className="col-span-full text-xs text-gray-400">该看板暂无数据源或无公共字段</div>
                                    return columns.slice(0, 12).map(col => {
                                        const selectedVals = activeBoard.filters?.[col] || [];
                                        return (
                                            <div key={col} className="space-y-1">
                                                <div className="text-xs font-semibold text-gray-600 flex justify-between">
                                                    <span>{col}</span>
                                                    {selectedVals.length > 0 && <span className="text-blue-500">{selectedVals.length}</span>}
                                                </div>
                                                <div className="bg-gray-50 rounded p-1.5 max-h-32 overflow-y-auto custom-scrollbar border border-gray-200">
                                                    {getValues(col).map(val => (
                                                         <label key={val} className="flex items-center gap-2 px-1 py-0.5 hover:bg-gray-200 cursor-pointer rounded select-none">
                                                            <input 
                                                                type="checkbox" 
                                                                className="rounded text-blue-500 w-3 h-3 focus:ring-0"
                                                                checked={selectedVals.includes(val)}
                                                                onChange={() => toggleSlicerValue(col, val, activeBoard.id)}
                                                            />
                                                            <span className="text-xs text-gray-700 truncate" title={val}>{val}</span>
                                                         </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    });
                                })()}
                             </div>
                         </div>
                    )}

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        <BoardGrid 
                            board={activeBoard}
                            datasets={datasets}
                            slicers={slicers}
                            boardFilters={activeBoard.filters} // Pass local filters
                            isReadOnly={false}
                            onLayoutChange={(newLayout) => handleLayoutChange(activeBoard.id, newLayout)}
                            onRemoveWidget={(id) => handleRemoveWidget(activeBoard.id, id)}
                            onEditWidget={(widget) => handleEditWidget(activeBoard.id, widget)}
                        />
                    </div>
                </div>
            )}

            {/* VIEW 3: Split View */}
            {viewMode === 'split' && (
                <div className={cn(
                    "h-full p-4 gap-4",
                    splitLayout === 'horizontal' ? "flex flex-row overflow-x-auto overflow-y-hidden custom-scrollbar snap-x" : 
                    splitLayout === 'vertical' ? "flex flex-col overflow-y-auto overflow-x-auto custom-scrollbar items-start" : 
                    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 overflow-y-auto custom-scrollbar content-start" // Grid
                )}>
                    {splitBoards.map(board => {
                        const isFilterOpen = openFilterBoardId === board.id;
                        const hasActiveFilters = board.filters && Object.keys(board.filters).some(k => board.filters![k].length > 0);

                        return (
                            <div 
                                key={board.id} 
                                className={cn(
                                    "flex flex-col border rounded-xl shadow-sm bg-white overflow-hidden transition-all bg-white relative",
                                    splitLayout === 'horizontal' ? "min-w-[85vw] md:min-w-[800px] h-full flex-shrink-0 snap-center" : 
                                    splitLayout === 'vertical' ? "w-full min-w-[800px] min-h-[600px] flex-shrink-0" :
                                    "w-full min-h-[450px]" // Grid
                                )}
                            >
                                {/* Board Header with Filter Toggle */}
                                <div className="p-3 bg-gray-50 border-b flex justify-between items-center flex-shrink-0 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-700">{board.name}</span>
                                        {hasActiveFilters && (
                                            <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => setOpenFilterBoardId(isFilterOpen ? null : board.id)}
                                            className={cn("p-1.5 rounded text-gray-500 hover:bg-gray-200 transition-colors", (isFilterOpen || hasActiveFilters) && "text-blue-600 bg-blue-50")}
                                            title="看板切片器 (Filters)"
                                        >
                                            <Filter size={16}/>
                                        </button>
                                        <button onClick={() => goToDetailView(board.id)} className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="全屏查看">
                                            <Maximize2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Local Board Filter Panel (Collapsible) */}
                                {isFilterOpen && (
                                    <div className="bg-white border-b border-gray-100 p-3 shadow-inner max-h-48 overflow-y-auto custom-scrollbar z-20">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-semibold text-gray-500">本看板独立筛选</span>
                                            <button onClick={() => setOpenFilterBoardId(null)}><ChevronUp size={14} className="text-gray-400"/></button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Show board specific columns */}
                                            {(() => {
                                                const { columns, getValues } = getBoardSpecificData(board);
                                                if (columns.length === 0) return <div className="col-span-full text-xs text-gray-400">无公共字段</div>
                                                
                                                return columns.slice(0, 6).map(col => {
                                                    const selectedVals = board.filters?.[col] || [];
                                                    return (
                                                        <div key={col} className="text-xs">
                                                            <div className="font-medium text-gray-700 mb-1">{col}</div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {getValues(col).map(val => (
                                                                    <button
                                                                        key={val}
                                                                        onClick={() => toggleSlicerValue(col, val, board.id)}
                                                                        className={cn(
                                                                            "px-2 py-0.5 rounded border transition-colors truncate max-w-full",
                                                                            selectedVals.includes(val) 
                                                                                ? "bg-blue-100 border-blue-200 text-blue-700" 
                                                                                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                                                        )}
                                                                    >
                                                                        {val}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Board Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-slate-50 relative">
                                    <div className="h-full w-full">
                                        <BoardGrid 
                                            board={board}
                                            datasets={datasets}
                                            slicers={slicers}
                                            boardFilters={board.filters} // Pass local filters
                                            isReadOnly={false} // Updated: Allow interactions in split view
                                            onLayoutChange={(newLayout) => handleLayoutChange(board.id, newLayout)}
                                            onRemoveWidget={(id) => handleRemoveWidget(board.id, id)}
                                            onEditWidget={(widget) => handleEditWidget(board.id, widget)}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
      </div>

      {/* Modals */}
      {activeDataset && (
          <WidgetConfigModal 
            isOpen={isConfigOpen} 
            onClose={() => {
                setIsConfigOpen(false);
                setEditingWidgetId(null);
                setOperatingBoardId(null);
            }}
            onAdd={handleSaveWidget}
            initialConfig={initialWidgetConfig}
            columns={{
                numeric: activeDataset.numericColumns,
                text: activeDataset.textColumns,
                date: activeDataset.dateColumns
            }}
          />
      )}

      {/* Confirmation Modal */}
      {confirmState.isOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-in fade-in duration-200">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 transform transition-all scale-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmState.title || "确认操作"}</h3>
                  <p className="text-gray-600 mb-6 whitespace-pre-wrap text-sm">{confirmState.message}</p>
                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setConfirmState(prev => ({...prev, isOpen: false}))}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                          取消
                      </button>
                      <button 
                          onClick={handleConfirmAction}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                      >
                          确定删除
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
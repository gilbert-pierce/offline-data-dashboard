import React, { useMemo } from 'react';
import * as RGLRaw from 'react-grid-layout';
import { Trash2 } from 'lucide-react';
import { Dataset, aggregateData } from '../lib/data';
import ChartWidget from './ChartWidget';
import TimelineWidget from './TimelineWidget';

// Fix for React Grid Layout Imports
const RGL: any = RGLRaw;
const WidthProvider = RGL.WidthProvider || RGL.default?.WidthProvider;
const GridLayout = RGL.default || RGL;
const ReactGridLayout = WidthProvider ? WidthProvider(GridLayout) : GridLayout;

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
  datasetId: string;
  type: 'bar' | 'line' | 'pie' | 'timeline' | 'radar';
  title: string;
  config: any;
}

interface Board {
  id: string;
  name: string;
  layout: Layout[];
  widgets: WidgetItem[];
  filters?: { [key: string]: string[] }; // Add filters definition
}

interface BoardGridProps {
  board: Board;
  datasets: Dataset[];
  slicers: { [key: string]: string[] }; // Global slicers
  boardFilters?: { [key: string]: string[] }; // Local board filters
  isReadOnly?: boolean;
  onLayoutChange?: (layout: Layout[]) => void;
  onRemoveWidget?: (id: string) => void;
  onEditWidget?: (widget: WidgetItem) => void;
}

const BoardGrid: React.FC<BoardGridProps> = ({ 
  board, 
  datasets, 
  slicers,
  boardFilters, 
  isReadOnly = false, 
  onLayoutChange, 
  onRemoveWidget, 
  onEditWidget 
}) => {

  // Helper to filter rows based on global slicers AND board filters
  const getFilteredRows = (datasetId: string) => {
    const ds = datasets.find(d => d.id === datasetId);
    if (!ds) return [];

    return ds.rows.filter(row => {
        // 1. Check Global Slicers
        const passesGlobal = Object.entries(slicers).every(([col, selectedVals]) => {
            if (!selectedVals || selectedVals.length === 0) return true;
            if (row[col] === undefined) return true;
            return selectedVals.includes(String(row[col]));
        });

        if (!passesGlobal) return false;

        // 2. Check Local Board Filters
        if (boardFilters) {
            const passesLocal = Object.entries(boardFilters).every(([col, selectedVals]) => {
                if (!selectedVals || selectedVals.length === 0) return true;
                if (row[col] === undefined) return true;
                return selectedVals.includes(String(row[col]));
            });
            if (!passesLocal) return false;
        }

        return true;
    });
  };

  if (board.widgets.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 pointer-events-none min-h-[300px]">
            <p className="text-lg">暂无图表</p>
            {!isReadOnly && <p className="text-sm">请从左侧选择字段添加</p>}
        </div>
      );
  }

  return (
    <ReactGridLayout
        className="layout"
        layout={board.layout}
        cols={12}
        rowHeight={60}
        width={1200} // WidthProvider will override this
        isDraggable={!isReadOnly}
        isResizable={!isReadOnly}
        onLayoutChange={onLayoutChange}
        draggableHandle=".draggable-handle"
    >
        {board.widgets.map(w => {
            const widgetDataset = datasets.find(d => d.id === w.datasetId);
            
            if (!widgetDataset) {
                    return (
                        <div key={w.i} className="bg-gray-50 border border-gray-200 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400">
                            <Trash2 size={24} className="mb-2"/>
                            <span className="text-xs">数据源已删除</span>
                            {!isReadOnly && onRemoveWidget && (
                                <button onClick={() => onRemoveWidget(w.i)} className="text-xs text-red-400 mt-2 hover:underline">移除组件</button>
                            )}
                        </div>
                    );
            }

            const currentFilteredRows = getFilteredRows(w.datasetId);

            let content = null;
            if (w.type === 'timeline') {
                    content = (
                    <TimelineWidget 
                        data={currentFilteredRows}
                        config={w.config}
                        title={w.title}
                        onRemove={!isReadOnly && onRemoveWidget ? () => onRemoveWidget(w.i) : undefined}
                    />
                    );
            } else {
                const chartData = aggregateData(
                    currentFilteredRows, 
                    w.config.categoryCol, 
                    w.config.valueCol, 
                    'sum'
                );
                content = (
                    <ChartWidget 
                        data={chartData}
                        type={w.type}
                        title={w.title}
                        config={w.config}
                        onRemove={!isReadOnly && onRemoveWidget ? () => onRemoveWidget(w.i) : undefined}
                        onEdit={!isReadOnly && onEditWidget ? () => onEditWidget(w) : undefined}
                    />
                );
            }

            return (
                <div key={w.i} className="bg-transparent">
                    {content}
                </div>
            );
        })}
    </ReactGridLayout>
  );
};

export default BoardGrid;
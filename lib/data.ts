import * as XLSX from 'xlsx';
import _ from 'lodash';

export interface DataRow {
  [key: string]: any;
}

export interface Dataset {
  id: string;      // Unique ID for the dataset
  name: string;    // File name
  rows: DataRow[];
  columns: string[];
  numericColumns: string[];
  dateColumns: string[];
  textColumns: string[];
}

export const processExcelFile = async (file: File): Promise<Dataset> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse JSON
        const jsonData: DataRow[] = XLSX.utils.sheet_to_json(worksheet, { 
          raw: false, // Try to format dates as strings initially or handle raw
          dateNF: 'yyyy-mm-dd' // Date format
        });

        if (jsonData.length === 0) {
          throw new Error("Excel file is empty");
        }

        // Analyze columns
        const sampleRow = jsonData[0];
        const columns = Object.keys(sampleRow);
        
        const numericColumns: string[] = [];
        const dateColumns: string[] = [];
        const textColumns: string[] = [];

        // Basic heuristic for column types
        columns.forEach(col => {
          const val = sampleRow[col];
          const isNum = !isNaN(Number(val)) && typeof val !== 'boolean';
          const isDate = !isNaN(Date.parse(val)) && (val.toString().includes('-') || val.toString().includes('/'));
          
          // Refine logic: check multiple rows if possible, but keep simple for now
          if (isNum) numericColumns.push(col);
          else if (isDate) dateColumns.push(col);
          else textColumns.push(col);
        });

        resolve({
          id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36), // Generate unique ID
          name: file.name,
          rows: jsonData,
          columns,
          numericColumns,
          dateColumns,
          textColumns: textColumns.length > 0 ? textColumns : columns // Fallback
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsBinaryString(file);
  });
};

// Aggregate data for charts
export const aggregateData = (
  data: DataRow[], 
  categoryCol: string, 
  valueCol: string, 
  operation: 'sum' | 'count' | 'avg' = 'sum'
) => {
  const grouped = _.groupBy(data, categoryCol);
  
  return Object.keys(grouped).map(key => {
    const items = grouped[key];
    let value = 0;
    
    if (operation === 'count') {
      value = items.length;
    } else {
      const sum = _.sumBy(items, item => Number(item[valueCol]) || 0);
      value = operation === 'avg' ? sum / items.length : sum;
    }

    return {
      name: key,
      value: Math.round(value * 100) / 100 // Round to 2 decimals
    };
  });
};
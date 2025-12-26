import React, { useState } from 'react';
import { DollarSign, Upload, Download, X, Plus, Trash2, Search, BarChart3, List, FileText, FileSpreadsheet, AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Briefcase, Edit, Check, Undo2 } from 'lucide-react';

export default function MedicareCommissionTracker() {
  const [commissions, setCommissions] = useState([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [importError, setImportError] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const [filters, setFilters] = useState({ searchTerm: '', carrier: '', commissionType: '', agent: '', startDate: '', endDate: '' });
  const [columnMapping, setColumnMapping] = useState({ paymentDate: '', clientName: '', policyNumber: '', policyType: '', commissionType: '', agent: '', amount: '', effectiveDate: '', commPeriod: '', lives: '' });
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [formData, setFormData] = useState({ paymentDate: new Date().toISOString().split('T')[0], carrier: '', clientName: '', policyNumber: '', policyType: '', commissionType: '', agent: '', amount: '' });
  const [reportRange, setReportRange] = useState({ startDate: '', endDate: '', carrier: '', agent: '', commissionType: '' });
  const [businessType, setBusinessType] = useState('all');
  const [importPreview, setImportPreview] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [policyFilter, setPolicyFilter] = useState('all');
  const [policyCarrierFilter, setPolicyCarrierFilter] = useState('all');
  const [policyBusinessFilter, setPolicyBusinessFilter] = useState('all');
  const [policySearchTerm, setPolicySearchTerm] = useState('');
  
  // Mass selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showMassEdit, setShowMassEdit] = useState(false);
  const [massEditField, setMassEditField] = useState('');
  const [massEditValue, setMassEditValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Multi-file upload state
  const [uploadQueue, setUploadQueue] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  
  // Undo state
  const [undoHistory, setUndoHistory] = useState([]);
  const [undoMessage, setUndoMessage] = useState('');
  
  // Saved carrier column mappings
  const [savedMappings, setSavedMappings] = useState({});

  const medicareCarriers = ['Humana', 'UnitedHealthcare', 'Aetna', 'Cigna', 'Blue Cross Blue Shield', 'Wellcare', 'Devoted Health', 'Anthem', 'Kaiser Permanente', 'Mutual of Omaha'];
  const acaCarriers = ['Ambetter', 'Oscar', 'Molina', 'BCBS Marketplace', 'Cigna Marketplace', 'UnitedHealthcare Marketplace', 'Aetna Marketplace', 'Florida Blue', 'Bright Health', 'Friday Health', 'Avera Health'];
  const lifeCarriers = ['Mutual of Omaha', 'Transamerica', 'Prudential', 'Lincoln Financial', 'John Hancock', 'MetLife', 'New York Life', 'Northwestern Mutual', 'MassMutual', 'AIG', 'Nationwide', 'Principal', 'Pacific Life', 'Protective Life', 'Americo', 'Foresters', 'Globe Life', 'SBLI', 'Ethos', 'Ladder'];
  const carriers = [...new Set([...medicareCarriers, ...acaCarriers, ...lifeCarriers, 'Other'])].sort();
  const commissionTypes = ['Renewal', 'First Year Commission', 'Medicare True-Up', 'Medicare Supplement Annualized', 'ACA Monthly', 'ACA Initial', 'ACA Chargeback', 'Life FYC', 'Life Renewal', 'Life Trail', 'Life Advance', 'Life Chargeback', 'Final Expense FYC', 'Final Expense Renewal'];

  React.useEffect(() => {
    const load = () => {
      try {
        const stored = localStorage.getItem('medicare-commissions');
        if (stored) setCommissions(JSON.parse(stored));
        
        // Load saved carrier mappings
        const savedMaps = localStorage.getItem('carrier-column-mappings');
        if (savedMaps) setSavedMappings(JSON.parse(savedMaps));
      } catch (e) { console.log(e); }
      setLoading(false);
    };
    load();
  }, []);

  const save = async (data, actionDescription = '') => {
    try { 
      // Save current state to undo history before making changes
      if (commissions.length > 0 && actionDescription) {
        setUndoHistory(prev => [...prev.slice(-9), { data: commissions, description: actionDescription }]); // Keep last 10
        setUndoMessage(actionDescription);
        // Auto-hide undo message after 5 seconds
        setTimeout(() => setUndoMessage(''), 5000);
      }
      localStorage.setItem('medicare-commissions', JSON.stringify(data)); 
      setCommissions(data); 
    } catch (e) { alert('Save failed'); }
  };

  const handleUndo = async () => {
    if (undoHistory.length === 0) return;
    const lastState = undoHistory[undoHistory.length - 1];
    setUndoHistory(prev => prev.slice(0, -1));
    try {
      localStorage.setItem('medicare-commissions', JSON.stringify(lastState.data));
      setCommissions(lastState.data);
      setUndoMessage('');
    } catch (e) { alert('Undo failed'); }
  };

  // Generate a unique key for duplicate detection
  const getRecordKey = (record) => {
    const date = (record.paymentDate || '').trim();
    const policy = (record.policyNumber || '').trim().toUpperCase();
    const amount = parseFloat(String(record.amount || '0').replace(/[$,]/g, '')) || 0;
    const carrier = (record.carrier || '').trim().toUpperCase();
    return `${date}|${policy}|${amount.toFixed(2)}|${carrier}`;
  };

  // Check for duplicates
  const checkForDuplicates = (newRecords, existingRecords) => {
    const existingKeys = new Set(existingRecords.map(r => getRecordKey(r)));
    const seenInBatch = new Set();
    return newRecords.map(record => {
      const key = getRecordKey(record);
      const isDuplicateOfExisting = existingKeys.has(key);
      const isDuplicateInBatch = seenInBatch.has(key);
      seenInBatch.add(key);
      return { ...record, isDuplicate: isDuplicateOfExisting || isDuplicateInBatch, duplicateType: isDuplicateOfExisting ? 'existing' : isDuplicateInBatch ? 'batch' : null };
    });
  };

  // ============ POLICY & CHARGEBACK ANALYSIS ============
  const analyzePolicies = () => {
    const policyMap = {};
    
    commissions.forEach(c => {
      const policyNum = (c.policyNumber || '').trim().toUpperCase();
      if (!policyNum) return;
      
      if (!policyMap[policyNum]) {
        policyMap[policyNum] = {
          policyNumber: c.policyNumber,
          clientName: c.clientName,
          carrier: c.carrier,
          agent: c.agent,
          businessType: c.businessType,
          policyType: c.policyType,
          transactions: [],
          totalCommissions: 0,
          totalChargebacks: 0,
          netRevenue: 0,
          firstPayment: null,
          lastPayment: null,
          hasChargeback: false,
          status: 'healthy'
        };
      }
      
      const policy = policyMap[policyNum];
      policy.transactions.push(c);
      
      if (c.amount >= 0) {
        policy.totalCommissions += c.amount;
      } else {
        policy.totalChargebacks += Math.abs(c.amount);
        policy.hasChargeback = true;
      }
      policy.netRevenue += c.amount;
      
      // Track first and last payment dates
      if (!policy.firstPayment || c.paymentDate < policy.firstPayment) {
        policy.firstPayment = c.paymentDate;
      }
      if (!policy.lastPayment || c.paymentDate > policy.lastPayment) {
        policy.lastPayment = c.paymentDate;
      }
      
      // Update client name if we have a better one
      if (c.clientName && (!policy.clientName || policy.clientName.length < c.clientName.length)) {
        policy.clientName = c.clientName;
      }
    });
    
    // Determine policy status
    Object.values(policyMap).forEach(policy => {
      if (policy.netRevenue <= 0) {
        policy.status = 'churned'; // Net loss - likely fully charged back
      } else if (policy.hasChargeback) {
        policy.status = 'at-risk'; // Has chargebacks but still net positive
      } else {
        policy.status = 'healthy'; // No chargebacks
      }
      
      // Sort transactions by date
      policy.transactions.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));
    });
    
    return Object.values(policyMap).sort((a, b) => b.netRevenue - a.netRevenue);
  };

  const policies = analyzePolicies();
  const policyCarriers = [...new Set(policies.map(p => p.carrier))].filter(Boolean).sort();
  
  const filteredPolicies = policies.filter(p => {
    if (policySearchTerm) {
      const s = policySearchTerm.toLowerCase();
      if (!(p.clientName?.toLowerCase().includes(s) || p.policyNumber?.toLowerCase().includes(s))) return false;
    }
    if (policyFilter !== 'all' && p.status !== policyFilter) return false;
    if (policyBusinessFilter !== 'all' && p.businessType !== policyBusinessFilter) return false;
    if (policyCarrierFilter !== 'all' && p.carrier !== policyCarrierFilter) return false;
    return true;
  });

  const policyStats = {
    total: filteredPolicies.length,
    healthy: filteredPolicies.filter(p => p.status === 'healthy').length,
    atRisk: filteredPolicies.filter(p => p.status === 'at-risk').length,
    churned: filteredPolicies.filter(p => p.status === 'churned').length,
    totalChargebacks: filteredPolicies.reduce((sum, p) => sum + p.totalChargebacks, 0),
    netRevenue: filteredPolicies.reduce((sum, p) => sum + p.netRevenue, 0),
    chargebackRate: filteredPolicies.length > 0 ? (filteredPolicies.filter(p => p.hasChargeback).length / filteredPolicies.length * 100) : 0
  };

  const parseRow = (row) => {
    const result = []; let current = '', inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '"') inQuotes = !inQuotes;
      else if (row[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += row[i];
    }
    result.push(current.trim());
    return result.map(v => v.replace(/^"|"$/g, ''));
  };

  // Smart parser for multi-section life insurance statements
  const parseLifeInsuranceStatement = (text) => {
    const lines = text.split(/\r?\n/);
    const records = [];
    let currentStatementDate = '';
    let currentSection = '';
    let sectionHeaders = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Detect statement date line
      if (line.includes('STATEMENT DATE :')) {
        const dateMatch = line.match(/STATEMENT DATE\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
          currentStatementDate = dateMatch[1];
        }
        continue;
      }
      
      // Detect section headers
      if (line === 'Commission Detail' || line === 'Advance Detail' || line === 'Miscellaneous Earnings / Non-Earnings') {
        currentSection = line;
        // Next non-empty line should be column headers
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim()) {
            sectionHeaders = parseRow(lines[j]);
            i = j;
            break;
          }
        }
        continue;
      }
      
      // Parse data rows in Commission Detail section (main commission data)
      if (currentSection === 'Commission Detail' && sectionHeaders.length > 0) {
        const values = parseRow(line);
        if (values.length >= sectionHeaders.length - 2 && values[0] && values[0].match(/^[A-Z]{2}\d+/)) {
          const row = {};
          sectionHeaders.forEach((h, idx) => row[h] = values[idx] || '');
          row._statementDate = currentStatementDate;
          row._section = currentSection;
          records.push(row);
        }
      }
    }
    
    return records;
  };

  // Check if CSV is a multi-section life insurance statement
  const isLifeInsuranceStatement = (text) => {
    return text.includes('STATEMENT DATE :') && 
           (text.includes('Commission Detail') || text.includes('Advance Detail')) &&
           text.includes('Policy Number');
  };

  const parseCSV = (text) => {
    // Check if this is a multi-section life insurance statement
    if (isLifeInsuranceStatement(text)) {
      const records = parseLifeInsuranceStatement(text);
      if (records.length > 0) {
        const headers = Object.keys(records[0]);
        return { headers, data: records, isLifeStatement: true };
      }
    }
    
    // Standard CSV parsing
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { headers: [], data: [] };
    const headers = parseRow(lines[0]);
    const data = lines.slice(1).map(line => { const values = parseRow(line); const row = {}; headers.forEach((h, i) => row[h] = values[i] || ''); return row; });
    return { headers, data };
  };

  const analyzeWithAI = async (headers, sample, isLifeStatement = false) => {
    try {
      const prompt = isLifeStatement 
        ? `Map life insurance commission statement columns. Common mappings: "Policy Number" -> policyNumber, "Insured Name" -> clientName, "Comm. Total" or "Amount" -> amount, "Comm Type" -> commissionType, "Premium Applied Date" or "_statementDate" -> paymentDate, "Plan" -> policyType, "Writing Agent Name" -> agent. Return JSON only: {"paymentDate":"","clientName":"","policyNumber":"","policyType":"","commissionType":"","agent":"","amount":""}. Headers: ${headers.join(', ')}. Sample: ${JSON.stringify(sample)}`
        : `Map CSV columns. Return JSON only: {"paymentDate":"","clientName":"","policyNumber":"","policyType":"","commissionType":"","agent":"","amount":""}. Headers: ${headers.join(', ')}. Sample: ${JSON.stringify(sample)}`;
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await response.json();
      const text = data.content.find(c => c.type === 'text')?.text || '{}';
      return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) { return { paymentDate: '', clientName: '', policyNumber: '', policyType: '', commissionType: '', agent: '', amount: '' }; }
  };

  const parsePDF = async (file) => {
    setAiProgress('Loading PDF library...');
    const pdfjsLib = await new Promise((resolve, reject) => {
      if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; resolve(window.pdfjsLib); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    setAiProgress('Reading PDF...');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      setAiProgress(`Extracting page ${i} of ${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
    }
    return fullText;
  };

  const analyzePDFWithAI = async (pdfText, carrier) => {
    setAiProgress('AI analyzing PDF content...');
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, messages: [{ role: 'user', content: `Extract commission data from this ${carrier} commission statement PDF text. Return ONLY a JSON array of commission records with fields: paymentDate (YYYY-MM-DD), clientName, policyNumber, policyType, commissionType (Renewal/First Year/Initial/Monthly/Chargeback), agent, amount (negative for chargebacks). Look for tables and line items. Return ONLY valid JSON array. Example: [{"paymentDate":"2024-01-15","clientName":"JOHN DOE","policyNumber":"H1234567","policyType":"MAPD","commissionType":"Renewal","agent":"","amount":25.50}]\n\nPDF TEXT:\n${pdfText.substring(0, 15000)}` }] })
      });
      const data = await response.json();
      let text = data.content.find(c => c.type === 'text')?.text || '[]';
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) text = jsonMatch[0];
      const records = JSON.parse(text);
      return Array.isArray(records) ? records : [];
    } catch (e) { console.error('PDF AI analysis error:', e); return []; }
  };

  // Process a single file and return parsed data
  const processFile = async (file) => {
    return new Promise((resolve, reject) => {
      const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
      if (isPDF) {
        parsePDF(file).then(pdfText => {
          resolve({ type: 'pdf', fileName: file.name, text: pdfText, records: [] });
        }).catch(reject);
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const parsed = parseCSV(event.target.result);
            const { headers, data, isLifeStatement } = parsed;
            if (!headers.length || !data.length) { reject(new Error('Could not parse CSV')); return; }
            const mapping = await analyzeWithAI(headers, data[0], isLifeStatement);
            resolve({ 
              type: 'csv', 
              fileName: file.name, 
              rows: data, 
              headers,
              isLifeStatement: isLifeStatement || false,
              mapping,
              carrier: '',
              records: []
            });
          } catch (err) { reject(err); }
        };
        reader.readAsText(file);
      }
    });
  };

  const handleMultiUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setImportError(''); setPdfData(null); setCsvData(null); setImportPreview(null);
    setAiAnalyzing(true);
    setAiProgress(`Processing ${files.length} file(s)...`);
    
    const processed = [];
    for (let i = 0; i < files.length; i++) {
      setAiProgress(`Processing file ${i + 1} of ${files.length}: ${files[i].name}`);
      try {
        const result = await processFile(files[i]);
        processed.push(result);
      } catch (err) {
        processed.push({ type: 'error', fileName: files[i].name, error: err.message });
      }
    }
    
    setUploadQueue(processed);
    setCurrentFileIndex(0);
    setAiAnalyzing(false);
    setAiProgress(`${processed.length} file(s) ready for import`);
    e.target.value = '';
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError(''); setPdfData(null); setCsvData(null); setImportPreview(null); setUploadQueue([]);
    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (isPDF) {
      setAiAnalyzing(true);
      try {
        const pdfText = await parsePDF(file);
        setPdfData({ text: pdfText, fileName: file.name, records: [] });
        setAiProgress('PDF loaded. Select carrier and click "Analyze PDF" to extract commissions.');
        setAiAnalyzing(false);
      } catch (err) { setImportError('Could not parse PDF: ' + err.message); setAiAnalyzing(false); }
    } else {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = parseCSV(event.target.result);
          const { headers, data, isLifeStatement } = parsed;
          if (!headers.length || !data.length) { setImportError('Could not parse CSV'); return; }
          setCsvData({ rows: data, isLifeStatement: isLifeStatement || false }); 
          setAiAnalyzing(true);
          const mapping = await analyzeWithAI(headers, data[0], isLifeStatement);
          setColumnMapping(mapping); 
          setAiAnalyzing(false);
          if (isLifeStatement) {
            setAiProgress(`Detected life insurance statement with ${data.length} commission records`);
          }
        } catch (err) { setImportError(err.message); }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const normalizeText = (text) => text ? text.trim().toUpperCase().replace(/,/g, '').replace(/\s+/g, ' ') : '';

  // Helper to determine business type from carrier, commission type, or policy type
  const detectBusinessType = (carrier, commType, polType) => {
    if (medicareCarriers.includes(carrier)) return 'Medicare';
    if (acaCarriers.includes(carrier)) return 'ACA';
    if (lifeCarriers.includes(carrier)) return 'Life';
    // Check commission type for life indicators
    const ct = (commType || '').toLowerCase();
    if (ct.includes('advance') || ct.includes('life') || ct.includes('fyc') || ct.includes('trail')) return 'Life';
    // Check policy type for life indicators
    const pt = (polType || '').toLowerCase();
    if (pt.includes('term') || pt.includes('iul') || pt.includes('whole life') || pt.includes('universal') || pt.includes('addvantage') || pt.includes('builder')) return 'Life';
    return '';
  };

  const handleAnalyzePDF = async () => {
    if (!selectedCarrier) { alert('Please select a carrier first'); return; }
    setAiAnalyzing(true);
    const records = await analyzePDFWithAI(pdfData.text, selectedCarrier);
    const processed = records.map((record, i) => {
      const commType = (record.commissionType || '').trim();
      const polType = (record.policyType || '').trim();
      return {
        id: Date.now() + i, paymentDate: record.paymentDate || new Date().toISOString().split('T')[0],
        carrier: selectedCarrier, clientName: normalizeText(record.clientName || ''),
        policyNumber: (record.policyNumber || '').trim(), policyType: polType,
        commissionType: commType, agent: normalizeText(record.agent || ''),
        amount: parseFloat(String(record.amount || '0').replace(/[$,]/g, '')) || 0,
        businessType: detectBusinessType(selectedCarrier, commType, polType)
      };
    }).filter(item => item.amount !== 0);
    const withDuplicateFlags = checkForDuplicates(processed, commissions);
    const duplicateCount = withDuplicateFlags.filter(r => r.isDuplicate).length;
    setPdfData({ ...pdfData, records: withDuplicateFlags });
    setAiProgress(`Found ${records.length} records (${duplicateCount} duplicates)`);
    setAiAnalyzing(false);
  };

  const previewCSVImport = () => {
    if (!selectedCarrier || !columnMapping.amount) { alert('Select carrier and map amount'); return; }
    const rows = csvData.rows || csvData; // Handle both new and old structure
    const processed = rows.map((row, i) => {
      const commType = columnMapping.commissionType ? (row[columnMapping.commissionType] || '').trim() : '';
      const polType = columnMapping.policyType ? (row[columnMapping.policyType] || '').trim() : '';
      return {
        id: Date.now() + i, 
        paymentDate: columnMapping.paymentDate ? (row[columnMapping.paymentDate] || '').trim() : new Date().toISOString().split('T')[0],
        carrier: selectedCarrier, 
        clientName: columnMapping.clientName ? normalizeText(row[columnMapping.clientName]) : '',
        policyNumber: columnMapping.policyNumber ? (row[columnMapping.policyNumber] || '').trim() : '', 
        policyType: polType,
        commissionType: commType, 
        agent: columnMapping.agent ? normalizeText(row[columnMapping.agent]) : '',
        amount: parseFloat(((row[columnMapping.amount] || '0') + '').replace(/[$,]/g, '')) || 0,
        businessType: detectBusinessType(selectedCarrier, commType, polType)
      };
    }).filter(item => item.amount !== 0);
    const withDuplicateFlags = checkForDuplicates(processed, commissions);
    setImportPreview(withDuplicateFlags);
  };

  const doImport = async () => {
    const recordsToImport = importPreview.filter(r => !skipDuplicates || !r.isDuplicate);
    if (recordsToImport.length === 0) { alert('No records to import'); return; }
    const cleanRecords = recordsToImport.map(({ isDuplicate, duplicateType, ...rest }) => rest);
    await save([...commissions, ...cleanRecords], `Imported ${cleanRecords.length} records`);
    const skipped = importPreview.length - recordsToImport.length;
    setCsvData(null); setImportPreview(null);
    setColumnMapping({ paymentDate: '', clientName: '', policyNumber: '', policyType: '', commissionType: '', agent: '', amount: '' });
    setSelectedCarrier(''); setShowImport(false);
    alert(`Imported ${cleanRecords.length} records!${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}`);
  };

  const doImportPDF = async () => {
    if (!selectedCarrier) { alert('Select carrier first'); return; }
    if (!pdfData?.records?.length) { alert('No records found. Click "Analyze PDF" first.'); return; }
    const recordsToImport = pdfData.records.filter(r => !skipDuplicates || !r.isDuplicate);
    if (recordsToImport.length === 0) { alert('No records to import (all are duplicates)'); return; }
    const cleanRecords = recordsToImport.map(({ isDuplicate, duplicateType, ...rest }) => rest);
    await save([...commissions, ...cleanRecords], `Imported ${cleanRecords.length} records from PDF`);
    const skipped = pdfData.records.length - recordsToImport.length;
    setPdfData(null); setSelectedCarrier(''); setShowImport(false); setAiProgress('');
    alert(`Imported ${cleanRecords.length} records from PDF!${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}`);
  };

  const handleSubmit = async () => {
    if (!formData.carrier || !formData.amount) { alert('Carrier and amount required'); return; }
    const newRecord = { ...formData, id: Date.now(), amount: parseFloat(formData.amount), businessType: detectBusinessType(formData.carrier, formData.commissionType, formData.policyType) };
    const [checked] = checkForDuplicates([newRecord], commissions);
    if (checked.isDuplicate) { if (!confirm('This appears to be a duplicate entry. Import anyway?')) return; }
    await save([...commissions, newRecord], `Added record: ${formData.clientName || 'Unknown'} $${formData.amount}`);
    setFormData({ paymentDate: new Date().toISOString().split('T')[0], carrier: '', clientName: '', policyNumber: '', policyType: '', commissionType: '', agent: '', amount: '' });
    setShowForm(false);
  };

  const handleDelete = async (id) => { 
    const record = commissions.find(c => c.id === id);
    const updated = commissions.filter(c => c.id !== id); 
    await save(updated, `Deleted: ${record?.clientName || 'Unknown'} $${record?.amount?.toFixed(2) || '0'}`);
  };

  // Mass selection functions
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleMassDelete = async () => {
    const deleteCount = selectedIds.size;
    const deleteAmount = commissions.filter(c => selectedIds.has(c.id)).reduce((s, c) => s + c.amount, 0);
    const updated = commissions.filter(c => !selectedIds.has(c.id));
    await save(updated, `Deleted ${deleteCount} records ($${deleteAmount.toFixed(2)})`);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  const handleMassEdit = async () => {
    if (!massEditField || !massEditValue) return;
    const editCount = selectedIds.size;
    const updated = commissions.map(c => {
      if (selectedIds.has(c.id)) {
        const newRecord = { ...c, [massEditField]: massEditValue };
        // Re-detect business type if carrier changed
        if (massEditField === 'carrier') {
          newRecord.businessType = detectBusinessType(massEditValue, c.commissionType, c.policyType);
        }
        return newRecord;
      }
      return c;
    });
    await save(updated, `Updated ${editCount} records: ${massEditField} → ${massEditValue}`);
    setSelectedIds(new Set());
    setShowMassEdit(false);
    setMassEditField('');
    setMassEditValue('');
  };

  const exportCSV = () => {
    if (!commissions.length) return;
    const csv = ['Date,Carrier,Client,Policy,Type,CommType,Agent,Amount,BusinessType', ...commissions.map(c => `"${c.paymentDate}","${c.carrier}","${c.clientName}","${c.policyNumber}","${c.policyType}","${c.commissionType}","${c.agent}",${c.amount},"${c.businessType || ''}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `commissions_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const filteredByBusiness = businessType === 'all' ? commissions : commissions.filter(c => c.businessType === businessType);
  const filtered = filteredByBusiness.filter(c => {
    if (filters.searchTerm) { const s = filters.searchTerm.toLowerCase(); if (!(c.clientName?.toLowerCase().includes(s) || c.policyNumber?.toLowerCase().includes(s) || c.carrier?.toLowerCase().includes(s) || c.agent?.toLowerCase().includes(s))) return false; }
    if (filters.carrier && c.carrier !== filters.carrier) return false;
    if (filters.commissionType && c.commissionType !== filters.commissionType) return false;
    if (filters.agent && c.agent !== filters.agent) return false;
    if (filters.startDate && c.paymentDate < filters.startDate) return false;
    if (filters.endDate && c.paymentDate > filters.endDate) return false;
    return true;
  });

  const total = filteredByBusiness.reduce((s, c) => s + c.amount, 0);
  const positive = filteredByBusiness.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0);
  const negative = filteredByBusiness.filter(c => c.amount < 0).reduce((s, c) => s + c.amount, 0);
  const filteredTotal = filtered.reduce((s, c) => s + c.amount, 0);
  const filteredPositive = filtered.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0);
  const filteredNegative = filtered.filter(c => c.amount < 0).reduce((s, c) => s + c.amount, 0);
  const uniqueCarriers = [...new Set(filteredByBusiness.map(c => c.carrier))].filter(Boolean).sort();
  const uniqueCommTypes = [...new Set(filteredByBusiness.map(c => c.commissionType))].filter(Boolean).sort();
  const uniqueAgents = [...new Set(filteredByBusiness.map(c => c.agent))].filter(Boolean).sort();
  const hasFilters = filters.searchTerm || filters.carrier || filters.commissionType || filters.agent || filters.startDate || filters.endDate;
  const csvRows = csvData?.rows || csvData || [];
  const cols = csvRows.length > 0 ? Object.keys(csvRows[0]) : [];

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"><DollarSign className="w-16 h-16 animate-pulse text-indigo-600" /></div>;
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3"><DollarSign className="w-8 h-8 text-indigo-600" /><h1 className="text-3xl font-bold">Commission Tracker</h1></div>
            <div className="flex gap-2 items-center flex-wrap">
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="px-3 py-2 border rounded-lg bg-gray-100 font-semibold">
                <option value="all">All Business</option><option value="Medicare">Medicare</option><option value="ACA">ACA</option><option value="Life">Life Insurance</option>
              </select>
              <span onClick={() => setCurrentPage('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold cursor-pointer ${currentPage === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}><BarChart3 className="w-5 h-5" /> Dashboard</span>
              <span onClick={() => setCurrentPage('commissions')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold cursor-pointer ${currentPage === 'commissions' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}><List className="w-5 h-5" /> Commissions</span>
              <span onClick={() => setCurrentPage('policies')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold cursor-pointer ${currentPage === 'policies' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}><Briefcase className="w-5 h-5" /> Policies</span>
              <span onClick={() => setCurrentPage('reports')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold cursor-pointer ${currentPage === 'reports' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}><FileText className="w-5 h-5" /> Reports</span>
            </div>
          </div>

          {/* Undo Banner */}
          {undoMessage && (
            <div className="bg-gray-800 text-white px-4 py-3 rounded-lg mb-4 flex items-center justify-between animate-pulse">
              <span>✓ {undoMessage}</span>
              <button onClick={handleUndo} className="flex items-center gap-2 bg-white text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-100 font-semibold">
                <Undo2 className="w-4 h-4" /> Undo
              </button>
            </div>
          )}

          {currentPage === 'dashboard' ? (
            <div className="py-4">
              {/* Summary Cards Row */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border-2 border-green-200">
                  <h3 className="text-sm font-semibold text-green-800 mb-1">Total Earned</h3>
                  <p className="text-3xl font-bold text-green-700">${total.toFixed(2)}</p>
                  <p className="text-xs text-green-600 mt-1">{commissions.length} transactions</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-800 mb-1">Active Policies</h3>
                  <p className="text-3xl font-bold text-blue-700">{policies.length}</p>
                  <p className="text-xs text-blue-600 mt-1">{policyStats.healthy} healthy</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-5 rounded-xl border-2 border-yellow-200">
                  <h3 className="text-sm font-semibold text-yellow-800 mb-1">At Risk</h3>
                  <p className="text-3xl font-bold text-yellow-700">{policies.filter(p => p.status === 'at-risk').length}</p>
                  <p className="text-xs text-yellow-600 mt-1">Policies with chargebacks</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-5 rounded-xl border-2 border-red-200">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">Total Chargebacks</h3>
                  <p className="text-3xl font-bold text-red-700">${Math.abs(negative).toFixed(2)}</p>
                  <p className="text-xs text-red-600 mt-1">{commissions.filter(c => c.amount < 0).length} transactions</p>
                </div>
              </div>

              {/* Line of Business Breakdown */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {['Medicare', 'ACA', 'Life'].map(lob => {
                  const lobCommissions = commissions.filter(c => c.businessType === lob);
                  const lobTotal = lobCommissions.reduce((s, c) => s + c.amount, 0);
                  const lobPolicies = policies.filter(p => p.businessType === lob);
                  const colors = lob === 'Medicare' ? 'from-blue-500 to-blue-600' : lob === 'ACA' ? 'from-green-500 to-green-600' : 'from-purple-500 to-purple-600';
                  return (
                    <div key={lob} className={`bg-gradient-to-br ${colors} p-5 rounded-xl text-white cursor-pointer hover:shadow-lg transition-shadow`} onClick={() => { setBusinessType(lob); setCurrentPage('commissions'); }}>
                      <h3 className="text-sm font-semibold opacity-90">{lob}</h3>
                      <p className="text-2xl font-bold mt-1">${lobTotal.toFixed(2)}</p>
                      <p className="text-xs opacity-80 mt-1">{lobPolicies.length} policies • {lobCommissions.length} transactions</p>
                    </div>
                  );
                })}
              </div>

              {/* Two Column Layout - Row 1 */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* This Month */}
                <div className="bg-white p-5 rounded-xl border-2">
                  <h3 className="text-lg font-bold mb-4">This Month</h3>
                  {(() => {
                    const now = new Date();
                    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    const thisMonthComms = commissions.filter(c => c.paymentDate?.startsWith(thisMonth));
                    const thisMonthTotal = thisMonthComms.reduce((s, c) => s + c.amount, 0);
                    const thisMonthPositive = thisMonthComms.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0);
                    const thisMonthNegative = thisMonthComms.filter(c => c.amount < 0).reduce((s, c) => s + c.amount, 0);
                    return (
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-600">Commissions</span>
                          <span className="text-green-600 font-bold">${thisMonthPositive.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-600">Chargebacks</span>
                          <span className="text-red-600 font-bold">${Math.abs(thisMonthNegative).toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-3 flex justify-between items-center">
                          <span className="font-semibold">Net</span>
                          <span className={`text-xl font-bold ${thisMonthTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>${thisMonthTotal.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{thisMonthComms.length} transactions</p>
                      </div>
                    );
                  })()}
                </div>

                {/* YTD vs Last Year */}
                <div className="bg-white p-5 rounded-xl border-2">
                  <h3 className="text-lg font-bold mb-4">Year-to-Date vs Last Year</h3>
                  {(() => {
                    const now = new Date();
                    const thisYear = now.getFullYear();
                    const lastYear = thisYear - 1;
                    const currentDayOfYear = Math.floor((now - new Date(thisYear, 0, 0)) / (1000 * 60 * 60 * 24));
                    
                    // This year YTD
                    const ytdComms = commissions.filter(c => c.paymentDate?.startsWith(String(thisYear)));
                    const ytdTotal = ytdComms.reduce((s, c) => s + c.amount, 0);
                    
                    // Last year same period
                    const lastYearStart = `${lastYear}-01-01`;
                    const lastYearSameDayDate = new Date(lastYear, 0, currentDayOfYear);
                    const lastYearEnd = lastYearSameDayDate.toISOString().split('T')[0];
                    const lastYearComms = commissions.filter(c => {
                      if (!c.paymentDate) return false;
                      return c.paymentDate >= lastYearStart && c.paymentDate <= lastYearEnd;
                    });
                    const lastYearTotal = lastYearComms.reduce((s, c) => s + c.amount, 0);
                    
                    // Last year full
                    const lastYearFullComms = commissions.filter(c => c.paymentDate?.startsWith(String(lastYear)));
                    const lastYearFullTotal = lastYearFullComms.reduce((s, c) => s + c.amount, 0);
                    
                    const diff = ytdTotal - lastYearTotal;
                    const pctChange = lastYearTotal !== 0 ? ((diff / lastYearTotal) * 100) : 0;
                    
                    return (
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-600">{thisYear} YTD</span>
                          <span className="text-green-600 font-bold text-lg">${ytdTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-600">{lastYear} Same Period</span>
                          <span className="text-gray-700 font-bold">${lastYearTotal.toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-3 flex justify-between items-center">
                          <span className="font-semibold">Difference</span>
                          <span className={`text-lg font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {diff >= 0 ? '+' : ''}${diff.toFixed(2)} ({pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%)
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{lastYear} full year: ${lastYearFullTotal.toFixed(2)}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Two Column Layout - Row 2 */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Top Clients */}
                <div className="bg-white p-5 rounded-xl border-2">
                  <h3 className="text-lg font-bold mb-4">Top 5 Clients</h3>
                  <div className="space-y-3">
                    {(() => {
                      const clientTotals = {};
                      commissions.forEach(c => {
                        if (!c.clientName) return;
                        if (!clientTotals[c.clientName]) clientTotals[c.clientName] = { total: 0, carrier: c.carrier, businessType: c.businessType };
                        clientTotals[c.clientName].total += c.amount;
                      });
                      const topClients = Object.entries(clientTotals)
                        .sort((a, b) => b[1].total - a[1].total)
                        .slice(0, 5);
                      
                      if (topClients.length === 0) return <p className="text-gray-500 text-sm">No clients yet</p>;
                      
                      const maxTotal = topClients[0]?.[1].total || 1;
                      
                      return topClients.map(([name, data], i) => (
                        <div key={name} className="flex items-center gap-3">
                          <span className="text-gray-400 font-bold w-5">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium text-sm truncate" style={{maxWidth: '150px'}}>{name}</span>
                              <span className="text-green-600 font-bold">${data.total.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className={`h-2 rounded-full ${data.businessType === 'Medicare' ? 'bg-blue-500' : data.businessType === 'ACA' ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${(data.total / maxTotal) * 100}%` }}></div>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white p-5 rounded-xl border-2">
                  <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {commissions.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)).slice(0, 5).map((c, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{c.clientName || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{c.paymentDate} • {c.carrier}</p>
                        </div>
                        <span className={`font-bold ${c.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {c.amount >= 0 ? '+' : ''}${c.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {commissions.length === 0 && <p className="text-gray-500 text-sm">No transactions yet</p>}
                  </div>
                </div>
              </div>

              {/* Monthly Trend Chart */}
              <div className="bg-white p-5 rounded-xl border-2 mb-6">
                <h3 className="text-lg font-bold mb-4">Monthly Trend</h3>
                {(() => {
                  const monthly = {};
                  commissions.forEach(c => {
                    const month = c.paymentDate?.substring(0, 7) || 'Unknown';
                    if (!monthly[month]) monthly[month] = { positive: 0, negative: 0 };
                    if (c.amount >= 0) monthly[month].positive += c.amount;
                    else monthly[month].negative += Math.abs(c.amount);
                  });
                  const sortedMonths = Object.keys(monthly).sort().slice(-6);
                  const maxVal = Math.max(...sortedMonths.map(m => monthly[m].positive), 1);
                  return (
                    <div className="flex items-end gap-3 h-40">
                      {sortedMonths.map(month => (
                        <div key={month} className="flex-1 flex flex-col items-center">
                          <span className="text-xs font-semibold text-green-600 mb-1">${monthly[month].positive.toFixed(0)}</span>
                          <div className="w-full bg-green-500 rounded-t" style={{ height: `${monthly[month].positive / maxVal * 120}px` }}></div>
                          {monthly[month].negative > 0 && (
                            <div className="w-full bg-red-400 rounded-b" style={{ height: `${monthly[month].negative / maxVal * 120}px` }}></div>
                          )}
                          <span className="text-xs mt-2 text-gray-600">{month.substring(5)}/{month.substring(2, 4)}</span>
                        </div>
                      ))}
                      {sortedMonths.length === 0 && <p className="text-gray-500 text-sm w-full text-center">No data yet</p>}
                    </div>
                  );
                })()}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-4 gap-4">
                <div onClick={() => setCurrentPage('commissions')} className="bg-gray-50 p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-100 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold text-sm">Import Statement</p>
                </div>
                <div onClick={() => setCurrentPage('policies')} className="bg-gray-50 p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-100 text-center">
                  <Briefcase className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <p className="font-semibold text-sm">View Policies</p>
                </div>
                <div onClick={() => { setPolicyFilter('at-risk'); setCurrentPage('policies'); }} className="bg-gray-50 p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-100 text-center">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                  <p className="font-semibold text-sm">At Risk Policies</p>
                </div>
                <div onClick={() => setCurrentPage('reports')} className="bg-gray-50 p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-100 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <p className="font-semibold text-sm">Run Reports</p>
                </div>
              </div>
            </div>
          ) : currentPage === 'commissions' ? (
            <div>
              <div className="flex gap-2 mb-6 flex-wrap">
                <span onClick={() => setShowImport(!showImport)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 cursor-pointer"><Upload className="w-5 h-5" /> Import</span>
                <span onClick={exportCSV} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer"><Download className="w-5 h-5" /> Export</span>
                <span onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 cursor-pointer"><Plus className="w-5 h-5" /> Add</span>
                <span onClick={async () => { 
                  const cleaned = commissions.map(c => {
                    // Determine business type from carrier OR commission type
                    let bizType = c.businessType || '';
                    if (medicareCarriers.includes(c.carrier)) bizType = 'Medicare';
                    else if (acaCarriers.includes(c.carrier)) bizType = 'ACA';
                    else if (lifeCarriers.includes(c.carrier)) bizType = 'Life';
                    else if (c.commissionType && (c.commissionType.toLowerCase().includes('advance') || c.commissionType.toLowerCase().includes('life') || c.commissionType.toLowerCase().includes('fyc') || c.commissionType.toLowerCase().includes('term') || c.commissionType.toLowerCase().includes('iul'))) bizType = 'Life';
                    else if (c.policyType && (c.policyType.toLowerCase().includes('term') || c.policyType.toLowerCase().includes('iul') || c.policyType.toLowerCase().includes('whole life') || c.policyType.toLowerCase().includes('universal'))) bizType = 'Life';
                    return { ...c, clientName: normalizeText(c.clientName), agent: normalizeText(c.agent), businessType: bizType };
                  }); 
                  await save(cleaned, 'Cleaned data and fixed business types');
                }} className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 cursor-pointer">Clean & Fix Types</span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border"><h3 className="text-sm font-semibold text-blue-800">{hasFilters ? 'Filtered Net' : 'Total Net'}</h3><p className={`text-2xl font-bold ${(hasFilters ? filteredTotal : total) >= 0 ? 'text-green-700' : 'text-red-700'}`}>${(hasFilters ? filteredTotal : total).toFixed(2)}</p>{hasFilters && <p className="text-xs text-gray-600">of ${total.toFixed(2)}</p>}</div>
                <div className="bg-green-50 p-4 rounded-lg border"><h3 className="text-sm font-semibold text-green-800">{hasFilters ? 'Filtered' : 'Total'} Commissions</h3><p className="text-2xl font-bold text-green-700">${(hasFilters ? filteredPositive : positive).toFixed(2)}</p>{hasFilters && <p className="text-xs text-gray-600">of ${positive.toFixed(2)}</p>}</div>
                <div className="bg-red-50 p-4 rounded-lg border"><h3 className="text-sm font-semibold text-red-800">{hasFilters ? 'Filtered' : 'Total'} Chargebacks</h3><p className="text-2xl font-bold text-red-700">${Math.abs(hasFilters ? filteredNegative : negative).toFixed(2)}</p>{hasFilters && <p className="text-xs text-gray-600">of ${Math.abs(negative).toFixed(2)}</p>}</div>
              </div>

              {showImport && !csvData && !pdfData && uploadQueue.length === 0 && (
                <div className="bg-green-50 p-6 rounded-lg mb-6 border-2 border-green-200">
                  <div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">Import Commission Statement</h3><button onClick={() => setShowImport(false)}><X className="w-5 h-5" /></button></div>
                  {importError && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{importError}</div>}
                  <p className="text-sm text-gray-600 mb-4">Upload commission statements. Duplicate detection will flag records that already exist.</p>
                  <div className="grid grid-cols-3 gap-4">
                    <label className="flex flex-col items-center justify-center gap-2 bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 cursor-pointer"><FileSpreadsheet className="w-8 h-8" /><span className="font-semibold">Single CSV</span><span className="text-xs opacity-80">One file</span><input type="file" accept=".csv" onChange={handleUpload} className="hidden" /></label>
                    <label className="flex flex-col items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 cursor-pointer"><Upload className="w-8 h-8" /><span className="font-semibold">Multiple Files</span><span className="text-xs opacity-80">Batch import CSVs</span><input type="file" accept=".csv" multiple onChange={handleMultiUpload} className="hidden" /></label>
                    <label className="flex flex-col items-center justify-center gap-2 bg-red-600 text-white px-6 py-4 rounded-lg hover:bg-red-700 cursor-pointer"><FileText className="w-8 h-8" /><span className="font-semibold">PDF Statement</span><span className="text-xs opacity-80">AI extraction</span><input type="file" accept=".pdf" onChange={handleUpload} className="hidden" /></label>
                  </div>
                </div>
              )}

              {/* Multi-file upload queue */}
              {uploadQueue.length > 0 && (
                <div className="bg-blue-50 p-6 rounded-lg mb-6 border-2 border-blue-200">
                  <div className="flex justify-between mb-4">
                    <h3 className="text-lg font-semibold">Batch Import ({uploadQueue.length} files)</h3>
                    <button onClick={() => { setUploadQueue([]); setCurrentFileIndex(0); }}><X className="w-5 h-5" /></button>
                  </div>
                  
                  {/* File list */}
                  <div className="mb-4 space-y-2">
                    {uploadQueue.map((file, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${idx === currentFileIndex ? 'bg-blue-100 border-2 border-blue-400' : file.carrier ? 'bg-green-100' : 'bg-white border'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${file.carrier ? 'bg-green-500 text-white' : idx === currentFileIndex ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
                            {file.carrier ? '✓' : idx + 1}
                          </span>
                          <div>
                            <p className="font-medium text-sm">{file.fileName}</p>
                            <p className="text-xs text-gray-500">{file.type === 'csv' ? `${file.rows?.length || 0} rows` : file.type === 'error' ? file.error : 'PDF'} {file.carrier && `• ${file.carrier}`}</p>
                          </div>
                        </div>
                        {idx === currentFileIndex && !file.carrier && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Current</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Current file mapping */}
                  {uploadQueue[currentFileIndex] && !uploadQueue[currentFileIndex].carrier && uploadQueue[currentFileIndex].type === 'csv' && (
                    <div className="bg-white p-4 rounded-lg border-2 mb-4">
                      <h4 className="font-semibold mb-3">Map: {uploadQueue[currentFileIndex].fileName}</h4>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-sm font-semibold mb-1">Carrier *</label>
                          <select 
                            value={uploadQueue[currentFileIndex].selectedCarrier || ''} 
                            onChange={(e) => {
                              const newQueue = [...uploadQueue];
                              newQueue[currentFileIndex].selectedCarrier = e.target.value;
                              setUploadQueue(newQueue);
                            }} 
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="">-- Select --</option>
                            <optgroup label="Medicare">{medicareCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                            <optgroup label="ACA">{acaCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                            <optgroup label="Life">{lifeCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        {[['Amount *', 'amount'], ['Payment Date', 'paymentDate'], ['Client Name', 'clientName'], ['Policy Number', 'policyNumber'], ['Commission Type', 'commissionType']].map(([label, key]) => (
                          <div key={key}>
                            <label className="text-sm font-semibold">{label}</label>
                            <select 
                              value={uploadQueue[currentFileIndex].mapping?.[key] || ''} 
                              onChange={(e) => {
                                const newQueue = [...uploadQueue];
                                newQueue[currentFileIndex].mapping = { ...newQueue[currentFileIndex].mapping, [key]: e.target.value };
                                setUploadQueue(newQueue);
                              }} 
                              className="w-full px-3 py-2 border rounded-lg"
                            >
                              <option value="">-- Select --</option>
                              {uploadQueue[currentFileIndex].headers?.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => {
                          const file = uploadQueue[currentFileIndex];
                          if (!file.selectedCarrier || !file.mapping?.amount) { alert('Select carrier and amount column'); return; }
                          
                          // Process records for this file
                          const records = file.rows.map((row, i) => {
                            const commType = file.mapping.commissionType ? (row[file.mapping.commissionType] || '').trim() : '';
                            const polType = file.mapping.policyType ? (row[file.mapping.policyType] || '').trim() : '';
                            return {
                              id: Date.now() + i + (currentFileIndex * 10000),
                              paymentDate: file.mapping.paymentDate ? (row[file.mapping.paymentDate] || '').trim() : new Date().toISOString().split('T')[0],
                              carrier: file.selectedCarrier,
                              clientName: file.mapping.clientName ? normalizeText(row[file.mapping.clientName]) : '',
                              policyNumber: file.mapping.policyNumber ? (row[file.mapping.policyNumber] || '').trim() : '',
                              policyType: polType,
                              commissionType: commType,
                              agent: file.mapping.agent ? normalizeText(row[file.mapping.agent]) : '',
                              amount: parseFloat(((row[file.mapping.amount] || '0') + '').replace(/[$,]/g, '')) || 0,
                              businessType: detectBusinessType(file.selectedCarrier, commType, polType)
                            };
                          }).filter(r => r.amount !== 0);
                          
                          const newQueue = [...uploadQueue];
                          newQueue[currentFileIndex].carrier = file.selectedCarrier;
                          newQueue[currentFileIndex].records = records;
                          setUploadQueue(newQueue);
                          
                          // Move to next unmapped file
                          const nextUnmapped = newQueue.findIndex((f, i) => i > currentFileIndex && !f.carrier && f.type === 'csv');
                          if (nextUnmapped !== -1) {
                            setCurrentFileIndex(nextUnmapped);
                          }
                        }}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                      >
                        Confirm Mapping & Next
                      </button>
                    </div>
                  )}

                  {/* Import all button */}
                  {uploadQueue.every(f => f.carrier || f.type === 'error') && (
                    <div className="bg-green-100 p-4 rounded-lg border-2 border-green-400">
                      <p className="text-green-800 font-semibold mb-3">
                        ✓ All files mapped! Ready to import {uploadQueue.filter(f => f.records).reduce((sum, f) => sum + f.records.length, 0)} total records.
                      </p>
                      <button 
                        onClick={async () => {
                          const allRecords = uploadQueue.flatMap(f => f.records || []);
                          const withDuplicateFlags = checkForDuplicates(allRecords, commissions);
                          const toImport = skipDuplicates ? withDuplicateFlags.filter(r => !r.isDuplicate) : withDuplicateFlags;
                          const cleanRecords = toImport.map(({ isDuplicate, duplicateType, ...rest }) => rest);
                          const fileCount = uploadQueue.filter(f => f.records).length;
                          await save([...commissions, ...cleanRecords], `Imported ${cleanRecords.length} records from ${fileCount} files`);
                          setUploadQueue([]);
                          setCurrentFileIndex(0);
                          setShowImport(false);
                          alert(`Imported ${cleanRecords.length} records from ${fileCount} files!`);
                        }}
                        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                      >
                        Import All Records
                      </button>
                    </div>
                  )}
                </div>
              )}

              {pdfData && (
                <div className="bg-red-50 p-6 rounded-lg mb-6 border-2 border-red-200">
                  <div className="flex justify-between mb-4">
                    <div><h3 className="text-lg font-semibold">📄 PDF Import: {pdfData.fileName}</h3>{aiAnalyzing ? <p className="text-sm text-blue-600">🤖 {aiProgress}</p> : <p className="text-sm text-green-600">✓ {aiProgress || 'Ready'}</p>}</div>
                    <button onClick={() => { setPdfData(null); setAiProgress(''); }}><X className="w-5 h-5" /></button>
                  </div>
                  <div className="mb-4 bg-white p-4 rounded-lg border-2">
                    <label className="block text-sm font-semibold mb-2">Carrier *</label>
                    <select value={selectedCarrier} onChange={(e) => setSelectedCarrier(e.target.value)} className="w-full px-3 py-2 border-2 rounded-lg">
                      <option value="">-- Select Carrier --</option>
                      <optgroup label="Medicare Carriers">{medicareCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                      <optgroup label="ACA Carriers">{acaCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                      <optgroup label="Life Insurance Carriers">{lifeCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {!pdfData.records?.length ? (
                    <button onClick={handleAnalyzePDF} disabled={aiAnalyzing || !selectedCarrier} className={`w-full py-3 rounded-lg font-semibold ${aiAnalyzing || !selectedCarrier ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>{aiAnalyzing ? '🤖 Analyzing...' : '🔍 Analyze PDF with AI'}</button>
                  ) : (
                    <div>
                      {pdfData.records.some(r => r.isDuplicate) && (
                        <div className="mb-4 p-3 bg-yellow-100 border-2 border-yellow-400 rounded-lg flex items-center gap-3">
                          <AlertTriangle className="w-6 h-6 text-yellow-600" />
                          <div className="flex-1"><p className="font-semibold text-yellow-800">{pdfData.records.filter(r => r.isDuplicate).length} duplicate(s) detected</p></div>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} className="w-4 h-4" /><span className="text-sm font-medium">Skip duplicates</span></label>
                        </div>
                      )}
                      <div className="mb-4 max-h-64 overflow-auto bg-white rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 sticky top-0"><tr><th className="px-2 py-2 text-left">Status</th><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Client</th><th className="px-2 py-2 text-left">Policy #</th><th className="px-2 py-2 text-left">Amount</th></tr></thead>
                          <tbody>{pdfData.records.map((r, i) => (
                            <tr key={i} className={`border-b ${r.isDuplicate ? 'bg-yellow-50' : ''}`}>
                              <td className="px-2 py-1">{r.isDuplicate ? <span className="text-yellow-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /></span> : <span className="text-green-600"><CheckCircle className="w-4 h-4" /></span>}</td>
                              <td className="px-2 py-1">{r.paymentDate}</td><td className="px-2 py-1">{r.clientName}</td><td className="px-2 py-1">{r.policyNumber}</td>
                              <td className={`px-2 py-1 font-bold ${r.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>${r.amount.toFixed(2)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleAnalyzePDF} disabled={aiAnalyzing} className="flex-1 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Re-analyze</button>
                        <button onClick={doImportPDF} className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">Import {skipDuplicates ? pdfData.records.filter(r => !r.isDuplicate).length : pdfData.records.length} Records</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {csvData && !importPreview && (
                <div className="bg-blue-50 p-6 rounded-lg mb-6 border-2">
                  <div className="flex justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Map Columns ({csvRows.length} rows)</h3>
                      {csvData.isLifeStatement && <p className="text-sm text-purple-600">📋 Life Insurance Statement Detected</p>}
                      {aiAnalyzing ? <p className="text-sm text-blue-600">🤖 AI analyzing...</p> : <p className="text-sm text-green-600">✓ Ready</p>}
                    </div>
                    <button onClick={() => setCsvData(null)}><X className="w-5 h-5" /></button>
                  </div>
                  <div className="mb-4 bg-white p-4 rounded-lg border-2">
                    <label className="block text-sm font-semibold mb-2">Carrier *</label>
                    <select value={selectedCarrier} onChange={(e) => {
                      const carrier = e.target.value;
                      setSelectedCarrier(carrier);
                      // Load saved mapping for this carrier if exists
                      if (carrier && savedMappings[carrier]) {
                        setColumnMapping(savedMappings[carrier]);
                      }
                    }} className="w-full px-3 py-2 border-2 rounded-lg">
                      <option value="">-- Select Carrier --</option>
                      <optgroup label="Medicare Carriers">{medicareCarriers.map(c => <option key={c} value={c}>{c} {savedMappings[c] ? '✓' : ''}</option>)}</optgroup>
                      <optgroup label="ACA Carriers">{acaCarriers.map(c => <option key={c} value={c}>{c} {savedMappings[c] ? '✓' : ''}</option>)}</optgroup>
                      <optgroup label="Life Insurance Carriers">{lifeCarriers.map(c => <option key={c} value={c}>{c} {savedMappings[c] ? '✓' : ''}</option>)}</optgroup>
                      <option value="Other">Other {savedMappings['Other'] ? '✓' : ''}</option>
                    </select>
                    {selectedCarrier && savedMappings[selectedCarrier] && (
                      <p className="text-xs text-green-600 mt-1">✓ Loaded saved mapping for {selectedCarrier}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[['Amount *', 'amount'], ['Payment Date', 'paymentDate'], ['Client Name', 'clientName'], ['Policy Number', 'policyNumber'], ['Policy Type', 'policyType'], ['Commission Type', 'commissionType'], ['Agent', 'agent']].map(([label, key]) => (
                      <div key={key}><label className="text-sm font-semibold">{label}</label><select value={columnMapping[key]} onChange={(e) => setColumnMapping({...columnMapping, [key]: e.target.value})} className="w-full px-3 py-2 border rounded-lg"><option value="">-- Select --</option>{cols.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (!selectedCarrier) { alert('Select a carrier first'); return; }
                      const newMappings = { ...savedMappings, [selectedCarrier]: columnMapping };
                      setSavedMappings(newMappings);
                      localStorage.setItem('carrier-column-mappings', JSON.stringify(newMappings));
                      alert(`Mapping saved for ${selectedCarrier}! Next time you select this carrier, columns will auto-fill.`);
                    }} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                      💾 Save Mapping for {selectedCarrier || 'Carrier'}
                    </button>
                    <button onClick={previewCSVImport} className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold">Preview Import & Check Duplicates</button>
                  </div>
                </div>
              )}

              {importPreview && (
                <div className="bg-blue-50 p-6 rounded-lg mb-6 border-2">
                  <div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">Import Preview ({importPreview.length} records)</h3><button onClick={() => { setImportPreview(null); setCsvData(null); }}><X className="w-5 h-5" /></button></div>
                  {importPreview.some(r => r.isDuplicate) && (
                    <div className="mb-4 p-3 bg-yellow-100 border-2 border-yellow-400 rounded-lg flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                      <div className="flex-1"><p className="font-semibold text-yellow-800">{importPreview.filter(r => r.isDuplicate).length} duplicate(s) detected</p></div>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} className="w-4 h-4" /><span className="text-sm font-medium">Skip duplicates</span></label>
                    </div>
                  )}
                  <div className="mb-4 max-h-64 overflow-auto bg-white rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0"><tr><th className="px-2 py-2 text-left">Status</th><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Client</th><th className="px-2 py-2 text-left">Policy #</th><th className="px-2 py-2 text-left">Amount</th></tr></thead>
                      <tbody>{importPreview.map((r, i) => (
                        <tr key={i} className={`border-b ${r.isDuplicate ? 'bg-yellow-50' : ''}`}>
                          <td className="px-2 py-1">{r.isDuplicate ? <span className="text-yellow-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /></span> : <span className="text-green-600"><CheckCircle className="w-4 h-4" /></span>}</td>
                          <td className="px-2 py-1">{r.paymentDate}</td><td className="px-2 py-1">{r.clientName}</td><td className="px-2 py-1">{r.policyNumber}</td>
                          <td className={`px-2 py-1 font-bold ${r.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>${r.amount.toFixed(2)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setImportPreview(null)} className="flex-1 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Back to Mapping</button>
                    <button onClick={doImport} className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">Import {skipDuplicates ? importPreview.filter(r => !r.isDuplicate).length : importPreview.length} Records</button>
                  </div>
                </div>
              )}

              {showForm && (
                <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
                  <h3 className="text-lg font-semibold mb-4">Add Commission</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={formData.paymentDate} onChange={(e) => setFormData({...formData, paymentDate: e.target.value})} className="px-3 py-2 border rounded-lg" />
                    <select value={formData.carrier} onChange={(e) => setFormData({...formData, carrier: e.target.value})} className="px-3 py-2 border rounded-lg"><option value="">-- Carrier --</option><optgroup label="Medicare">{medicareCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup><optgroup label="ACA">{acaCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup><optgroup label="Life Insurance">{lifeCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup><option value="Other">Other</option></select>
                    <input placeholder="Client" value={formData.clientName} onChange={(e) => setFormData({...formData, clientName: e.target.value})} className="px-3 py-2 border rounded-lg" />
                    <input placeholder="Policy #" value={formData.policyNumber} onChange={(e) => setFormData({...formData, policyNumber: e.target.value})} className="px-3 py-2 border rounded-lg" />
                    <input placeholder="Type" value={formData.policyType} onChange={(e) => setFormData({...formData, policyType: e.target.value})} className="px-3 py-2 border rounded-lg" />
                    <select value={formData.commissionType} onChange={(e) => setFormData({...formData, commissionType: e.target.value})} className="px-3 py-2 border rounded-lg"><option value="">-- Comm Type --</option>{commissionTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                    <input placeholder="Agent" value={formData.agent} onChange={(e) => setFormData({...formData, agent: e.target.value})} className="px-3 py-2 border rounded-lg" />
                    <input type="number" step="0.01" placeholder="Amount" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="px-3 py-2 border rounded-lg" />
                  </div>
                  <button onClick={handleSubmit} className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-lg">Add</button>
                </div>
              )}
            </div>
          ) : currentPage === 'policies' ? (
            <div className="py-4">
              <h2 className="text-2xl font-bold mb-6">Policy Analysis & Chargeback Matching</h2>
              
              {/* Policy Stats Overview */}
              <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border-2 cursor-pointer hover:shadow-md" onClick={() => setPolicyFilter('all')}>
                  <h3 className="text-sm font-semibold text-blue-800">Total Policies</h3>
                  <p className="text-3xl font-bold text-blue-700">{policyStats.total}</p>
                  <p className="text-xs text-blue-600">All tracked policies</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-2 cursor-pointer hover:shadow-md" onClick={() => setPolicyFilter('healthy')}>
                  <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-600" /><h3 className="text-sm font-semibold text-green-800">Healthy</h3></div>
                  <p className="text-3xl font-bold text-green-700">{policyStats.healthy}</p>
                  <p className="text-xs text-green-600">No chargebacks</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border-2 cursor-pointer hover:shadow-md" onClick={() => setPolicyFilter('at-risk')}>
                  <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-yellow-600" /><h3 className="text-sm font-semibold text-yellow-800">At Risk</h3></div>
                  <p className="text-3xl font-bold text-yellow-700">{policyStats.atRisk}</p>
                  <p className="text-xs text-yellow-600">Has chargebacks, still profitable</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border-2 cursor-pointer hover:shadow-md" onClick={() => setPolicyFilter('churned')}>
                  <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-600" /><h3 className="text-sm font-semibold text-red-800">Churned</h3></div>
                  <p className="text-3xl font-bold text-red-700">{policyStats.churned}</p>
                  <p className="text-xs text-red-600">Net loss (fully charged back)</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border-2">
                  <h3 className="text-sm font-semibold text-purple-800">Chargeback Rate</h3>
                  <p className="text-3xl font-bold text-purple-700">{policyStats.chargebackRate.toFixed(1)}%</p>
                  <p className="text-xs text-purple-600">${policyStats.totalChargebacks.toFixed(2)} total</p>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="bg-gray-50 p-4 rounded-lg border-2 mb-6">
                <div className="mb-3">
                  <input 
                    type="text" 
                    placeholder="🔍 Search client name or policy number..." 
                    value={policySearchTerm} 
                    onChange={(e) => setPolicySearchTerm(e.target.value)} 
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none" 
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-700">Line of Business:</label>
                    <select value={policyBusinessFilter} onChange={(e) => setPolicyBusinessFilter(e.target.value)} className="px-3 py-2 border rounded-lg bg-white">
                      <option value="all">All</option>
                      <option value="Medicare">Medicare</option>
                      <option value="ACA">ACA</option>
                      <option value="Life">Life Insurance</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-700">Carrier:</label>
                    <select value={policyCarrierFilter} onChange={(e) => setPolicyCarrierFilter(e.target.value)} className="px-3 py-2 border rounded-lg bg-white min-w-[180px]">
                      <option value="all">All Carriers</option>
                      <optgroup label="Medicare Carriers">
                        {policyCarriers.filter(c => medicareCarriers.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                      <optgroup label="ACA Carriers">
                        {policyCarriers.filter(c => acaCarriers.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                      <optgroup label="Life Insurance Carriers">
                        {policyCarriers.filter(c => lifeCarriers.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                      {policyCarriers.filter(c => !medicareCarriers.includes(c) && !acaCarriers.includes(c) && !lifeCarriers.includes(c)).length > 0 && (
                        <optgroup label="Other">
                          {policyCarriers.filter(c => !medicareCarriers.includes(c) && !acaCarriers.includes(c) && !lifeCarriers.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-700">Status:</label>
                    <select value={policyFilter} onChange={(e) => setPolicyFilter(e.target.value)} className="px-3 py-2 border rounded-lg bg-white">
                      <option value="all">All Statuses</option>
                      <option value="healthy">✓ Healthy</option>
                      <option value="at-risk">⚠ At Risk</option>
                      <option value="churned">✗ Churned</option>
                    </select>
                  </div>
                  {(policyFilter !== 'all' || policyBusinessFilter !== 'all' || policyCarrierFilter !== 'all' || policySearchTerm) && (
                    <button onClick={() => { setPolicyFilter('all'); setPolicyBusinessFilter('all'); setPolicyCarrierFilter('all'); setPolicySearchTerm(''); }} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">Clear Filters</button>
                  )}
                </div>
                {(policyFilter !== 'all' || policyBusinessFilter !== 'all' || policyCarrierFilter !== 'all' || policySearchTerm) && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-600">Active filters:</span>
                    {policySearchTerm && <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">"{policySearchTerm}"</span>}
                    {policyBusinessFilter !== 'all' && <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">{policyBusinessFilter}</span>}
                    {policyCarrierFilter !== 'all' && <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-sm">{policyCarrierFilter}</span>}
                    {policyFilter !== 'all' && <span className={`px-2 py-1 rounded text-sm ${policyFilter === 'healthy' ? 'bg-green-100 text-green-800' : policyFilter === 'at-risk' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{policyFilter === 'at-risk' ? 'At Risk' : policyFilter.charAt(0).toUpperCase() + policyFilter.slice(1)}</span>}
                    <span className="text-sm text-gray-500 ml-2">→ {filteredPolicies.length} of {policies.length} policies</span>
                  </div>
                )}
              </div>

              {/* Policy Detail Modal */}
              {selectedPolicy && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-auto">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold">{selectedPolicy.clientName || 'Unknown Client'}</h3>
                          <p className="text-gray-600">Policy: {selectedPolicy.policyNumber}</p>
                        </div>
                        <button onClick={() => setSelectedPolicy(null)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-600">Carrier</p>
                          <p className="font-semibold">{selectedPolicy.carrier}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <p className="text-xs text-green-600">Total Commissions</p>
                          <p className="font-bold text-green-700">${selectedPolicy.totalCommissions.toFixed(2)}</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg">
                          <p className="text-xs text-red-600">Total Chargebacks</p>
                          <p className="font-bold text-red-700">-${selectedPolicy.totalChargebacks.toFixed(2)}</p>
                        </div>
                        <div className={`p-3 rounded-lg ${selectedPolicy.netRevenue >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                          <p className="text-xs text-gray-600">Net Revenue</p>
                          <p className={`font-bold ${selectedPolicy.netRevenue >= 0 ? 'text-blue-700' : 'text-red-700'}`}>${selectedPolicy.netRevenue.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          selectedPolicy.status === 'healthy' ? 'bg-green-100 text-green-800' :
                          selectedPolicy.status === 'at-risk' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {selectedPolicy.status === 'healthy' ? '✓ Healthy' : selectedPolicy.status === 'at-risk' ? '⚠ At Risk' : '✗ Churned'}
                        </span>
                        <span className="text-sm text-gray-600">First payment: {selectedPolicy.firstPayment}</span>
                        <span className="text-sm text-gray-600">Last payment: {selectedPolicy.lastPayment}</span>
                      </div>

                      <h4 className="font-semibold mb-2">Transaction History</h4>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Commission Type</th><th className="px-3 py-2 text-right">Amount</th></tr>
                        </thead>
                        <tbody>
                          {selectedPolicy.transactions.map((t, i) => (
                            <tr key={i} className={`border-b ${t.amount < 0 ? 'bg-red-50' : ''}`}>
                              <td className="px-3 py-2">{t.paymentDate}</td>
                              <td className="px-3 py-2">{t.policyType}</td>
                              <td className="px-3 py-2">{t.commissionType}</td>
                              <td className={`px-3 py-2 text-right font-bold ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {t.amount >= 0 ? '+' : ''}{t.amount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold">
                          <tr>
                            <td colSpan="3" className="px-3 py-2 text-right">Net Total:</td>
                            <td className={`px-3 py-2 text-right ${selectedPolicy.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>${selectedPolicy.netRevenue.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Policies Table */}
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Client</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Policy #</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Carrier</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Commissions</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Chargebacks</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Net Revenue</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Txns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPolicies.slice(0, 100).map((policy, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPolicy(policy)}>
                        <td className="px-4 py-3">
                          {policy.status === 'healthy' ? <span className="flex items-center gap-1 text-green-600"><TrendingUp className="w-4 h-4" /> Healthy</span> :
                           policy.status === 'at-risk' ? <span className="flex items-center gap-1 text-yellow-600"><AlertTriangle className="w-4 h-4" /> At Risk</span> :
                           <span className="flex items-center gap-1 text-red-600"><TrendingDown className="w-4 h-4" /> Churned</span>}
                        </td>
                        <td className="px-4 py-3 font-medium">{policy.clientName || '-'}</td>
                        <td className="px-4 py-3 text-sm">{policy.policyNumber}</td>
                        <td className="px-4 py-3 text-sm">{policy.carrier}</td>
                        <td className="px-4 py-3 text-sm">{policy.businessType}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">${policy.totalCommissions.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-medium">{policy.totalChargebacks > 0 ? `-$${policy.totalChargebacks.toFixed(2)}` : '-'}</td>
                        <td className={`px-4 py-3 text-right font-bold ${policy.netRevenue >= 0 ? 'text-green-700' : 'text-red-700'}`}>${policy.netRevenue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{policy.transactions.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPolicies.length > 100 && <div className="p-4 text-center text-gray-500">Showing first 100 of {filteredPolicies.length} policies</div>}
                {filteredPolicies.length === 0 && <div className="p-8 text-center text-gray-500">No policies found. Import commission statements to see policy analysis.</div>}
              </div>
            </div>
          ) : (
            <div className="py-4">
              <h2 className="text-2xl font-bold mb-6">Custom Reports</h2>
              <div className="bg-gray-50 p-6 rounded-lg border-2 mb-6">
                <h3 className="text-lg font-semibold mb-4">Report Parameters</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div><label className="block text-sm font-semibold mb-1">Start Date</label><input type="date" value={reportRange.startDate} onChange={(e) => setReportRange({...reportRange, startDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-semibold mb-1">End Date</label><input type="date" value={reportRange.endDate} onChange={(e) => setReportRange({...reportRange, endDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Carrier</label><select value={reportRange.carrier} onChange={(e) => setReportRange({...reportRange, carrier: e.target.value})} className="w-full px-3 py-2 border rounded-lg"><option value="">All Carriers</option>{uniqueCarriers.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="block text-sm font-semibold mb-1">Agent</label><select value={reportRange.agent} onChange={(e) => setReportRange({...reportRange, agent: e.target.value})} className="w-full px-3 py-2 border rounded-lg"><option value="">All Agents</option>{uniqueAgents.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                  <div><label className="block text-sm font-semibold mb-1">Commission Type</label><select value={reportRange.commissionType} onChange={(e) => setReportRange({...reportRange, commissionType: e.target.value})} className="w-full px-3 py-2 border rounded-lg"><option value="">All Types</option>{uniqueCommTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div className="flex items-end"><span onClick={() => setReportRange({ startDate: '', endDate: '', carrier: '', agent: '', commissionType: '' })} className="px-4 py-2 bg-gray-300 rounded-lg cursor-pointer hover:bg-gray-400">Clear Filters</span></div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-sm font-semibold mr-2 self-center">Quick Select:</span>
                  <span onClick={() => { const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth(), 1); setReportRange({...reportRange, startDate: start.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0]}); }} className="px-3 py-1 bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 text-sm">This Month</span>
                  <span onClick={() => { const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth() - 1, 1); const end = new Date(today.getFullYear(), today.getMonth(), 0); setReportRange({...reportRange, startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0]}); }} className="px-3 py-1 bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 text-sm">Last Month</span>
                  <span onClick={() => { const today = new Date(); const quarter = Math.floor(today.getMonth() / 3); const start = new Date(today.getFullYear(), quarter * 3, 1); setReportRange({...reportRange, startDate: start.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0]}); }} className="px-3 py-1 bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 text-sm">This Quarter</span>
                  <span onClick={() => { const today = new Date(); const start = new Date(today.getFullYear(), 0, 1); setReportRange({...reportRange, startDate: start.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0]}); }} className="px-3 py-1 bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 text-sm">This Year</span>
                  <span onClick={() => { setReportRange({...reportRange, startDate: '2025-10-15', endDate: '2025-12-07'}); }} className="px-3 py-1 bg-green-100 text-green-700 rounded cursor-pointer hover:bg-green-200 text-sm">AEP 2025</span>
                  <span onClick={() => { setReportRange({...reportRange, startDate: '2024-11-01', endDate: '2025-01-15'}); }} className="px-3 py-1 bg-orange-100 text-orange-700 rounded cursor-pointer hover:bg-orange-200 text-sm">OEP 2025</span>
                </div>
              </div>
              {(() => {
                const parseDate = (dateStr) => { if (!dateStr) return null; const str = dateStr.toString().trim(); if (str.includes('/')) { const parts = str.split('/'); if (parts.length === 3) { const month = parts[0].padStart(2, '0'); const day = parts[1].padStart(2, '0'); let year = parts[2]; if (year.length === 2) year = '20' + year; return `${year}-${month}-${day}`; } } if (str.includes('-') && str.length === 10) return str; return null; };
                const reportData = commissions.filter(c => { const normalizedDate = parseDate(c.paymentDate); if (reportRange.startDate && normalizedDate && normalizedDate < reportRange.startDate) return false; if (reportRange.endDate && normalizedDate && normalizedDate > reportRange.endDate) return false; if (reportRange.carrier && c.carrier !== reportRange.carrier) return false; if (reportRange.agent && c.agent !== reportRange.agent) return false; if (reportRange.commissionType && c.commissionType !== reportRange.commissionType) return false; return true; });
                const reportTotal = reportData.reduce((s, c) => s + c.amount, 0); const reportPositive = reportData.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0); const reportNegative = reportData.filter(c => c.amount < 0).reduce((s, c) => s + c.amount, 0); const reportClients = [...new Set(reportData.map(c => c.clientName))].filter(Boolean).length;
                return (
                  <div>
                    <div className="grid grid-cols-5 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg border"><h3 className="text-sm font-semibold text-blue-800">Net Revenue</h3><p className={`text-2xl font-bold ${reportTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>${reportTotal.toFixed(2)}</p></div>
                      <div className="bg-green-50 p-4 rounded-lg border"><h3 className="text-sm font-semibold text-green-800">Commissions</h3><p className="text-2xl font-bold text-green-700">${reportPositive.toFixed(2)}</p></div>
                      <div className="bg-red-50 p-4 rounded-lg border"><h3 className="text-sm font-semibold text-red-800">Chargebacks</h3><p className="text-2xl font-bold text-red-700">${Math.abs(reportNegative).toFixed(2)}</p></div>
                      <div className="bg-purple-50 p-4 rounded-lg border"><h3 className="text-sm font-semibold text-purple-800">Transactions</h3><p className="text-2xl font-bold text-purple-700">{reportData.length}</p></div>
                      <div className="bg-orange-50 p-4 rounded-lg border"><h3 className="text-sm font-semibold text-orange-800">Clients</h3><p className="text-2xl font-bold text-orange-700">{reportClients}</p></div>
                    </div>
                    <div className="mb-4"><span onClick={() => { if (!reportData.length) return; const csv = ['Date,Carrier,Client,Policy,Type,CommType,Agent,Amount,BusinessType', ...reportData.map(c => `"${c.paymentDate}","${c.carrier}","${c.clientName}","${c.policyNumber}","${c.policyType}","${c.commissionType}","${c.agent}",${c.amount},"${c.businessType || ''}"`)].join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `report_${reportRange.startDate || 'all'}_to_${reportRange.endDate || 'all'}.csv`; a.click(); }} className="bg-green-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-green-700 inline-flex items-center gap-2"><Download className="w-5 h-5" /> Export Report to CSV</span></div>
                    <div className="bg-white rounded-lg border overflow-hidden">
                      <table className="w-full"><thead className="bg-gray-100"><tr><th className="px-4 py-3 text-left text-sm">Date</th><th className="px-4 py-3 text-left text-sm">Carrier</th><th className="px-4 py-3 text-left text-sm">Client</th><th className="px-4 py-3 text-left text-sm">Policy</th><th className="px-4 py-3 text-left text-sm">Comm Type</th><th className="px-4 py-3 text-left text-sm">Agent</th><th className="px-4 py-3 text-left text-sm">Amount</th></tr></thead>
                      <tbody>{reportData.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)).slice(0, 100).map((c) => (<tr key={c.id} className="border-b hover:bg-gray-50"><td className="px-4 py-2 text-sm">{c.paymentDate}</td><td className="px-4 py-2 text-sm">{c.carrier}</td><td className="px-4 py-2 text-sm">{c.clientName}</td><td className="px-4 py-2 text-sm">{c.policyNumber}</td><td className="px-4 py-2 text-sm">{c.commissionType}</td><td className="px-4 py-2 text-sm">{c.agent}</td><td className={`px-4 py-2 text-sm font-bold ${c.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>${c.amount.toFixed(2)}</td></tr>))}</tbody></table>
                      {reportData.length > 100 && <div className="p-4 text-center text-gray-500">Showing first 100 of {reportData.length} records. Export to see all.</div>}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {currentPage === 'commissions' && commissions.length > 0 && (
          <div>
            <div className="bg-yellow-100 rounded-lg shadow-xl p-6 mb-4 border-4 border-yellow-500">
              <div className="flex items-center gap-3 mb-4"><Search className="w-8 h-8" /><h2 className="text-2xl font-bold">FILTER & SEARCH</h2>{hasFilters && <button onClick={() => setFilters({ searchTerm: '', carrier: '', commissionType: '', agent: '', startDate: '', endDate: '' })} className="ml-auto px-4 py-2 bg-yellow-600 text-white rounded-lg">Clear</button>}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3"><input type="text" placeholder="🔍 Search..." value={filters.searchTerm} onChange={(e) => setFilters({...filters, searchTerm: e.target.value})} className="w-full px-4 py-3 border-2 border-yellow-400 rounded-lg text-lg" /></div>
                <select value={filters.carrier} onChange={(e) => setFilters({...filters, carrier: e.target.value})} className="px-3 py-2 border-2 border-yellow-400 rounded-lg"><option value="">All Carriers</option>{uniqueCarriers.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <select value={filters.commissionType} onChange={(e) => setFilters({...filters, commissionType: e.target.value})} className="px-3 py-2 border-2 border-yellow-400 rounded-lg"><option value="">All Types</option>{uniqueCommTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <select value={filters.agent} onChange={(e) => setFilters({...filters, agent: e.target.value})} className="px-3 py-2 border-2 border-yellow-400 rounded-lg"><option value="">All Agents</option>{uniqueAgents.map(a => <option key={a} value={a}>{a}</option>)}</select>
                <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} className="px-3 py-2 border-2 border-yellow-400 rounded-lg" />
                <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} className="px-3 py-2 border-2 border-yellow-400 rounded-lg" />
              </div>
              {hasFilters && <div className="mt-4 text-lg font-semibold">📊 Showing {filtered.length} of {commissions.length}</div>}
            </div>

            {/* Mass Action Bar */}
            {selectedIds.size > 0 && (
              <div className="bg-indigo-100 rounded-lg p-4 mb-4 border-2 border-indigo-400 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-indigo-800">{selectedIds.size} selected</span>
                  <button onClick={() => setSelectedIds(new Set())} className="text-indigo-600 hover:text-indigo-800 text-sm underline">Clear selection</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowMassEdit(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    <Edit className="w-4 h-4" /> Edit Selected
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                    <Trash2 className="w-4 h-4" /> Delete Selected
                  </button>
                </div>
              </div>
            )}

            {/* Mass Edit Modal */}
            {showMassEdit && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
                  <h3 className="text-xl font-bold mb-4">Edit {selectedIds.size} Records</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2">Field to Update</label>
                    <select value={massEditField} onChange={(e) => { setMassEditField(e.target.value); setMassEditValue(''); }} className="w-full px-3 py-2 border rounded-lg">
                      <option value="">-- Select Field --</option>
                      <option value="carrier">Carrier</option>
                      <option value="businessType">Business Type</option>
                      <option value="commissionType">Commission Type</option>
                      <option value="agent">Agent</option>
                    </select>
                  </div>
                  {massEditField && (
                    <div className="mb-4">
                      <label className="block text-sm font-semibold mb-2">New Value</label>
                      {massEditField === 'carrier' ? (
                        <select value={massEditValue} onChange={(e) => setMassEditValue(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                          <option value="">-- Select --</option>
                          <optgroup label="Medicare">{medicareCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                          <optgroup label="ACA">{acaCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                          <optgroup label="Life">{lifeCarriers.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                          <option value="Other">Other</option>
                        </select>
                      ) : massEditField === 'businessType' ? (
                        <select value={massEditValue} onChange={(e) => setMassEditValue(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                          <option value="">-- Select --</option>
                          <option value="Medicare">Medicare</option>
                          <option value="ACA">ACA</option>
                          <option value="Life">Life</option>
                        </select>
                      ) : massEditField === 'commissionType' ? (
                        <select value={massEditValue} onChange={(e) => setMassEditValue(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                          <option value="">-- Select --</option>
                          {commissionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={massEditValue} onChange={(e) => setMassEditValue(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Enter new value" />
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowMassEdit(false); setMassEditField(''); setMassEditValue(''); }} className="flex-1 py-2 bg-gray-300 rounded-lg hover:bg-gray-400">Cancel</button>
                    <button onClick={handleMassEdit} disabled={!massEditField || !massEditValue} className={`flex-1 py-2 rounded-lg ${massEditField && massEditValue ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                      Update {selectedIds.size} Records
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
                  <h3 className="text-xl font-bold mb-4 text-red-600">⚠️ Confirm Delete</h3>
                  <p className="mb-4 text-gray-700">Are you sure you want to delete <strong>{selectedIds.size} records</strong>? This action cannot be undone.</p>
                  <div className="bg-red-50 p-3 rounded-lg mb-4">
                    <p className="text-sm text-red-800">Total amount being deleted: <strong>${filtered.filter(c => selectedIds.has(c.id)).reduce((s, c) => s + c.amount, 0).toFixed(2)}</strong></p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 bg-gray-300 rounded-lg hover:bg-gray-400">Cancel</button>
                    <button onClick={handleMassDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                      Yes, Delete {selectedIds.size} Records
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="px-2 py-3 text-left">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-4 h-4 cursor-pointer" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm">Date</th>
                    <th className="px-4 py-3 text-left text-sm">Carrier</th>
                    <th className="px-4 py-3 text-left text-sm">Client</th>
                    <th className="px-4 py-3 text-left text-sm">Policy</th>
                    <th className="px-4 py-3 text-left text-sm">Type</th>
                    <th className="px-4 py-3 text-left text-sm">Comm Type</th>
                    <th className="px-4 py-3 text-left text-sm">Agent</th>
                    <th className="px-4 py-3 text-left text-sm">Amount</th>
                    <th className="px-4 py-3 text-left text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)).map((c) => (
                    <tr key={c.id} className={`border-b hover:bg-gray-50 ${selectedIds.has(c.id) ? 'bg-indigo-50' : ''}`}>
                      <td className="px-2 py-3">
                        <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 text-sm">{c.paymentDate}</td>
                      <td className="px-4 py-3 text-sm font-medium">{c.carrier}</td>
                      <td className="px-4 py-3 text-sm">{c.clientName}</td>
                      <td className="px-4 py-3 text-sm">{c.policyNumber}</td>
                      <td className="px-4 py-3 text-sm">{c.policyType}</td>
                      <td className="px-4 py-3 text-sm">{c.commissionType}</td>
                      <td className="px-4 py-3 text-sm">{c.agent}</td>
                      <td className={`px-4 py-3 text-sm font-bold ${c.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>${c.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800 cursor-pointer inline-block p-2"><Trash2 className="w-5 h-5" /></span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

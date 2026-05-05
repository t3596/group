/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Settings, 
  Shuffle, 
  Copy, 
  RotateCcw, 
  Check, 
  Trash2, 
  Plus,
  LayoutGrid,
  ListOrdered,
  Sparkles,
  Upload,
  Download,
  FileUp,
  FileDown,
  Eye,
  X,
  User,
  LogOut
} from 'lucide-react';

type GroupingMode = 'count' | 'size';

interface Group {
  id: number;
  members: string[];
}

interface HistoryRecord {
  id: string;
  timestamp: string;
  groups: Group[];
  inputText: string;
  operator: string;
  meta: {
    mode: GroupingMode;
    value: number;
    surnameGrouping: boolean;
    memberCount: number;
  };
}

const SAMPLE_NAMES = [
  '陳小明',
  '陳大華',
  '陳美惠',
  '林志玲',
  '林大雄',
  '林月美',
  '王金平',
  '王小芬',
  '張學友',
  '張曼玉',
  '李登輝',
  '李宗盛',
  '趙少康',
  '劉德華'
];

export default function App() {
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<GroupingMode>('count');
  const [modeValue, setModeValue] = useState<number>(2);
  const [useSurnameGrouping, setSurnameGrouping] = useState(false);
  const [operator, setOperator] = useState('');
  const [isOperatorConfirmed, setIsOperatorConfirmed] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [animatingName, setAnimatingName] = useState('');
  const [results, setResults] = useState<Group[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<HistoryRecord | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    const saved = localStorage.getItem('grouping_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSwitch = () => {
    setIsOperatorConfirmed(false);
  };

  const handleLogout = () => {
    setIsOperatorConfirmed(false);
    setOperator('');
    setResults([]);
    setInputText('');
  };

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('grouping_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('grouping_operator', operator);
  }, [operator]);

  const members = useMemo(() => {
    return inputText
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);
  }, [inputText]);

  const handleLoadSample = () => {
    // We use common Taiwanese names. Same family names will have the same prefix.
    setInputText(SAMPLE_NAMES.join('\n'));
    setSurnameGrouping(true);
  };

  const handleExport = () => {
    if (!inputText.trim()) return;
    const blob = new Blob([inputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `member_list_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputText(content);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be imported again if needed
    e.target.value = '';
  };

  const handleShuffle = () => {
    if (members.length === 0) return;

    setIsCalculating(true);
    setResults([]);

    // Shuffling animation effect
    let counter = 0;
    const interval = setInterval(() => {
      setAnimatingName(members[Math.floor(Math.random() * members.length)]);
      counter++;
      if (counter > 20) {
        clearInterval(interval);
        performGrouping();
      }
    }, 50);
  };

  const performGrouping = () => {
    let finalGroups: Group[] = [];
    
    // Determine the groups/clusters to shuffle
    let itemsToDistribute: string[][] = [];
    
    if (useSurnameGrouping) {
      // Group by surname (first character)
      const groupsMap: Record<string, string[]> = {};
      members.forEach(member => {
        const surname = member.charAt(0);
        if (!groupsMap[surname]) groupsMap[surname] = [];
        groupsMap[surname].push(member);
      });
      itemsToDistribute = Object.values(groupsMap);
    } else {
      // Treat each member as its own cluster
      itemsToDistribute = members.map(m => [m]);
    }

    // Shuffle the clusters
    const shuffledItems = [...itemsToDistribute].sort(() => Math.random() - 0.5);

    if (mode === 'count') {
      const groupCount = Math.max(1, Math.min(members.length, modeValue));
      for (let i = 0; i < groupCount; i++) {
        finalGroups.push({ id: i + 1, members: [] });
      }
      // Distribute clusters into groups (round-robin)
      shuffledItems.forEach((cluster, index) => {
        finalGroups[index % groupCount].members.push(...cluster);
      });
    } else {
      const groupSize = Math.max(1, modeValue);
      let currentGroupMembers: string[] = [];
      let groupId = 1;
      
      shuffledItems.forEach((cluster) => {
        // If adding this cluster exceeds group size and it's not the first item, start a new group
        // Note: For surname grouping, groups might occasionally exceed the target size if a cluster is larger than groupSize
        if (currentGroupMembers.length > 0 && currentGroupMembers.length + cluster.length > groupSize && !useSurnameGrouping) {
          finalGroups.push({ id: groupId++, members: currentGroupMembers });
          currentGroupMembers = [...cluster];
        } else if (useSurnameGrouping && currentGroupMembers.length >= groupSize) {
           finalGroups.push({ id: groupId++, members: currentGroupMembers });
           currentGroupMembers = [...cluster];
        } else {
          currentGroupMembers.push(...cluster);
          // If we hit or exceed size (in prefix mode), start next
          if (currentGroupMembers.length >= groupSize) {
            finalGroups.push({ id: groupId++, members: currentGroupMembers });
            currentGroupMembers = [];
          }
        }
      });
      
      if (currentGroupMembers.length > 0) {
        finalGroups.push({ id: groupId++, members: currentGroupMembers });
      }
    }

    setResults(finalGroups);
    setIsCalculating(false);

    // Save to history
    const newRecord: HistoryRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      groups: finalGroups,
      inputText: inputText,
      operator: operator || '未設定操作者',
      meta: {
        mode,
        value: modeValue,
        surnameGrouping: useSurnameGrouping,
        memberCount: members.length
      }
    };
    setHistory(prev => [newRecord, ...prev].slice(0, 50)); // Keep last 50
  };

  const handleReset = () => {
    setResults([]);
    setInputText('');
  };

  const deleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(r => r.id !== id));
  };

  const restoreHistory = (record: HistoryRecord) => {
    setResults(record.groups);
    setInputText(record.inputText);
    setMode(record.meta.mode);
    setModeValue(record.meta.value);
    setSurnameGrouping(record.meta.surnameGrouping);
    setShowHistory(false);
    // Smooth scroll to results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportAllHistory = () => {
    if (history.length === 0) return;
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    // Use local time for filename to be more intuitive
    const timestamp = now.getFullYear().toString() + 
                     (now.getMonth() + 1).toString().padStart(2, '0') + 
                     now.getDate().toString().padStart(2, '0') + '_' + 
                     now.getHours().toString().padStart(2, '0') + 
                     now.getMinutes().toString().padStart(2, '0') + 
                     now.getSeconds().toString().padStart(2, '0');
    link.download = `grouping_history_backup_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSingleRecord = (record: HistoryRecord, format: 'txt' | 'csv') => {
    const text = record.groups
      .map(group => `Group ${group.id}:\n${group.members.join('\n')}`)
      .join('\n\n');
    
    if (format === 'txt') {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `grouping_record_${record.timestamp.slice(0, 16).replace(/[:T]/g, '_')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      let csvContent = "\ufeff組別,序號,姓名\n";
      record.groups.forEach(group => {
        group.members.forEach((member, index) => {
          csvContent += `${group.id},${index + 1},"${member}"\n`;
        });
      });
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `grouping_record_${record.timestamp.slice(0, 16).replace(/[:T]/g, '_')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopy = () => {
    if (results.length === 0) return;
    
    const text = results
      .map(g => `第 ${g.id} 組：${g.members.join('、')}`)
      .join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleCopyForSheets = () => {
    if (results.length === 0) return;

    // TSV format for perfect pasting into Google Sheets/Excel
    let tsvContent = "組別\t序號\t姓名\n";
    results.forEach(group => {
      group.members.forEach((member, index) => {
        tsvContent += `${group.id}\t${index + 1}\t${member}\n`;
      });
    });

    navigator.clipboard.writeText(tsvContent).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleExportTXT = () => {
    if (results.length === 0) return;
    
    const text = results
      .map(g => `第 ${g.id} 組\n------------------\n${g.members.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n`)
      .join('\n');
      
    downloadFile(text, 'txt');
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;

    // CSV header: Group ID, Member Name
    let csvContent = "\ufeff"; // Add BOM for Excel UTF-8 support
    csvContent += "組別,序號,姓名\n";
    
    results.forEach(group => {
      group.members.forEach((member, index) => {
        csvContent += `${group.id},${index + 1},"${member}"\n`;
      });
    });

    downloadFile(csvContent, 'csv');
  };

  const downloadFile = (content: string, extension: string) => {
    const blob = new Blob([content], { type: extension === 'csv' ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const timestamp = now.getFullYear().toString() + 
                     (now.getMonth() + 1).toString().padStart(2, '0') + 
                     now.getDate().toString().padStart(2, '0') + '_' + 
                     now.getHours().toString().padStart(2, '0') + 
                     now.getMinutes().toString().padStart(2, '0') + 
                     now.getSeconds().toString().padStart(2, '0');
    link.download = `grouping_results_${timestamp}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const OPERATORS = ['王小芬', '蔡小株'];

  if (!isOperatorConfirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 font-sans selection:bg-violet-100">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-2xl"
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-violet-600 text-white shadow-xl shadow-violet-200">
              <Users size={40} />
            </div>
            <h2 className="text-2xl font-black text-neutral-800 tracking-tight">歡迎聰明使用分組工具</h2>
            <p className="mt-2 text-sm font-bold text-neutral-400">請選擇或輸入您的姓名以開始</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {OPERATORS.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setOperator(name);
                    setIsOperatorConfirmed(true);
                  }}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-neutral-50 bg-neutral-50 p-6 transition-all hover:border-violet-500 hover:bg-violet-50 hover:text-violet-700 active:scale-95"
                >
                  <div className="rounded-full bg-white p-3 shadow-sm">
                    <User size={24} className="text-violet-500" />
                  </div>
                  <span className="text-sm font-black">{name}</span>
                </button>
              ))}
            </div>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100"></div></div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest text-neutral-300"><span className="bg-white px-3 italic">OR</span></div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="輸入其他自定義名稱..."
                  className="w-full rounded-2xl border-2 border-neutral-50 bg-neutral-50 py-4 pl-12 pr-4 text-sm font-bold text-neutral-700 outline-none transition-all focus:border-violet-200 focus:bg-white"
                />
              </div>
              <button
                disabled={!operator.trim()}
                onClick={() => setIsOperatorConfirmed(true)}
                className="w-full rounded-2xl bg-neutral-900 py-4 font-black text-white transition-all hover:bg-neutral-800 disabled:opacity-30 active:scale-95 shadow-xl shadow-neutral-200"
              >
                確認並進入
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 selection:bg-violet-100">
      <header className="sticky top-0 z-10 border-b border-neutral-100 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-violet-600 p-2 text-white shadow-lg shadow-violet-200">
              <Users size={24} />
            </div>
            <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">
              快速分組小工具
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200">
              <User size={14} className="text-violet-600" />
              <span className="text-[10px] sm:text-xs font-black text-neutral-600 truncate max-w-[60px] sm:max-w-none">{operator}</span>
              <div className="flex items-center gap-2 ml-1 border-l border-neutral-300 pl-2">
                <button 
                  onClick={handleSwitch}
                  className="text-[10px] font-black text-violet-600 hover:text-violet-800 transition-colors"
                  title="切換人員"
                >
                  切換
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-[10px] font-black text-rose-500 hover:text-rose-700 transition-colors"
                  title="登出並清空"
                >
                  <LogOut size={12} />
                  <span className="hidden sm:inline">登出</span>
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 text-sm font-bold transition-all px-3 py-1.5 rounded-full ${
                showHistory ? 'bg-violet-100 text-violet-600' : 'text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <RotateCcw size={16} className={showHistory ? 'rotate-180' : ''} />
              分組歷程
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm font-bold text-neutral-400 hover:text-rose-600 transition-all active:scale-95"
            >
              重設
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <AnimatePresence>
          {showHistory && (
            <motion.section
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="rounded-3xl border border-violet-100 bg-violet-50/30 p-6 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-violet-400 flex items-center gap-2">
                    <RotateCcw size={14} /> 分組歷史記錄 (最近 {history.length} 筆)
                  </h3>
                  <div className="flex gap-4">
                    <button 
                      onClick={handleExportAllHistory}
                      className="text-[10px] font-black uppercase text-violet-400 hover:text-violet-600 px-2 py-1 rounded-md flex items-center gap-1"
                    >
                      <Download size={12} /> 備份所有歷程
                    </button>
                    {showClearConfirm ? (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            setHistory([]);
                            setShowClearConfirm(false);
                          }}
                          className="text-[10px] font-black uppercase text-white bg-rose-500 px-2 py-1 rounded-md shadow-sm"
                        >
                          確定
                        </button>
                        <button 
                          onClick={() => setShowClearConfirm(false)}
                          className="text-[10px] font-black uppercase text-neutral-400 px-2 py-1"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowClearConfirm(true)}
                        className="text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 px-2 py-1 rounded-md"
                      >
                        全部清空
                      </button>
                    )}
                  </div>
                </div>
                
                {history.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                    {history.map((record) => (
                      <motion.div
                        key={record.id}
                        whileHover={{ y: -4 }}
                        className="relative min-w-[200px] flex-shrink-0 rounded-2xl border border-white bg-white/80 p-4 text-left shadow-sm hover:shadow-md transition-all group"
                      >
                        <button
                          onClick={(e) => deleteHistory(record.id, e)}
                          className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white group-hover:flex shadow-lg z-10"
                        >
                          <Plus size={14} className="rotate-45" />
                        </button>
                        <div className="mb-2 text-[10px] font-black text-violet-400">{formatDate(record.timestamp)}</div>
                        <div className="mb-3 text-sm font-black text-neutral-800">
                          {record.groups.length} 組 / {record.meta.memberCount} 人
                        </div>
                        <div className="mb-3 text-[10px] font-bold text-neutral-400 flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded">
                          <Users size={10} /> {record.operator}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setPreviewRecord(record)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-600 py-1.5 text-[10px] font-black text-white hover:bg-violet-700 transition-all active:scale-95"
                          >
                            <Eye size={12} />
                            查看
                          </button>
                          <button
                            onClick={() => handleExportSingleRecord(record, 'txt')}
                            className="flex items-center justify-center rounded-lg bg-neutral-100 p-1.5 text-neutral-600 hover:bg-neutral-200 transition-all active:scale-95"
                            title="下載 TXT"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            onClick={() => restoreHistory(record)}
                            className="flex items-center justify-center rounded-lg bg-neutral-100 p-1.5 text-neutral-600 hover:bg-neutral-200 transition-all active:scale-95"
                            title="還原"
                          >
                            <RotateCcw size={12} />
                          </button>
                        </div>

                        <div className="mt-3 flex gap-1 border-t border-neutral-100 pt-2">
                          <span className="rounded bg-neutral-100 px-1 py-0.5 text-[8px] font-bold text-neutral-400 uppercase">
                            {record.meta.mode === 'count' ? '分幾組' : '一組幾人'}
                          </span>
                          {record.meta.surnameGrouping && (
                            <span className="rounded bg-rose-50 px-1 py-0.5 text-[8px] font-bold text-rose-400 uppercase">
                              同姓氏
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm font-bold text-violet-200">
                    尚無歷史記錄
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Input Section */}
          <section className="lg:col-span-5">
            <div className="rounded-3xl border border-neutral-100 bg-white/50 p-6 shadow-xl shadow-neutral-200/50 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-widest text-neutral-400">
                  成員名單 ({members.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="file"
                    id="import-file"
                    className="hidden"
                    accept=".txt"
                    onChange={handleImport}
                  />
                  <label
                    htmlFor="import-file"
                    className="flex cursor-pointer items-center gap-1.5 px-3 py-1.2 rounded-full border border-neutral-200 bg-white text-[10px] font-black text-neutral-600 hover:border-violet-300 hover:text-violet-600 transition-all active:scale-95 shadow-sm"
                  >
                    <FileDown size={12} />
                    匯入
                  </label>
                  <button
                    onClick={handleExport}
                    disabled={!inputText.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.2 rounded-full border border-neutral-200 bg-white text-[10px] font-black text-neutral-600 hover:border-violet-300 hover:text-violet-600 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                  >
                    <FileUp size={12} />
                    匯出
                  </button>
                  <button
                    onClick={handleLoadSample}
                    className="flex items-center gap-1.5 px-3 py-1.2 rounded-full border border-violet-200 bg-violet-50 text-[10px] font-black text-violet-600 hover:bg-violet-100 transition-all active:scale-95 shadow-sm"
                  >
                    <Sparkles size={12} />
                    範例
                  </button>
                  <button 
                    onClick={() => setInputText('')}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 transition-all ml-auto"
                    title="清空名單"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="請輸入名單，一人一行...&#10;小明&#10;小華&#10;小強"
                className="h-64 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm font-medium focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/5 transition-all resize-none shadow-inner"
              />

              <div className="mt-8 space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-neutral-400">
                    分組規則
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setMode('count')}
                      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-bold transition-all ${
                        mode === 'count'
                          ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-md shadow-violet-100'
                          : 'border-neutral-100 bg-white text-neutral-500 hover:border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <LayoutGrid size={24} />
                      分幾組
                    </button>
                    <button
                      onClick={() => setMode('size')}
                      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-bold transition-all ${
                        mode === 'size'
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700 shadow-md shadow-cyan-100'
                          : 'border-neutral-100 bg-white text-neutral-500 hover:border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <ListOrdered size={24} />
                      一組幾人
                    </button>
                  </div>
                  <button
                    onClick={() => setSurnameGrouping(!useSurnameGrouping)}
                    className={`mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border-2 p-4 text-sm font-bold transition-all ${
                      useSurnameGrouping
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-md shadow-rose-100'
                        : 'border-neutral-100 bg-white text-neutral-500 hover:border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <div className={`rounded-full p-1.5 transition-colors ${useSurnameGrouping ? 'bg-rose-500 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                      <Users size={18} />
                    </div>
                    <span>同姓氏者分在一起</span>
                    {useSurnameGrouping && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white"
                      >
                        ON
                      </motion.span>
                    )}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-widest text-neutral-400">
                      設定數值
                    </label>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-600">{modeValue}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={members.length > 0 ? members.length : 20}
                    value={modeValue}
                    onChange={(e) => setModeValue(parseInt(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-violet-600"
                  />
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    操作者帳號/姓名 (將儲存於歷程中)
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-300" size={16} />
                    <input
                      type="text"
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      placeholder="請輸入 Google 帳號或名稱..."
                      className="w-full rounded-xl border-2 border-neutral-50 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm font-bold text-neutral-700 outline-none transition-all focus:border-violet-200 focus:bg-white"
                    />
                  </div>
                </div>

                <button
                  onClick={handleShuffle}
                  disabled={members.length === 0 || isCalculating}
                  className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 py-4.5 font-black text-white shadow-xl shadow-violet-200 transition-all hover:scale-[1.02] hover:shadow-2xl active:scale-95 disabled:from-neutral-300 disabled:to-neutral-400 disabled:shadow-none disabled:active:scale-100"
                >
                  <Shuffle size={20} className="group-hover:rotate-180 transition-transform duration-700" />
                  <span>立即分組</span>
                </button>
              </div>
            </div>
          </section>

          {/* Result Section */}
          <section className="lg:col-span-7">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-black uppercase tracking-widest text-neutral-400">
                分組結果
              </label>
              {results.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleExportTXT}
                    className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-neutral-600 border border-neutral-100 shadow-lg shadow-neutral-100 hover:border-violet-500 hover:text-violet-600 transition-all active:scale-95"
                  >
                    <FileDown size={14} />
                    匯出 TXT
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-neutral-600 border border-neutral-100 shadow-lg shadow-neutral-100 hover:border-cyan-500 hover:text-cyan-600 transition-all active:scale-95"
                  >
                    <FileDown size={14} />
                    匯出 CSV
                  </button>
                  <button
                    onClick={handleCopyForSheets}
                    className="flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700 border border-green-100 shadow-lg shadow-green-100 hover:border-green-500 transition-all active:scale-95"
                  >
                    <LayoutGrid size={14} />
                    複製到 Google 試算表
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all active:scale-95"
                  >
                    {isCopied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                    {isCopied ? '已複製' : '分享結果'}
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-[500px] rounded-[2rem] border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-6 backdrop-blur-sm relative overflow-hidden">
              <AnimatePresence mode="wait">
                {isCalculating ? (
                  <motion.div
                    key="calculating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center p-12 text-center h-[400px]"
                  >
                    <motion.div 
                      animate={{ 
                        rotate: [0, 360],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                      className="mb-8 rounded-full bg-violet-600 p-8 text-white shadow-2xl shadow-violet-200"
                    >
                      <Shuffle size={64} />
                    </motion.div>
                    <motion.div
                      key={animatingName}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-4xl font-black text-violet-600 italic tracking-tighter"
                    >
                      {animatingName}
                    </motion.div>
                    <p className="mt-4 text-sm font-bold text-neutral-400 animate-pulse uppercase tracking-[0.2em]">
                      Randomizing Teams...
                    </p>
                  </motion.div>
                ) : results.length > 0 ? (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid gap-5 sm:grid-cols-2"
                  >
                    <div className="col-span-full mb-2 flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-2 border border-violet-100">
                      <User size={14} className="text-violet-600" />
                      <span className="text-xs font-black text-violet-700">操作人員：{operator}</span>
                    </div>
                    {results.map((group, idx) => (
                      <motion.div
                        key={group.id}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: idx * 0.05, type: "spring", damping: 15 }}
                        className="group overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-xl shadow-neutral-100 hover:border-violet-200 hover:shadow-violet-100/50 transition-all"
                      >
                        <div className="flex items-center justify-between bg-gradient-to-r from-neutral-50 to-white px-5 py-3 border-b border-neutral-50">
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            Team
                          </span>
                          <span className="text-xl font-black italic text-violet-600 group-hover:scale-110 transition-transform">
                            #{group.id}
                          </span>
                        </div>
                        <ul className="p-5 space-y-3">
                          {group.members.map((member, mIdx) => (
                            <li key={mIdx} className="flex items-center gap-3">
                              <div className="h-6 w-6 rounded-full bg-violet-50 flex items-center justify-center text-[10px] font-bold text-violet-400 border border-violet-100">
                                {mIdx + 1}
                              </div>
                              <span className="text-sm font-semibold text-neutral-700">{member}</span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center p-12 text-center h-[400px]"
                  >
                    <div className="mb-6 relative">
                      <div className="absolute inset-0 bg-violet-400 blur-3xl opacity-20 animate-pulse" />
                      <div className="relative rounded-full bg-white p-8 text-neutral-300 shadow-2xl">
                        <Users size={64} className="animate-bounce" />
                      </div>
                    </div>
                    <h3 className="mb-2 text-xl font-black text-neutral-400 tracking-tight">準備好要分組了嗎？</h3>
                    <p className="max-w-[280px] text-sm font-medium text-neutral-400">
                      讓系統為你隨機分配隊伍，公平又有趣！
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-auto py-12 border-t border-neutral-100">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300">
            Design for the trendsetters &middot; {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* History Preview Modal */}
      <AnimatePresence>
        {previewRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewRecord(null)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[2.5rem] bg-white shadow-2xl"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-100 px-8 py-6">
                  <div>
                    <h3 className="text-xl font-black text-neutral-800">
                      分組詳情預覽
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs font-bold text-neutral-400">
                        {formatDate(previewRecord.timestamp)} &middot; {previewRecord.meta.memberCount} 位成員 &middot; {previewRecord.groups.length} 個分組
                      </p>
                      <span className="h-1 w-1 rounded-full bg-neutral-300" />
                      <p className="text-xs font-black text-violet-500 flex items-center gap-1">
                        <User size={12} /> {previewRecord.operator}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewRecord(null)}
                    className="rounded-full bg-neutral-100 p-2 text-neutral-500 hover:bg-neutral-200 transition-all active:scale-90"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {previewRecord.groups.map(group => (
                      <div key={group.id} className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Team</span>
                          <span className="text-lg font-black italic text-violet-600">#{group.id}</span>
                        </div>
                        <ul className="space-y-2">
                          {group.members.map((member, idx) => (
                            <li key={idx} className="flex gap-2 text-sm font-semibold text-neutral-700">
                              <span className="text-neutral-300">{(idx + 1).toString().padStart(2, '0')}.</span>
                              {member}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-neutral-100 bg-neutral-50/50 px-8 py-6">
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      onClick={() => handleExportSingleRecord(previewRecord, 'txt')}
                      className="flex items-center gap-2 rounded-xl bg-white border border-neutral-200 px-4 py-2.5 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-all active:scale-95"
                    >
                      <Download size={18} />
                      下載 TXT
                    </button>
                    <button
                      onClick={() => handleExportSingleRecord(previewRecord, 'csv')}
                      className="flex items-center gap-2 rounded-xl bg-white border border-neutral-200 px-4 py-2.5 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-all active:scale-95"
                    >
                      <FileDown size={18} />
                      下載 CSV
                    </button>
                    <div className="w-px h-10 bg-neutral-200 mx-2 hidden sm:block" />
                    <button
                      onClick={() => {
                        restoreHistory(previewRecord);
                        setPreviewRecord(null);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all active:scale-95"
                    >
                      <RotateCcw size={18} />
                      還原此分組
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

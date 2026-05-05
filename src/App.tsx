import { useState, useEffect, useRef } from 'react';
import { Play, Square, Download, HardDrive, Terminal, Trash2, Eraser, CheckCircle2, RotateCcw, FileArchive, Settings, Image as ImageIcon, Database } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'coleta' | 'biblioteca' | 'configuracoes'>('coleta');
  const [status, setStatus] = useState<any>(null);
  const [target, setTarget] = useState(() => localStorage.getItem('lastTarget') || '');
  const [options, setOptions] = useState(() => {
    const saved = localStorage.getItem('lastOptions');
    return saved ? JSON.parse(saved) : {
      downloadComments: false,
      downloadGeotags: false,
      downloadIGTV: false,
      downloadStories: false,
      downloadHighlights: false,
      downloadTagged: false,
      fastUpdate: false,
      noPictures: false,
      noVideos: false,
      noCaptions: false,
      noMetadata: false,
      postFilter: '',
      count: '',
      loginUser: '',
      loginPassword: '',
    };
  });
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem('lastFilters');
    return saved ? JSON.parse(saved) : {
      minLikes: '',
      minComments: '',
      dateFrom: '',
      dateTo: ''
    };
  });
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('lastTarget', target);
  }, [target]);

  useEffect(() => {
    localStorage.setItem('lastOptions', JSON.stringify(options));
  }, [options]);

  useEffect(() => {
    localStorage.setItem('lastFilters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    checkStatus();
    fetchFiles();
    
    const eventSource = new EventSource('/api/logs');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogs(prev => {
        const newLogs = [...prev, data];
        return newLogs.slice(-1000);
      });
      if (data.text.includes('Installation process exited') || data.text.includes('Instaloader process exited') || data.text.includes('Process terminated')) {
        setIsRunning(false);
        checkStatus();
        fetchFiles();
      }
    };
    return () => eventSource.close();
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const checkStatus = () => {
    fetch('/api/status')
      .then(r => r.json())
      .then(data => setStatus(data))
      .catch(console.error);
  };

  const fetchFiles = () => {
    fetch('/api/files')
      .then(r => r.json())
      .then(data => setFiles(data.profiles || []))
      .catch(console.error);
  };

  const handleDelete = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir?')) return;
    
    fetch(`/api/files?p=${encodeURIComponent(path)}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(data => {
        if (data.success) fetchFiles();
        else alert('Erro ao excluir: ' + data.error);
      })
      .catch(console.error);
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleResetSettings = () => {
    if(!confirm('Deseja restaurar as configurações padrão?')) return;
    setOptions({
      downloadComments: false, downloadGeotags: false, downloadIGTV: false,
      downloadStories: false, downloadHighlights: false, downloadTagged: false,
      fastUpdate: false, noPictures: false, noVideos: false,
      noCaptions: false, noMetadata: false, postFilter: '', count: '', loginUser: '', loginPassword: '',
    });
    setFilters({ minLikes: '', minComments: '', dateFrom: '', dateTo: '' });
  };

  const handleInstall = () => {
    setIsRunning(true);
    fetch('/api/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pythonCommand: status?.pythonCommand || 'python3' })
    }).catch(console.error);
  };

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setIsRunning(true);

    // Filter Builder
    let compiledFilter = [];
    if (filters.minLikes) compiledFilter.push(`likes >= ${filters.minLikes}`);
    if (filters.minComments) compiledFilter.push(`comments >= ${filters.minComments}`);
    if (filters.dateFrom) {
      const parts = filters.dateFrom.split('-');
      if (parts.length === 3) compiledFilter.push(`date_utc >= datetime(${parts[0]}, ${parseInt(parts[1])}, ${parseInt(parts[2])})`);
    }
    if (filters.dateTo) {
      const parts = filters.dateTo.split('-');
      if (parts.length === 3) compiledFilter.push(`date_utc <= datetime(${parts[0]}, ${parseInt(parts[1])}, ${parseInt(parts[2])})`);
    }
    const finalPostFilter = compiledFilter.length > 0 ? compiledFilter.join(' and ') : options.postFilter;

    fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pythonCommand: status?.pythonCommand || 'python3',
        target,
        options: { ...options, postFilter: finalPostFilter }
      })
    }).catch(console.error);
  };

  const handleStop = () => {
    fetch('/api/stop', { method: 'POST' }).catch(console.error);
  };

  return (
    <div className="w-full h-screen flex bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <aside className="w-64 bg-slate-900 flex flex-col shrink-0">
        <div className="p-8 border-b border-slate-800">
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">SocialMiner</span>
          </div>
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('coleta')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'coleta' ? 'bg-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Terminal className="w-5 h-5" />
              <span>Coleta de Dados</span>
            </button>
            <button 
              onClick={() => setActiveTab('biblioteca')}
              className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'biblioteca' ? 'bg-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <div className="flex items-center space-x-3">
                <ImageIcon className="w-5 h-5" />
                <span>Biblioteca</span>
              </div>
              <span className="bg-slate-800 text-xs py-0.5 px-2 rounded-full font-bold">{files.length}</span>
            </button>
          </nav>
        </div>
        <div className="mt-auto p-8">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-500 uppercase font-bold mb-2 tracking-wider">Engine Local</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Status:</span>
              <div className="flex items-center space-x-2">
                {status ? (
                  <>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-emerald-400">Ativo</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-amber-400">Carregando</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 px-6 lg:px-10 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            {activeTab === 'coleta' && 'Fluxo de Coleta'}
            {activeTab === 'biblioteca' && 'Biblioteca de Mídia'}
            {activeTab === 'configuracoes' && 'Configurações'}
          </h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-500 hidden sm:block">v4.10.x Local Backend</span>
            <button 
              onClick={() => setActiveTab(activeTab === 'configuracoes' ? 'coleta' : 'configuracoes')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center space-x-2 ${activeTab === 'configuracoes' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              <Settings className="w-4 h-4" />
              <span>Configurações</span>
            </button>
          </div>
        </header>

        {activeTab === 'coleta' && (
        <div className="flex-1 p-6 lg:p-10 flex flex-col xl:grid xl:grid-cols-12 gap-8 overflow-y-auto">
          {/* Left Area (8 cols) - Configuration and Logs */}
          <div className="xl:col-span-8 flex flex-col space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8 shrink-0">
              <h3 className="text-lg font-bold mb-6">Novo Alvo de Coleta</h3>
              
              <form onSubmit={handleRun}>
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={target}
                      onChange={e => setTarget(e.target.value)}
                      placeholder="Ex: @usuario, #hashtag ou URL..."
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                      required
                    />
                    <svg className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </div>
                  {!isRunning ? (
                    <button 
                      type="submit"
                      disabled={!status?.instaloader}
                      className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <Play className="w-5 h-5 fill-current" /> Iniciar Coleta
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={handleStop}
                      className="px-8 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-600/30 transition-all transform active:scale-95 whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <Square className="w-5 h-5 fill-current" /> Parar Processo
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 pb-2">
                  {Object.entries({
                    downloadStories: { label: 'Baixar Stories', sub: 'Histórias ativas' },
                    downloadHighlights: { label: 'Destaques', sub: 'Stories fixados' },
                    downloadComments: { label: 'Comentários', sub: 'Top comentários' },
                    downloadGeotags: { label: 'Localizações', sub: 'Dados de Geotags' },
                    downloadIGTV: { label: 'Baixar IGTV', sub: 'Vídeos longos' },
                    downloadTagged: { label: 'Marcados', sub: 'Posts em que foi marcado' },
                    fastUpdate: { label: 'Atualização Rápida', sub: 'Pula já baixados' },
                    noPictures: { label: 'Ignorar Fotos', sub: 'Não baixa imagens' },
                    noVideos: { label: 'Ignorar Vídeos', sub: 'Não baixa vídeos' },
                    noCaptions: { label: 'Ignorar Leg.', sub: 'Não baixa textos' },
                    noMetadata: { label: 'Ignorar JSON', sub: 'Sem metadados' },
                  }).map(([key, info]) => {
                    const isChecked = (options as any)[key];
                    return (
                      <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50 cursor-pointer hover:bg-slate-50/50 rounded-lg px-2 transition-colors" onClick={() => setOptions({...options, [key]: !isChecked})}>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-sm">{info.label}</span>
                          <span className="text-[11px] text-slate-500">{info.sub}</span>
                        </div>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${isChecked ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isChecked ? 'right-0.5' : 'left-0.5'}`}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-100 mb-2">
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="font-semibold text-slate-800 block mb-1">Filtros de Coleta (Opcional)</span>
                      <span className="text-xs text-slate-500 block mb-3">Defina critérios para baixar apenas os posts desejados.</span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-600 mb-1">Qtd. Máxima</label>
                        <input type="number" placeholder="Ex: 50" min="1" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" value={options.count} onChange={(e) => setOptions({...options, count: e.target.value})} />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-600 mb-1">Mín. Likes</label>
                        <input type="number" placeholder="Ex: 100" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" value={filters.minLikes} onChange={(e) => setFilters({...filters, minLikes: e.target.value})} />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-600 mb-1">Mín. Comentários</label>
                        <input type="number" placeholder="Ex: 50" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" value={filters.minComments} onChange={(e) => setFilters({...filters, minComments: e.target.value})} />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-600 mb-1">Data Início</label>
                        <input type="date" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom: e.target.value})} />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-600 mb-1">Data Fim</label>
                        <input type="date" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo: e.target.value})} />
                      </div>
                    </div>
                    
                    <div className="flex flex-col mt-2 pt-4 border-t border-slate-50">
                      <span className="font-semibold text-slate-800 mb-1">Autenticação Avancada (Opcional & Instável)</span>
                      <span className="text-xs text-slate-500 mb-3">
                        O envio de senha a partir de servidores em nuvem frequentemente aciona bloqueios de segurança do Instagram.
                        Podem ocorrer erros de "Suspicious Login".
                      </span>
                      <div className="flex flex-col sm:flex-row gap-4 max-w-md w-full">
                        <input type="text" placeholder="Nome de usuário" className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" value={options.loginUser} onChange={(e) => setOptions({...options, loginUser: e.target.value})} />
                        <input type="password" placeholder="Senha" className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" value={options.loginPassword} onChange={(e) => setOptions({...options, loginPassword: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </div>

              </form>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8 flex flex-col min-h-[300px] flex-1 shrink-0">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Log de Processamento</h3>
                <div className="flex flex-wrap gap-3 items-center justify-end">
                  {isRunning ? (
                    <span className="text-xs font-mono text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">worker-01 ativo</span>
                  ) : (
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">worker ocioso</span>
                  )}
                  <button onClick={handleClearLogs} className="text-xs text-slate-500 hover:text-rose-600 font-bold px-3 py-1.5 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors border border-slate-100 flex items-center gap-1 group">
                    <Eraser className="w-3 h-3 group-hover:text-rose-500 transition-colors" /> Limpar
                  </button>
                  <button type="button" onClick={handleResetSettings} className="hidden md:flex text-xs text-slate-500 hover:text-indigo-600 font-bold px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-100 items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Restaurar Configs
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-4 overflow-y-auto font-mono text-xs sm:text-sm leading-relaxed border border-slate-100 h-64 lg:h-auto">
                {logs.length === 0 ? (
                  <p className="text-slate-400 italic text-center mt-6">Aguardando início do processo...</p>
                ) : (
                  logs.map((log, i) => {
                    const isErr = log.type === 'error' || log.type === 'stderr';
                    const isInfo = log.type === 'info';
                    const colorClass = isErr ? 'text-rose-500' : isInfo ? 'text-indigo-500' : 'text-slate-600';
                    return (
                      <div key={i} className={`whitespace-pre-wrap break-all mb-1 ${colorClass}`}>
                        <span className="opacity-50 mr-2 text-slate-400">[{new Date(log.timestamp).toLocaleTimeString('pt-BR')}]</span>
                        {log.text}
                      </div>
                    )
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </section>
          </div>

          {/* Right Area (4 cols) - Status and Stats */}
          <div className="xl:col-span-4 flex flex-col space-y-6">
            
            <div className="bg-slate-900 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden shrink-0">
               <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                 <HardDrive className="w-48 h-48" />
               </div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center justify-between z-10 relative">
                <span>Status do Sistema</span>
                {status && status.instaloader && status.python && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                )}
              </h3>
              
              {!status ? (
                <p className="text-sm text-slate-400 relative z-10">Verificando sistema local...</p>
              ) : (
                <div className="space-y-4 relative z-10">
                  <div className="bg-slate-800/50 p-4 rounded-xl flex items-center justify-between border border-slate-700/50">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Python Environment</p>
                      <p className="text-sm font-bold text-slate-200">{status.pythonCommand || 'Não detectado'}</p>
                    </div>
                    {status.python ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                         <span className="text-emerald-400 text-xs font-bold">✓</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                         <span className="text-rose-400 text-xs font-bold">✕</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-800/50 p-4 rounded-xl flex items-center justify-between border border-slate-700/50">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Instaloader Core</p>
                      <p className="text-sm font-bold text-slate-200">{status.instaloader ? 'Disponível' : 'Ausente'}</p>
                    </div>
                    {status.instaloader ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                         <span className="text-emerald-400 text-xs font-bold">✓</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                         <span className="text-rose-400 text-xs font-bold">✕</span>
                      </div>
                    )}
                  </div>

                  {status.python && !status.instaloader && (
                    <button 
                      onClick={handleInstall}
                      disabled={isRunning}
                      className="w-full mt-4 bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
                    >
                      {isRunning ? 'Instalando...' : 'Instalar Instaloader'}
                    </button>
                  )}
                  {!status.python && (
                     <p className="text-xs text-rose-400 mt-2">Instale o Python 3 na sua máquina para continuar.</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8 flex flex-col flex-1 min-h-[350px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Arquivos Salvos</h3>
                <button onClick={fetchFiles} className="text-xs text-slate-500 hover:text-indigo-600 font-bold px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-100 flex items-center gap-1"><Download className="w-3 h-3" /> Atualizar</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 h-64 lg:h-auto">
                {files.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-8">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                    </div>
                    <span className="text-sm font-medium">Nenhum dado baixado</span>
                  </div>
                ) : (
                  files.map((dir: any, i: number) => (
                    <div key={i} className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-slate-50 px-4 py-3 font-semibold text-sm text-slate-800 flex justify-between items-center border-b border-slate-100/80">
                        <span className="flex items-center gap-2">
                          <span className="text-[#e2a849] text-base">📁</span> {dir.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-1 bg-white rounded-full text-slate-500 border border-slate-200/60 shadow-sm">{dir.children?.length || 0} items</span>
                          <a
                            href={`/api/zip?p=${encodeURIComponent(dir.name)}`}
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors"
                            title="Baixar como ZIP"
                          >
                            <FileArchive className="w-4 h-4" />
                          </a>
                          <button 
                            onClick={(e) => handleDelete(dir.name, e)}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-colors"
                            title="Excluir Pasta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto bg-white">
                        {dir.children?.map((file: any, j: number) => (
                          <a 
                            key={j} 
                            href={`/downloads/${file.path}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50/50 group transition-colors"
                          >
                            <span className="text-xs text-slate-600 font-mono truncate max-w-[70%] group-hover:text-indigo-600 flex items-center gap-2">
                              <span className="opacity-40 text-slate-400 group-hover:text-indigo-400">📄</span> {file.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                              <button 
                                onClick={(e) => handleDelete(file.path, e)}
                                className="text-transparent group-hover:text-rose-400 hover:!text-rose-600 hover:bg-rose-50 p-1 rounded transition-all"
                                title="Excluir Arquivo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </a>
                        ))}
                        {dir.children?.length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-400/80 font-medium italic text-center">Pasta vazia</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
        )}

        {activeTab === 'biblioteca' && (
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-12">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                <p>Nenhuma mídia encontrada. Finalize uma coleta primeiro.</p>
              </div>
            ) : (
              files.map(dir => {
                const images = dir.children?.filter((f: any) => f.name.endsWith('.jpg') || f.name.endsWith('.png'));
                const videos = dir.children?.filter((f: any) => f.name.endsWith('.mp4'));
                
                if (!images?.length && !videos?.length) return null;

                return (
                  <div key={dir.name} className="space-y-6 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        <span className="text-3xl bg-slate-100 p-2 rounded-xl">📁</span> 
                        {dir.name}
                      </h3>
                      <div className="flex gap-2 text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-600">
                        {images?.length > 0 && <span>{images.length} fotos</span>}
                        {images?.length > 0 && videos?.length > 0 && <span>•</span>}
                        {videos?.length > 0 && <span>{videos.length} vídeos</span>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {images?.map((img: any) => (
                        <div key={img.path} className="aspect-square bg-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group relative border border-slate-200">
                          <img src={`/downloads/${img.path}`} alt={img.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                          <div className="absolute inset-x-0 top-0 p-3 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                             <p className="text-[10px] text-white/90 truncate font-mono">{img.name}</p>
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <a href={`/downloads/${img.path}`} target="_blank" className="p-3 bg-white shadow-lg rounded-full text-slate-900 hover:text-indigo-600 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0" download>
                              <Download className="w-5 h-5"/>
                            </a>
                          </div>
                        </div>
                      ))}
                      {videos?.map((vid: any) => (
                        <div key={vid.path} className="aspect-square bg-slate-900 rounded-xl overflow-hidden relative group border border-slate-800 shadow-sm hover:shadow-md transition-all">
                           <video src={`/downloads/${vid.path}`} className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"></video>
                           <Play className="w-10 h-10 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80 group-hover:scale-125 transition-transform duration-500" />
                           <div className="absolute inset-x-0 bottom-0 p-3 pt-6 bg-gradient-to-t from-black/90 to-transparent">
                             <p className="text-[10px] text-white/90 truncate font-mono">{vid.name}</p>
                           </div>
                           <a href={`/downloads/${vid.path}`} target="_blank" className="absolute top-2 right-2 p-2 bg-white/20 backdrop-blur rounded-full text-white hover:bg-white hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all" download>
                             <Download className="w-4 h-4"/>
                           </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'configuracoes' && (
          <div className="flex-1 overflow-y-auto p-6 lg:p-10">
            <div className="max-w-4xl mx-auto space-y-8">
               <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                 <h3 className="text-xl font-bold flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                    <Database className="w-6 h-6 text-indigo-500" />
                    Manutenção e Limpeza
                 </h3>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="border border-slate-100 bg-slate-50 p-6 rounded-xl space-y-3">
                       <h4 className="font-semibold text-slate-800">Restaurar Parâmetros</h4>
                       <p className="text-sm text-slate-500">Voltar opções de download e filtros para os padrões.</p>
                       <button onClick={handleResetSettings} className="px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                         <RotateCcw className="w-4 h-4" /> Restaurar
                       </button>
                    </div>
                    <div className="border border-slate-100 bg-slate-50 p-6 rounded-xl space-y-3">
                       <h4 className="font-semibold text-slate-800">Limpar Log de Processamento</h4>
                       <p className="text-sm text-slate-500">Remove todos os registros da janela do console.</p>
                       <button onClick={handleClearLogs} className="px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                         <Eraser className="w-4 h-4" /> Limpar Logs
                       </button>
                    </div>
                 </div>
               </section>

               <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                 <h3 className="text-xl font-bold flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                    <Terminal className="w-6 h-6 text-slate-700" />
                    Ambiente do Sistema
                 </h3>
                 <div className="space-y-4 font-mono text-sm">
                   <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-slate-50 gap-2">
                     <span className="text-slate-500 w-32">Status:</span>
                     {status ? (
                       <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-bold w-max">Online & Instalado</span>
                     ) : (
                       <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full text-xs font-bold w-max">Detectando...</span>
                     )}
                   </div>
                   <div className="flex flex-col sm:flex-row py-2 border-b border-slate-50 gap-2">
                     <span className="text-slate-500 w-32">Instaloader:</span>
                     <span className="text-slate-800 break-all">{status?.version || 'N/A'}</span>
                   </div>
                   <div className="flex flex-col sm:flex-row py-2 border-b border-slate-50 gap-2">
                     <span className="text-slate-500 w-32">Python CMD:</span>
                     <span className="text-slate-800 break-all">{status?.pythonCommand || 'N/A'}</span>
                   </div>
                   <div className="flex flex-col sm:flex-row py-2 border-b border-slate-50 gap-2">
                     <span className="text-slate-500 w-32">Dir Downloads:</span>
                     <span className="text-slate-800 break-all">./downloads</span>
                   </div>
                 </div>
               </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

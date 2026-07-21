import React, { useState, useEffect, useRef, useCallback } from 'react';
import Analytics from './Analytics';
import LogAnalysis from './LogAnalysis';
import LogVolumeAnalytics from './components/dashboard/LogVolumeAnalytics';

function CursorBackground() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const targetMouse = useRef({ x: 0.5, y: 0.5 });
  const animRef = useRef(null);
  const nodesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      targetMouse.current = { x: e.clientX / W, y: e.clientY / H };
    };
    window.addEventListener('mousemove', onMove);

    const cols = 22, rows = 14;
    nodesRef.current = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        nodesRef.current.push({
          bx: (i / (cols - 1)) * W,
          by: (j / (rows - 1)) * H,
          x: (i / (cols - 1)) * W,
          y: (j / (rows - 1)) * H,
          size: Math.random() * 1.5 + 0.5,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }

    let t = 0;
    const draw = () => {
      mouse.current.x += (targetMouse.current.x - mouse.current.x) * 0.05;
      mouse.current.y += (targetMouse.current.y - mouse.current.y) * 0.05;

      ctx.clearRect(0, 0, W, H);

      const grad = ctx.createRadialGradient(
        mouse.current.x * W, mouse.current.y * H, 0,
        W / 2, H / 2, Math.max(W, H)
      );
      grad.addColorStop(0, '#050d1a');
      grad.addColorStop(0.4, '#020810');
      grad.addColorStop(1, '#000305');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const cg = ctx.createRadialGradient(
        mouse.current.x * W, mouse.current.y * H, 0,
        mouse.current.x * W, mouse.current.y * H, 320
      );
      cg.addColorStop(0, 'rgba(0,220,180,0.07)');
      cg.addColorStop(0.5, 'rgba(0,120,255,0.04)');
      cg.addColorStop(1, 'transparent');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);

      for (let y = 0; y < H; y += 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(0, y, W, 1);
      }

      const mx = mouse.current.x * W;
      const my = mouse.current.y * H;

      nodesRef.current.forEach((n) => {
        const dx = mx - n.bx, dy = my - n.by;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = Math.max(0, 1 - dist / 350);
        n.pulse += 0.015;

        const tx = n.bx + dx * pull * 0.18 + Math.sin(t * 0.4 + n.pulse) * 6;
        const ty = n.by + dy * pull * 0.18 + Math.cos(t * 0.3 + n.pulse) * 6;
        n.x += (tx - n.x) * 0.08;
        n.y += (ty - n.y) * 0.08;

        const alpha = 0.2 + pull * 0.8 + Math.sin(n.pulse) * 0.1;
        const size = n.size + pull * 2.5;

        ctx.beginPath();
        ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
        ctx.fillStyle = pull > 0.3
          ? `rgba(0,220,180,${alpha})`
          : `rgba(0,100,200,${alpha * 0.6})`;
        ctx.fill();
      });

      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) {
            const alpha = (1 - d / 90) * 0.15;
            const adx = mx - a.x, ady = my - a.y;
            const near = Math.sqrt(adx * adx + ady * ady) < 250;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = near
              ? `rgba(0,220,180,${alpha * 3})`
              : `rgba(0,100,200,${alpha})`;
            ctx.lineWidth = near ? 0.8 : 0.4;
            ctx.stroke();
          }
        }
      }

      const sweepY = ((t * 0.4) % H);
      const sg = ctx.createLinearGradient(0, sweepY - 40, 0, sweepY + 2);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(1, 'rgba(0,220,180,0.04)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, sweepY - 40, W, 42);

      t++;
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />;
}

function StatusBadge({ code }) {
  const colors = {
    200: '#00ff88', 201: '#00ff88', 204: '#00ff88',
    301: '#f59e0b', 302: '#f59e0b', 304: '#f59e0b',
    400: '#ff9933', 401: '#ff3355', 403: '#ff3355', 404: '#ff9933', 409: '#ff9933', 429: '#ff6644',
    500: '#ff4444', 502: '#ff4444', 503: '#ff4444', 504: '#ff6644',
  };
  const color = colors[code] || '#00b4ff';
  return <span style={{
    padding: '2px 8px', borderRadius: 2, fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
    border: `1px solid ${color}88`,
    color: color,
    border: `1px solid ${color}44`,
    background: `${color}0d`,
    textShadow: `0 0 8px ${color}`,
  }}>{code}</span>
  ;
}

function SectionHeader({ title, tag }) {
  return (
    <div style={styles.sectionHeader}>
      <span style={styles.sectionSlash}>//</span>
      <span style={styles.sectionTitle}>{title}</span>
      {tag && <span style={styles.sectionTag}>{tag}</span>}
      <div style={styles.sectionLine} />
    </div>
  );
}

function AIAnalysisPanel({ stats }) {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const runAnalysis = useCallback(async () => {
    if (!stats?.logs || stats.logs.length === 0) {
      setError('No logs available for analysis');
      return;
    }
    setLoading(true);
    setError('');
    setAnalysisResult(null);
    try {
      const response = await fetch('http://127.0.0.1:4000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: stats.logs }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAnalysisResult(data);
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
      console.error('[AIAnalysisPanel]', err);
    } finally {
      setLoading(false);
    }
  }, [stats]);

  return (
    <div style={styles.section}>
      <SectionHeader title="AI Analysis Engine" tag="GROQ" />
      <div style={styles.analysisStatsRow}>
        <div style={styles.analysisStat}>
          <span style={{ fontSize: 11, color: '#4a9888', letterSpacing: 2 }}>TOTAL REQUESTS</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#00dc9b' }}>{stats?.totalRequests || 0}</span>
        </div>
        <div style={styles.analysisStat}>
          <span style={{ fontSize: 11, color: '#4a9888', letterSpacing: 2 }}>ERROR RATE</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: stats?.errorRate > 20 ? '#ff3355' : '#00dc9b' }}>
            {(stats?.errorRate || 0).toFixed(1)}%
          </span>
        </div>
        <div style={styles.analysisStat}>
          <span style={{ fontSize: 11, color: '#4a9888', letterSpacing: 2 }}>ERROR COUNT</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: stats?.errorCount > 0 ? '#ff9933' : '#00dc9b' }}>
            {stats?.errorCount || 0}
          </span>
        </div>
        <div style={styles.analysisStat}>
          <span style={{ fontSize: 11, color: '#4a9888', letterSpacing: 2 }}>MODE</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b' }}>
            {stats?.mode || 'stable'}
          </span>
        </div>
      </div>
      <button style={loading ? { ...styles.analyzeBtn, ...styles.analyzeBtnLoading } : styles.analyzeBtn} onClick={runAnalysis} disabled={loading}>
        {loading ? <div style={styles.btnSpinner} /> : null}
        {loading ? 'ANALYZING WITH GROQ...' : '✨ RUN AI ANALYSIS'}
      </button>
      {error && <div style={styles.analysisError}>{error}</div>}
      {analysisResult && (
        <div style={styles.analysisResultWrap}>
          <div style={styles.analysisResultHeader}>
            <span>📋 INCIDENT REPORT</span>
            <button style={styles.rawToggleBtn} onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? 'Hide JSON' : 'Show JSON'}
            </button>
          </div>
          <div style={styles.analysisGrid}>
            <div style={styles.analysisCard}>
              <div style={styles.analysisCardLabel}>PRIMARY ERROR</div>
              <div style={{ fontSize: 13, color: '#ff3355', fontWeight: 600 }}>
                {analysisResult.primary_error || 'Unknown'}
              </div>
            </div>
            <div style={styles.analysisCard}>
              <div style={styles.analysisCardLabel}>ROOT CAUSE</div>
              <div style={{ fontSize: 13, color: '#a8d8cc' }}>
                {analysisResult.root_cause || 'Analysis in progress'}
              </div>
            </div>
            <div style={styles.analysisCard}>
              <div style={styles.analysisCardLabel}>RECOMMENDED ACTION</div>
              <div style={{ fontSize: 13, color: '#00dc9b' }}>
                {analysisResult.recommended_action || 'Monitor'}
              </div>
            </div>
            <div style={styles.analysisCard}>
              <div style={styles.analysisCardLabel}>RISK LEVEL</div>
              <div style={{ fontSize: 13, color: analysisResult.risk_level === 'CRITICAL' ? '#ff3355' : analysisResult.risk_level === 'HIGH' ? '#ff9933' : '#00dc9b' }}>
                {analysisResult.risk_level || 'LOW'}
              </div>
            </div>
          </div>
          <div style={styles.analysisSummaryText}>
            <strong>Summary:</strong> {analysisResult.summary || 'No summary available'}
          </div>
          {showRaw && (
            <div style={styles.rawJson}>
              {JSON.stringify(analysisResult, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalRequests: 0,
    totalErrors: 0,
    errorRate: 0,
    uptime: '0h',
    mode: 'stable',
    logs: [],
    rollbacks: [],
    errorCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [manualRollback, setManualRollback] = useState(false);

  const[metrics, setMetrics]= useState({
    avgLatency:0,
    maxLatency:0,
    minLatency:0,
    requestsPerMinute:0,
    successRate:0,
    failureRate:0,
    activeBackend: "stable",
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const resp = await fetch('http://127.0.0.1:4000/api/stats', { method: 'GET' });
        if (resp.ok) {
          const data = await resp.json();

          const logsResp= await fetch("http://127.0.0.1:4000/api/logs");
          const logsData= await logsResp.json();
          setStats(prev => ({
            ...prev,
            ...data,
            logs: logsData.logs || [],
            errorRate: data.totalRequests > 0 ? ((data.totalErrors || 0) / data.totalRequests) * 100 : 0,
            errorCount: data.totalErrors || 0,
          }));
        }
      } catch (e) {
        console.error('[Stats fetch]', e);
      } finally {
        setLoading(false);
      }
    };

    const fetchMetrics= async() =>{
      try{
        const resp=await fetch(
          "http://127.0.0.1:4000/api/metrics"
        );
        if(resp.ok){
          const data= await resp.json();
          console.log("METRICS URL:",resp.url);
          console.log("METRICS DATA:",data);
          setMetrics(data);
        }
      }catch(err){
        console.error("[Metrics fetch]",err);
      }
    };

    fetchStats();
    fetchMetrics();

    const interval = setInterval(() => {
      fetchStats();
      fetchMetrics();
    }, 2000);
  }, []);

  const setMode = async (newMode) => {
    try {
      const resp = await fetch('http://127.0.0.1:4000/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      if (resp.ok) {
        setStats(prev => ({ ...prev, mode: newMode }));
      }
    } catch (e) {
      console.error('[setMode error]', e);
    }
  };

  const triggerRollback = async () => {
    setManualRollback(true);
    try {
      await fetch('http://127.0.0.1:4000/api/rollback', { method: 'POST' });
      setStats(prev => ({ ...prev, mode: 'stable' }));
    } catch (e) {
      console.error('[Rollback error]', e);
    } finally {
      setManualRollback(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingInner}>
          <div style={styles.loadingSpinner} />
          <div style={styles.loadingText}>LOGWATCHAI</div>
          <div style={styles.loadingBar}><div style={styles.loadingFill} /></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <CursorBackground />
      <div style={styles.shell}>

        <div style={styles.header}>
          <div style={styles.headerGlow} />
          <div style={styles.headerLeft}>
            <div style={styles.headerHex}>◆</div>
            <div>
              <div style={styles.headerTitle}>LOGWATCHAI</div>
              <div style={styles.headerSub}>LIVE CANARY MONITORING + AI AGENTS</div>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.liveDot} />
            <div style={styles.liveText}>LIVE</div>
            <div style={styles.headerDivider} />
            <div style={styles.headerTime}>{new Date().toLocaleTimeString()}</div>
          </div>
          <div style={styles.headerBorderBottom} />
        </div>

        <div style={styles.metricsGrid}>
          {[
            { label: 'TOTAL REQUESTS', value: stats.totalRequests, color: '#00dc9b' },
            { label: 'ERROR RATE', value: `${stats.errorRate.toFixed(1)}%`, color: stats.errorRate > 20 ? '#ff3355' : '#00dc9b' },
            { label: 'ERRORS', value: stats.errorCount, color: stats.errorCount > 0 ? '#ff9933' : '#00dc9b' },
            { label: 'MODE', value: stats.mode.toUpperCase(), color: '#f59e0b' },
          ].map((m, i) => (
            <div key={i} style={{ ...styles.metricCard, '--accent': m.color }}>
              <div style={styles.metricCornerTL} />
              <div style={styles.metricCornerBR} />
              <div style={styles.metricLabel}>{m.label}</div>
              <div style={{ ...styles.metricValue, color: m.color }}>{m.value}</div>
              <div style={{ ...styles.metricBar, background: m.color }} />
            </div>
          ))}
        </div>

        <AIAnalysisPanel stats={stats} />

        <div style={styles.section}>
  <SectionHeader title="Observability Metrics" tag="LIVE" />

  <div style={styles.metricsGrid}>
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>AVG LATENCY</div>
      <div style={styles.metricValue}>{metrics.avgLatency}ms</div>
    </div>

    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>MAX LATENCY</div>
      <div style={styles.metricValue}>{metrics.maxLatency}ms</div>
    </div>

    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>MIN LATENCY</div>
      <div style={styles.metricValue}>{metrics.minLatency}ms</div>
    </div>

    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>REQ/MIN</div>
      <div style={styles.metricValue}>{metrics.requestsPerMinute}</div>
    </div>

    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>SUCCESS RATE</div>
      <div style={styles.metricValue}>{metrics.successRate}%</div>
    </div>

    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>FAILURE RATE</div>
      <div style={styles.metricValue}>{metrics.failureRate}%</div>
    </div>

    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>ACTIVE BACKEND</div>
      <div style={styles.metricValue}>{metrics.activeBackend}</div>
    </div>
  </div>
</div>

        <div style={styles.section}>
          <SectionHeader title="Traffic Mode" tag="CONFIG" />
          <div style={styles.modeGrid}>
            {['stable', 'canary', 'test'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  ...styles.modeBtn,
                  background: stats.mode === m ? 'rgba(0,220,155,0.1)' : 'rgba(255,255,255,0.02)',
                  border: stats.mode === m ? '1px solid #00dc9b' : '1px solid rgba(255,255,255,0.08)',
                  color: stats.mode === m ? '#00dc9b' : '#7ecfbe',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 900 }}>{m.toUpperCase()}</div>
                <div style={styles.modeStatus}>
                  {m === 'stable' && '100% Stable'}
                  {m === 'test' && '100% Canary'}
                  {m === 'canary' && '90/10 Split'}
                </div>
              </button>
            ))}
          </div>
          <button onClick={triggerRollback} style={styles.rollbackBtn} disabled={manualRollback}>
            {manualRollback ? '⏳ ROLLING BACK...' : '🚨 EMERGENCY ROLLBACK'}
          </button>
          <div style={styles.rollbackInfo}>Triggers automatic rollback to stable server</div>
        </div>

        <div style={styles.section}>
          <SectionHeader title="Rollback History" tag={`${stats.rollbacks?.length || 0}`} />
          {stats.rollbacks && stats.rollbacks.length > 0 ? (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr>{['TIME', 'REASON', 'FROM', 'TO'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {stats.rollbacks.map((r, i) => (
                    <tr key={i} style={styles.tr}>
                      <td style={styles.td}>{new Date(r.timestamp).toLocaleTimeString()}</td>
                      <td style={styles.td}>{r.reason || 'Manual'}</td>
                      <td style={styles.td}>{r.from}</td>
                      <td style={{ ...styles.td, color: '#00dc9b' }}>{r.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#4a9888' }}>No rollbacks yet ✅</div>
          )}
        </div>

        {stats.logs && stats.logs.length > 0 && (
          <>
            <Analytics logs={stats.logs} />
            <LogAnalysis logs={stats.logs} />
            <LogVolumeAnalytics />
          </>
        )}

        {stats.logs && stats.logs.length > 0 && (
          <div style={styles.section}>
            <SectionHeader title="Recent Requests" tag={`${stats.logs.length}`} />
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr>{['TIME', 'METHOD', 'PATH', 'STATUS', 'BACKEND', 'MS', 'IP', 'RESPONSE'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {stats.logs.map((log, i) => (
                    <tr key={i} style={{ ...styles.tr, ...(log.statusCode >= 400 ? styles.trError : {}) }}>
                      <td style={styles.td}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td style={{ ...styles.td, color: '#a78bfa' }}>{log.method}</td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 10 }}>{log.path}</td>
                      <td style={styles.td}><StatusBadge code={log.statusCode} /></td>
                      <td style={{ ...styles.td, color: log.target?.includes('logwatch-stable') ? '#00dc9b' : '#f59e0b' }}>
                        {log.target?.includes('logwatch-stable') ? 'stable' : 'canary'}
                      </td>
                      <td style={{ ...styles.td, color: '#00b4ff' }}>{log.duration}</td>
                      <td style={{ ...styles.td, color: '#5aaa88', fontSize: 10 }}>{log.ip}</td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 10, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typeof log.responseBody === 'string' ? log.responseBody.substring(0, 50) : 'ok'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={styles.footer}>
          CANARY_MATRIX · RAG+PINECONE+GROQ · {new Date().getFullYear()}
        </div>
      </div>
    </>
  );
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; overflow-x: hidden; cursor: crosshair; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #00dc9b33; border-radius: 2px; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fillBar { from { width: 0%; } to { width: 70%; } }
  @keyframes glowPulse {
    0%, 100% { text-shadow: 0 0 30px #00dc9b, 0 0 60px #00dc9b55; }
    50%       { text-shadow: 0 0 50px #00dc9b, 0 0 100px #00dc9b88; }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const styles = {
  shell: {
    position: 'relative', zIndex: 1, maxWidth: 1400,
    margin: '0 auto', padding: '100px 24px 60px',
    fontFamily: "'Share Tech Mono', monospace", color: '#8ecfbf',
  },
  loading: { position: 'fixed', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loadingInner: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 },
  loadingSpinner: { width: 48, height: 48, borderRadius: '50%', border: '2px solid #00dc9b22', borderTop: '2px solid #00dc9b', animation: 'spin 0.8s linear infinite' },
  loadingText: { fontFamily: "'Orbitron', monospace", fontSize: 13, letterSpacing: 6, color: '#00dc9b', textShadow: '0 0 20px #00dc9b' },
  loadingBar: { width: 200, height: 2, background: '#ffffff08', borderRadius: 1 },
  loadingFill: { height: '100%', background: '#00dc9b', borderRadius: 1, animation: 'fillBar 1.5s ease forwards' },
  header: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 0 24px', marginBottom: 8 },
  headerGlow: { position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: 1, background: 'linear-gradient(90deg, transparent, #00dc9b33, transparent)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  headerHex: { fontSize: 42, color: '#00dc9b', animation: 'glowPulse 3s ease infinite' },
  headerTitle: { fontFamily: "'Orbitron', monospace", fontSize: 22, fontWeight: 900, color: '#e8f8f4', letterSpacing: 4, textShadow: '0 0 40px rgba(0,220,155,0.3)' },
  headerSub: { fontSize: 11, color: '#6ab8a8', letterSpacing: 2, marginTop: 4 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  liveDot: { width: 8, height: 8, borderRadius: '50%', background: '#00dc9b', boxShadow: '0 0 12px #00dc9b', animation: 'pulse 1.5s ease infinite' },
  liveText: { fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#00dc9b', letterSpacing: 3 },
  headerDivider: { width: 1, height: 20, background: '#ffffff10' },
  headerTime: { fontSize: 12, color: '#6ab8a8', fontFamily: 'monospace' },
  headerBorderBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, #00dc9b15, #00b4ff15, transparent)' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 },
  metricCard: { position: 'relative', padding: '24px 20px', background: 'rgba(0,8,16,0.4)', border: '1px solid rgba(0,220,155,0.15)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', gap: 6, animation: 'fadeUp 0.5s ease backwards', overflow: 'hidden' },
  metricCornerTL: { position: 'absolute', top: 0, left: 0, width: 12, height: 12, borderTop: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' },
  metricCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderBottom: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' },
  metricLabel: { fontSize: 10, letterSpacing: 3, color: '#6ab8a8', fontFamily: "'Orbitron', monospace" },
  metricValue: { fontSize: 36, fontFamily: "'Orbitron', monospace", fontWeight: 900, lineHeight: 1 },
  metricBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 },
  section: { marginBottom: 32, padding: 24, background: 'rgba(0,5,12,0.45)', border: '1px solid rgba(0,150,120,0.1)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', animation: 'fadeUp 0.5s ease backwards' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid rgba(0,220,155,0.07)' },
  sectionSlash: { color: '#00dc9b', fontFamily: "'Orbitron', monospace", fontSize: 14 },
  sectionTitle: { fontFamily: "'Orbitron', monospace", fontSize: 13, color: '#b8e8d8', letterSpacing: 2 },
  sectionTag: { fontSize: 9, letterSpacing: 2, padding: '3px 8px', border: '1px solid #00dc9b33', color: '#00dc9b', fontFamily: "'Orbitron', monospace" },
  sectionLine: { flex: 1, height: 1, background: 'linear-gradient(90deg, #00dc9b10, transparent)' },
  analysisStatsRow: { display: 'flex', gap: 24, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(0,220,155,0.06)' },
  analysisStat: { display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 16px', background: 'rgba(0,220,155,0.03)', border: '1px solid rgba(0,220,155,0.08)' },
  analyzeBtn: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 32px', marginBottom: 12, background: 'rgba(0,220,155,0.05)', border: '1px solid #00dc9b44', color: '#00dc9b', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", fontSize: 14, letterSpacing: 1, boxShadow: '0 0 20px #00dc9b22', transition: 'box-shadow 0.2s ease' },
  analyzeBtnLoading: { opacity: 0.7, cursor: 'not-allowed', border: '1px solid #00dc9b22' },
  btnSpinner: { width: 16, height: 16, borderRadius: '50%', border: '2px solid #00dc9b22', borderTop: '2px solid #00dc9b', animation: 'spin 0.7s linear infinite', flexShrink: 0 },
  analysisError: { padding: '12px 16px', marginBottom: 16, background: 'rgba(255,51,85,0.05)', border: '1px solid rgba(255,51,85,0.2)', color: '#ff3355', fontSize: 12, fontFamily: 'monospace' },
  analysisResultWrap: { animation: 'slideIn 0.4s ease', marginTop: 8 },
  analysisResultHeader: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#00dc9b', letterSpacing: 2, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(0,220,155,0.08)' },
  analysisGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  analysisCard: { padding: '14px 16px', background: 'rgba(0,220,155,0.03)', border: '1px solid rgba(0,220,155,0.1)' },
  analysisCardLabel: { fontSize: 9, letterSpacing: 2, color: '#4a9888', fontFamily: "'Orbitron', monospace", marginBottom: 6 },
  analysisSummaryText: { fontSize: 13, color: '#a8d8cc', lineHeight: 1.7, fontFamily: "'Share Tech Mono', monospace", borderLeft: '2px solid #00dc9b33', paddingLeft: 12, marginTop: 6 },
  rawToggleBtn: { background: 'none', border: '1px solid rgba(0,220,155,0.15)', color: '#4a9888', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, padding: '6px 12px', letterSpacing: 1, transition: 'color 0.2s' },
  rawJson: { marginTop: 8, padding: 16, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,220,155,0.08)', color: '#5aaa88', fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', maxHeight: 320, overflowY: 'auto', lineHeight: 1.5 },
  modeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 },
  modeBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '20px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: '#7ecfbe', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'monospace' },
  modeStatus: { fontSize: 11, color: '#5aaa88', letterSpacing: 2, fontFamily: 'monospace' },
  rollbackBtn: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 32px', marginBottom: 12, background: 'rgba(255,51,85,0.05)', border: '1px solid #ff335544', color: '#ff3355', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", fontSize: 14, letterSpacing: 1, boxShadow: '0 0 20px #ff335522', transition: 'box-shadow 0.2s ease' },
  rollbackInfo: { fontSize: 11, color: '#5a7888', letterSpacing: 2, fontFamily: 'monospace' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '10px 12px', textAlign: 'left', fontFamily: "'Orbitron', monospace", fontSize: 9, letterSpacing: 2, color: '#4a9888', borderBottom: '1px solid rgba(0,220,155,0.08)', fontWeight: 400 },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' },
  trError: { background: 'rgba(255,51,85,0.04)' },
  td: { padding: '10px 12px', color: '#8ecfbf', verticalAlign: 'middle' },
  badge: { padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', display: 'inline-block' },
  footer: { textAlign: 'center', padding: '24px 0', fontSize: 10, letterSpacing: 4, color: '#3a8878', fontFamily: "'Orbitron', monospace", borderTop: '1px solid rgba(0,220,155,0.05)' },
};

export default Dashboard;
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import './LogVolumeAnalytics.css';

const COLORS = ['#ff4444', '#f59e0b', '#22d3ee', '#a78bfa', '#00ff88'];

const LogVolumeAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState({
    hourly: [],
    daily: [],
    severity: [],
    services: [],
    totalLogs: 0,
    dateRange: { from: null, to: null },
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [activeTab, setActiveTab] = useState('hourly');

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      const resp = await fetch('http://127.0.0.1:4000/api/analytics/volume');
      if (resp.ok) {
        const result = await resp.json();
        if (result.success) {
          setAnalyticsData(result.data);
        }
      }
    } catch (err) {
      console.error('[Analytics fetch]', err);
    } finally {
      setLoading(false);
    }
  };

  const exportChart = async (type) => {
    try {
      const resp = await fetch('http://127.0.0.1:4000/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data: analyticsData[type] }),
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logwatch-${type}-${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[Export error]', err);
    }
  };

  const TooltipBox = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="lva-tooltip">
        <div className="lva-tooltip-label">{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color || p.fill }}>
            {p.name}: <b>{p.value}</b>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="lva-loading">
        <div className="lva-loading-spinner" />
        <div className="lva-loading-text">Loading Analytics...</div>
      </div>
    );
  }

  return (
    <section className="lva-section">
      <div className="lva-header">
        <h2>📊 Log Volume Analytics</h2>
        <div className="lva-controls">
          <div className="lva-date-filter">
            <label>From:</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            />
            <label>To:</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            />
          </div>
          <button className="lva-refresh-btn" onClick={fetchAnalytics}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="lva-summary">
        <div className="lva-summary-card">
          <div className="lva-summary-label">Total Logs</div>
          <div className="lva-summary-value">{analyticsData.totalLogs}</div>
        </div>
        <div className="lva-summary-card">
          <div className="lva-summary-label">Date Range</div>
          <div className="lva-summary-value-small">
            {analyticsData.dateRange.from ? new Date(analyticsData.dateRange.from).toLocaleDateString() : 'N/A'} — 
            {analyticsData.dateRange.to ? new Date(analyticsData.dateRange.to).toLocaleDateString() : 'N/A'}
          </div>
        </div>
        <div className="lva-summary-card">
          <div className="lva-summary-label">Severity Levels</div>
          <div className="lva-summary-value-small">{analyticsData.severity.length} levels detected</div>
        </div>
        <div className="lva-summary-card">
          <div className="lva-summary-label">Services</div>
          <div className="lva-summary-value-small">{analyticsData.services.length} services</div>
        </div>
      </div>

      <div className="lva-tabs">
        {[
          { key: 'hourly', label: 'Hourly Trends' },
          { key: 'daily', label: 'Daily Trends' },
          { key: 'severity', label: 'Severity Distribution' },
          { key: 'services', label: 'Service-wise Breakdown' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`lva-tab ${activeTab === tab.key ? 'lva-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="lva-chart-container">
        {activeTab === 'hourly' && (
          <div className="lva-chart-card">
            <div className="lva-chart-header">
              <h3>Hourly Log Volume</h3>
              <button className="lva-export-btn" onClick={() => exportChart('hourly')}>
                📥 Export CSV
              </button>
            </div>
            {analyticsData.hourly.length === 0 ? (
              <div className="lva-chart-empty">No hourly data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analyticsData.hourly}>
                  <defs>
                    <linearGradient id="lvaGradHourly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00dc9b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00dc9b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,136,0.08)" />
                  <XAxis dataKey="hour" tick={{ fill: '#6ab8a8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6ab8a8', fontSize: 10 }} />
                  <Tooltip content={<TooltipBox />} />
                  <Area type="monotone" dataKey="count" name="Log Count" stroke="#00dc9b" fill="url(#lvaGradHourly)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {activeTab === 'daily' && (
          <div className="lva-chart-card">
            <div className="lva-chart-header">
              <h3>Daily Log Volume</h3>
              <button className="lva-export-btn" onClick={() => exportChart('daily')}>
                📥 Export CSV
              </button>
            </div>
            {analyticsData.daily.length === 0 ? (
              <div className="lva-chart-empty">No daily data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,136,0.08)" />
                  <XAxis dataKey="date" tick={{ fill: '#6ab8a8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6ab8a8', fontSize: 10 }} />
                  <Tooltip content={<TooltipBox />} />
                  <Bar dataKey="count" name="Log Count" fill="#00dc9b" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {activeTab === 'severity' && (
          <div className="lva-chart-card">
            <div className="lva-chart-header">
              <h3>Severity Distribution</h3>
              <button className="lva-export-btn" onClick={() => exportChart('severity')}>
                📥 Export CSV
              </button>
            </div>
            {analyticsData.severity.length === 0 ? (
              <div className="lva-chart-empty">No severity data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.severity}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {analyticsData.severity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipBox />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {activeTab === 'services' && (
          <div className="lva-chart-card">
            <div className="lva-chart-header">
              <h3>Service-wise Breakdown</h3>
              <button className="lva-export-btn" onClick={() => exportChart('services')}>
                📥 Export CSV
              </button>
            </div>
            {analyticsData.services.length === 0 ? (
              <div className="lva-chart-empty">No service data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.services}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,136,0.08)" />
                  <XAxis dataKey="service" tick={{ fill: '#6ab8a8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6ab8a8', fontSize: 10 }} />
                  <Tooltip content={<TooltipBox />} />
                  <Bar dataKey="count" name="Request Count">
                    {analyticsData.services.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default LogVolumeAnalytics;

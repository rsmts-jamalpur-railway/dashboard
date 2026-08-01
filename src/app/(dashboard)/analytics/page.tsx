'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import { FiBook, FiDownload } from 'react-icons/fi';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import classes from './page.module.css';

interface MovementLog {
  log_id: number;
  asset_number: string;
  from_location: string | null;
  to_location: string;
  previous_status: string | null;
  new_status: string;
  timestamp: string;
}

interface Asset {
  current_location: string | null;
  current_status: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function AnalyticsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [logs, setLogs] = useState<MovementLog[]>([]);
  const [locationData, setLocationData] = useState<{name: string, value: number}[]>([]);
  const [statusData, setStatusData] = useState<{name: string, value: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setLoading(true);
        let url = '/reports/movements-data';
        if (startDate && endDate) {
          url += `?startDate=${startDate}&endDate=${endDate}`;
        }
        
        const [movementsRes, distributionRes] = await Promise.all([
          api.get(url),
          api.get('/reports/distribution')
        ]);

        if (movementsRes.data.success) {
          setLogs(movementsRes.data.data || []);
        }
        if (distributionRes.data.success) {
          const distData = distributionRes.data.data;
          // Sort by highest value
          const locs = (distData.locations || []).map((l: any) => ({
            name: l.name || 'Transit',
            value: l.value
          })).sort((a: any, b: any) => b.value - a.value);

          const stats = (distData.statuses || []).sort((a: any, b: any) => b.value - a.value);

          setLocationData(locs);
          setStatusData(stats);
        }
      } catch (err) {
        toast.error('Failed to fetch historical data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, [startDate, endDate]);

  // --- DATA AGGREGATION FOR CHARTS ---

  // 1. Daily Arrivals vs Dispatches
  const exportToPDF = async () => {
    const input = document.getElementById('analytics-dashboard');
    if (!input) return;
    try {
      const canvas = await html2canvas(input, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.text(`RSMTS Analytics Report (${startDate} to ${endDate})`, 14, 15);
      pdf.addImage(imgData, 'PNG', 10, 20, pdfWidth - 20, pdfHeight - 20);
      pdf.save(`analytics_report_${startDate}_to_${endDate}.pdf`);
    } catch (err) {
      toast.error('Export Failed', 'Could not generate PDF report.');
    }
  };

  const dailyData = useMemo(() => {
    const dailyMap: Record<string, { arrivals: number; dispatches: number }> = {};
    
    // Initialize map with all dates in range
    let currDate = new Date(startDate);
    const end = new Date(endDate);
    while (currDate <= end) {
      dailyMap[currDate.toISOString().split('T')[0]] = { arrivals: 0, dispatches: 0 };
      currDate.setDate(currDate.getDate() + 1);
    }

    logs.forEach(log => {
      const dateStr = new Date(log.timestamp).toISOString().split('T')[0];
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { arrivals: 0, dispatches: 0 };
      }

      // Arrived means it's an external intake
      if (['NSY IN', 'GIF IN', 'CRANE IN'].includes(log.new_status)) {
        dailyMap[dateStr].arrivals += 1;
      }
      // Dispatched means it left the workshop entirely
      if (['NSY OUT', 'GIF OUT', 'CRANE OUT'].includes(log.new_status)) {
        dailyMap[dateStr].dispatches += 1;
      }
    });

    return Object.entries(dailyMap).map(([date, data]) => ({
      date,
      'Arrivals': data.arrivals,
      'Dispatches': data.dispatches
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, startDate, endDate]);

  // 2. Process Flow Transitions
  const transitionData = useMemo(() => {
    const flowMap: Record<string, number> = {};
    logs.forEach(log => {
      const from = log.previous_status || 'External';
      const to = log.new_status || 'Unknown';
      const flowKey = `${from} ➔ ${to}`;
      flowMap[flowKey] = (flowMap[flowKey] || 0) + 1;
    });

    return Object.entries(flowMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 transitions
  }, [logs]);

  // 3. Current Asset Location Distribution
  // Location and Status Data are now fetched directly from DB Aggregation

  return (
    <div className={classes.container}>
      <div className={classes.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className={classes.title}>Strategic Analytics</h1>
        <button 
          onClick={exportToPDF} 
          style={{ background: 'var(--color-primary-action)', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FiDownload /> Export PDF Report
        </button>
      </div>

      {/* Date Filters */}
      <div className={classes.filters}>
        <div className={classes.filterGroup}>
          <label>Start Date</label>
          <input 
            type="date" 
            className={classes.filterInput}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className={classes.filterGroup}>
          <label>End Date</label>
          <input 
            type="date" 
            className={classes.filterInput}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className={classes.emptyState}>Generating reports...</div>
      ) : (
        <div id="analytics-dashboard" className={classes.grid} style={{ padding: '16px', backgroundColor: 'var(--color-bg)' }}>
          
          {/* Chart 1: Workshop In vs Workshop Out */}
          <div className={classes.card} style={{ gridColumn: 'span 2' }}>
            <h2>Daily Workshop In vs Workshop Out (Performance Trend)</h2>
            <div className={classes.chartContainerLarge} style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid stroke="#f5f5f5" strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="Arrivals" barSize={30} fill="#8884d8" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Dispatches" stroke="#ff7300" strokeWidth={3} dot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Current Location Distribution (Moved next to Chart 1) */}
          <div className={classes.card} style={{ gridColumn: 'span 1' }}>
            <h2>Active Assets by Location</h2>
            <div className={classes.chartContainerSmall} style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={locationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value, percent }: any) => `${name || 'Unknown'}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                    fontSize={12}
                  >
                    {locationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Top Process Transitions */}
          <div className={classes.card} style={{ gridColumn: 'span 2' }}>
            <h2>Top Movement Paths (Identify Bottlenecks)</h2>
            <div className={classes.chartContainerLarge} style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={transitionData} layout="vertical" margin={{ top: 20, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" fill="#82ca9d" radius={[0, 4, 4, 0]}>
                    {transitionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Current Status Distribution (Moved next to Chart 2) */}
          <div className={classes.card} style={{ gridColumn: 'span 1' }}>
            <h2>Active Assets by Status</h2>
            <div className={classes.chartContainerSmall} style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    dataKey="value"
                    label={({ name, value, percent }: any) => `${(name || '').replace(/_/g, ' ')}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                    fontSize={12}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      <div style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 300, color: 'var(--color-text-secondary)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-secondary)', fontWeight: 400 }}><FiBook style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Analytics Terminology Reference</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
          <div>Arrivals / Dispatches: Overall intake (NSY IN) vs dispatch (NSY OUT) throughput</div>
          <div>Top Movement Paths: Most frequent transitions between statuses (e.g. SHOP IN ➔ FIT)</div>
          <div>Location Distribution: Heatmap of where wagons are physically stuck</div>
          <div>Status Distribution: Overview of active wagon repair lifecycles</div>
          <div>NSY: New Sick Yard (Initial triage location)</div>
          <div>SHOP IN / FIT: Wagon is actively being repaired or marked complete</div>
          <div>GIF / CRANE: New manufacturing origins</div>
        </div>
      </div>

    </div>
  );
}

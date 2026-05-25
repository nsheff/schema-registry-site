import { useState, useRef } from 'react';

const WORKER_URL = 'https://schema-registry-site.nsheff.workers.dev';

const WORKER_BASE = typeof window !== 'undefined' && window.location.hostname.endsWith('.workers.dev')
  ? ''
  : WORKER_URL;

const DEFAULT_TARGET = 'https://nsheff.github.io/schema-registry-site/api';

interface ResultEvent {
  name: string;
  passed: boolean;
  duration_ms: number;
  description?: string;
  error?: string;
  recommended?: boolean;
}

interface SummaryEvent {
  total: number;
  passed: number;
  failed: number;
  required_passed: number;
  required_failed: number;
  recommended_passed: number;
  recommended_failed: number;
}

export function Compliance() {
  const [targetUrl, setTargetUrl] = useState('');
  const [results, setResults] = useState<ResultEvent[]>([]);
  const [summary, setSummary] = useState<SummaryEvent | null>(null);
  const [total, setTotal] = useState(0);
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'required' | 'recommended'>('required');
  const eventSourceRef = useRef<EventSource | null>(null);

  const runCompliance = () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setSummary(null);
    setTotal(0);
    setServerUrl('');

    const target = targetUrl.trim() || DEFAULT_TARGET;
    const url = `${WORKER_BASE}/compliance?target=${encodeURIComponent(target)}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'start') {
        setTotal(data.total);
        setServerUrl(data.server_url);
      } else if (data.type === 'result') {
        setResults((prev) => [...prev, data]);
      } else if (data.type === 'done') {
        setSummary(data);
        setLoading(false);
        es.close();
      } else if (data.type === 'error') {
        setError(data.message);
        setLoading(false);
        es.close();
      }
    };

    es.onerror = () => {
      if (!summary) {
        setError('Connection lost or server unavailable');
      }
      setLoading(false);
      es.close();
    };
  };

  const stopCompliance = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setLoading(false);
  };

  const requiredResults = results.filter((r) => !r.recommended);
  const recommendedResults = results.filter((r) => r.recommended);
  const requiredPassed = requiredResults.filter((r) => r.passed).length;
  const requiredFailed = requiredResults.filter((r) => !r.passed).length;
  const recommendedPassed = recommendedResults.filter((r) => r.passed).length;
  const recommendedFailed = recommendedResults.filter((r) => !r.passed).length;
  const completed = results.length;

  const isCompliant = summary ? summary.required_failed === 0 : requiredFailed === 0 && requiredResults.length > 0;

  return (
    <div>
      <h2>Compliance Test Runner</h2>
      <p className="text-muted">
        Run GA4GH Schema Registry specification compliance checks against any server.
        Required checks must pass for full compliance; recommended checks are optional.
      </p>

      <div className="card">
        <div className="input-row">
          <div className="input-group">
            <label htmlFor="targetUrl">Target Server URL</label>
            <input
              type="text"
              id="targetUrl"
              placeholder={`Leave empty to test ${DEFAULT_TARGET}`}
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) runCompliance();
              }}
              disabled={loading}
            />
          </div>
          <div className="button-group">
            {loading ? (
              <button className="btn-stop" onClick={stopCompliance}>
                Stop ({completed}/{total})
              </button>
            ) : (
              <button className="btn-primary" onClick={runCompliance}>
                Run Compliance Tests
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {(results.length > 0 || loading) && (
        <div className="results-section">
          <div className="summary-card">
            {summary && (
              <div className={`compliance-status ${isCompliant ? 'compliant' : 'non-compliant'}`}>
                {isCompliant ? 'COMPLIANT' : 'NOT COMPLIANT'}
              </div>
            )}
            <div className="summary-stats">
              <div className="stat-group">
                <div className="stat-group-label">Required</div>
                <div className="stat-row">
                  <div className="stat">
                    <span className="stat-value stat-pass">{requiredPassed}</span>
                    <span className="stat-label">Passed</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value stat-fail">{requiredFailed}</span>
                    <span className="stat-label">Failed</span>
                  </div>
                </div>
              </div>
              <div className="stat-group">
                <div className="stat-group-label">Recommended</div>
                <div className="stat-row">
                  <div className="stat">
                    <span className="stat-value stat-pass">{recommendedPassed}</span>
                    <span className="stat-label">Passed</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value stat-fail">{recommendedFailed}</span>
                    <span className="stat-label">Failed</span>
                  </div>
                </div>
              </div>
              <div className="stat-group">
                <div className="stat-label">{serverUrl}</div>
                {summary && <div className="stat-label">{new Date().toLocaleString()}</div>}
              </div>
            </div>
            <div className="progress-container">
              <div className="progress-label">Required ({requiredPassed + requiredFailed} checks)</div>
              <div className="progress-bar">
                <div
                  className="progress-pass"
                  style={{ width: `${requiredResults.length > 0 ? (requiredPassed / requiredResults.length) * 100 : 0}%` }}
                />
                <div
                  className="progress-fail"
                  style={{ width: `${requiredResults.length > 0 ? (requiredFailed / requiredResults.length) * 100 : 0}%` }}
                />
              </div>
              <div className="progress-label">Recommended ({recommendedPassed + recommendedFailed} checks)</div>
              <div className="progress-bar">
                <div
                  className="progress-pass"
                  style={{ width: `${recommendedResults.length > 0 ? (recommendedPassed / recommendedResults.length) * 100 : 0}%` }}
                />
                <div
                  className="progress-fail"
                  style={{ width: `${recommendedResults.length > 0 ? (recommendedFailed / recommendedResults.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="tab-bar">
            <button
              className={`tab ${activeTab === 'required' ? 'active' : ''}`}
              onClick={() => setActiveTab('required')}
            >
              Required ({requiredPassed}/{requiredResults.length})
            </button>
            <button
              className={`tab ${activeTab === 'recommended' ? 'active' : ''}`}
              onClick={() => setActiveTab('recommended')}
            >
              Recommended ({recommendedPassed}/{recommendedResults.length})
            </button>
          </div>

          <div className="results-list">
            {(activeTab === 'required' ? requiredResults : recommendedResults).map((result, idx) => (
              <div
                key={idx}
                className={`result-item ${result.passed ? '' : 'result-failed'} ${result.recommended ? 'result-recommended' : ''}`}
              >
                <div className="result-content">
                  <div className="result-header">
                    <span className={`badge ${result.passed ? 'badge-pass' : 'badge-fail'}`}>
                      {result.passed ? 'PASS' : 'FAIL'}
                    </span>
                    <span className="result-name">{result.name}</span>
                  </div>
                  {result.description && (
                    <div className="result-description">{result.description}</div>
                  )}
                  {result.error && (
                    <div className="result-error">
                      <code>{result.error}</code>
                    </div>
                  )}
                </div>
                <span className="result-duration">{result.duration_ms}ms</span>
              </div>
            ))}
            {loading && completed < total && (
              <div className="result-item result-loading">
                Running check {completed + 1} of {total}...
              </div>
            )}
            {!loading && (activeTab === 'required' ? requiredResults : recommendedResults).length === 0 && (
              <div className="result-item result-loading">
                No {activeTab} checks.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

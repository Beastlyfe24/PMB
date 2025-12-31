'use client';

import { useState, useEffect } from 'react';
import { HealthStatus } from '@polymarket-mirror/shared';

const API_BASE = '/api';

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setHealth(data);
    } catch (error) {
      console.error('Failed to load health:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !health) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">System Health</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Safety Controls */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Safety Controls
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">DRY RUN:</span>
              <span
                className={`font-semibold ${
                  health.dryRun ? 'text-yellow-600' : 'text-green-600'
                }`}
              >
                {health.dryRun ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Kill Switch:</span>
              <span
                className={`font-semibold ${
                  health.killSwitch ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {health.killSwitch ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          </div>
        </div>

        {/* WebSockets */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            WebSocket Connections
          </h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600 dark:text-gray-400">Book Ticker:</span>
                <span
                  className={`font-semibold ${
                    health.websockets.bookTicker.connected
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {health.websockets.bookTicker.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Subscribed tokens: {health.websockets.bookTicker.subscribedTokens}
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600 dark:text-gray-400">RTDS:</span>
                <span
                  className={`font-semibold ${
                    health.websockets.rtds.connected ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {health.websockets.rtds.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Subscribed leaders: {health.websockets.rtds.subscribedLeaders}
              </div>
            </div>
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Queue Status
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Waiting:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {health.queue.waiting}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {health.queue.active}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Completed:</span>
              <span className="font-semibold text-green-600">
                {health.queue.completed}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Failed:</span>
              <span className="font-semibold text-red-600">{health.queue.failed}</span>
            </div>
          </div>
        </div>

        {/* Ingest Status */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Event Ingest
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Last Event:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {health.ingest.lastEventAt
                  ? new Date(health.ingest.lastEventAt).toLocaleTimeString()
                  : 'Never'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Events (5 min):</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {health.ingest.eventsLast5Min}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Errors:</span>
              <span
                className={`font-semibold ${
                  health.ingest.errorCount > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {health.ingest.errorCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

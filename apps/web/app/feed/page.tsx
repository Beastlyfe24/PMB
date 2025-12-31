'use client';

import { useState, useEffect } from 'react';

const API_BASE = '/api';

interface FeedEvent {
  id: string;
  leaderId: string;
  type: string;
  side: string | null;
  usdcSize: number | null;
  occurredAt: string;
  seenAt: string;
  leader: {
    label: string;
  };
  mirrorIntent?: {
    status: string;
    computed: any;
    orders: any[];
  };
}

export default function FeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();

    // Set up SSE connection
    const eventSource = new EventSource(`${API_BASE}/sse/feed`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'leader_event') {
          setEvents((prev) => [data.data, ...prev].slice(0, 100));
        }
      } catch (error) {
        console.error('SSE parse error:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const loadEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/events?limit=50`);
      const data = await res.json();
      setEvents(data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      SIMULATED: 'bg-blue-100 text-blue-800',
      PLACED: 'bg-green-100 text-green-800',
      FILLED: 'bg-green-100 text-green-800',
      SKIPPED: 'bg-gray-100 text-gray-800',
      FAILED: 'bg-red-100 text-red-800',
    };

    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const calculateLatency = (event: FeedEvent) => {
    if (!event.mirrorIntent?.orders?.[0]?.placedAt) {
      return null;
    }

    const seenMs = new Date(event.seenAt).getTime();
    const placedMs = new Date(event.mirrorIntent.orders[0].placedAt).getTime();
    return placedMs - seenMs;
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Live Feed</h1>

      <div className="space-y-4">
        {events.map((event) => {
          const latency = calculateLatency(event);

          return (
            <div
              key={event.id}
              className="bg-white dark:bg-gray-800 shadow rounded-lg p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {event.leader.label}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        event.side === 'BUY'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {event.side}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      ${event.usdcSize?.toFixed(2)}
                    </span>
                  </div>

                  {event.mirrorIntent && (
                    <div className="mt-3 flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(
                          event.mirrorIntent.status
                        )}`}
                      >
                        {event.mirrorIntent.status}
                      </span>

                      {event.mirrorIntent.computed && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Our size: ${event.mirrorIntent.computed.usdcSize?.toFixed(2)} @{' '}
                          {event.mirrorIntent.computed.limitPrice?.toFixed(4)}
                        </span>
                      )}

                      {latency !== null && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Latency: {latency}ms
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                  <div>{new Date(event.occurredAt).toLocaleTimeString()}</div>
                  <div className="text-xs">
                    Seen: {new Date(event.seenAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

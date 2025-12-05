"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { getBankLogo } from '@/lib/bank-logos';
declare const google: any;

type Card = {
  id: number;
  card_number: string;
  cardholder_name: string;
  bank_name: string;
  bank_logo: string | null;
  expiry_date: string | null;
  country_code: string | null;
  country_name: string | null;
  state_code: string | null;
  state_name: string | null;
  city: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function Home() {
  const [filters, setFilters] = useState({ country: '', state: '', cardNumber: '', bankName: '', cardholder: '' });
  const [data, setData] = useState<{ rows: Card[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ countries: string[]; states: string[] }>({ countries: [], states: [] });
  const [offset, setOffset] = useState(0);
  const limit = 100;
  const [showHeatmap, setShowHeatmap] = useState(false);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const heatmapRef = useRef<any>(null);
  const logoLoadingRef = useRef<Set<string>>(new Set());
  const canvasResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bankLogos, setBankLogos] = useState<Record<string, string | null>>({});
  const loader = useMemo(
    () =>
      new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        version: "weekly",
        libraries: ["visualization", "marker"],
      }),
    []
  );

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    p.set('limit', String(limit));
    p.set('offset', String(offset));
    return p.toString();
  }, [filters, offset, limit, refreshKey]);

  // Fetch filtered cards
  useEffect(() => {
    setLoading(true);
    fetch(`/api/cards?${queryString}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [queryString]);

  // Fetch options (countries/states)
  useEffect(() => {
    const url = filters.country ? `/api/options?country=${encodeURIComponent(filters.country)}` : '/api/options';
    fetch(url)
      .then((r) => r.json())
      .then((d) => setOptions(d))
      .catch(() => {});
  }, [filters.country]);

  // Load bank logos
  useEffect(() => {
    const loadLogos = async () => {
      const logosToLoad: Array<{ bankName: string; cardId: number }> = [];
      data.rows.forEach((card) => {
        const key = `${card.id}-${card.bank_name}`;
        if (!card.bank_logo && !bankLogos[key] && !logoLoadingRef.current.has(key)) {
          logosToLoad.push({ bankName: card.bank_name, cardId: card.id });
          logoLoadingRef.current.add(key);
        }
      });

      if (logosToLoad.length === 0) return;
      const batchSize = 10;
      for (let i = 0; i < logosToLoad.length; i += batchSize) {
        const batch = logosToLoad.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async ({ bankName, cardId }) => {
            try {
              const logo = await getBankLogo(bankName, null);
              const key = `${cardId}-${bankName}`;
              setBankLogos((prev) => (prev[key] ? prev : { ...prev, [key]: logo }));
            } catch (error) {
              const key = `${cardId}-${bankName}`;
              setBankLogos((prev) => (prev[key] ? prev : { ...prev, [key]: null }));
            }
          })
        );
      }
    };

    loadLogos();
  }, [data.rows]);

  // Google Map initialization and markers
  useEffect(() => {
    let map: any;
    let heatmap: any;

    const initializeMap = async () => {
      try {
        await loader.load();

        const mapEl = document.getElementById(window.innerWidth >= 1024 ? 'map-desktop' : 'map-mobile');
        if (!mapEl) return;

        map = new google.maps.Map(mapEl, { center: { lat: 0, lng: 0 }, zoom: 2 });
        mapRef.current = map;

        // Clear previous markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        // Create bounds
        const bounds = new google.maps.LatLngBounds();

        data.rows.forEach((card) => {
          if (card.latitude && card.longitude) {
            const marker = new google.maps.Marker({
              position: { lat: card.latitude, lng: card.longitude },
              map,
              title: card.cardholder_name,
            });
            markersRef.current.push(marker);
            bounds.extend(marker.getPosition()!);
          }
        });

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds);
        } else {
          map.setCenter({ lat: 0, lng: 0 });
          map.setZoom(2);
        }

        // Heatmap
        if (showHeatmap) {
          heatmap = new google.maps.visualization.HeatmapLayer({
            data: data.rows.filter(c => c.latitude && c.longitude).map(c => new google.maps.LatLng(c.latitude!, c.longitude!)),
            map,
          });
          heatmapRef.current = heatmap;
        }
      } catch (err) {
        console.error('Google Maps failed to initialize', err);
      }
    };

    setTimeout(initializeMap, 0);

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, [loader, data.rows, showHeatmap]);

  // Handle window resize
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (mapRef.current && typeof google !== 'undefined' && google.maps) {
          try {
            const center = mapRef.current.getCenter();
            if (center) mapRef.current.setCenter(center);
          } catch {}
        }
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, []);

  const hasNext = offset + limit < data.total;
  const hasPrev = offset > 0;

  const getCardLogo = (card: Card) => {
    const key = `${card.id}-${card.bank_name}`;
    return bankLogos[key] || card.bank_logo;
  };

  const onExportCsv = () => {
    const headers = ['bank_name','card_number','cardholder_name','country_name','state_name','city','expiry_date','owner_email','owner_phone'];
    const lines = [headers.join(',')].concat(
      data.rows.map((r) => headers.map((h) => JSON.stringify((r as any)[h] ?? '')).join(','))
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cards.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ----------------- RENDER -----------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* MOBILE & DESKTOP LAYOUTS ARE KEPT THE SAME */}
      {/* ... ALL YOUR MOBILE & DESKTOP JSX HERE ... */}
      {/* The only change is that now markers automatically move the map center */}
    </div>
  );
}

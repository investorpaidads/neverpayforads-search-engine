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
  const [refreshKey, setRefreshKey] = useState(0);
  const [bankLogos, setBankLogos] = useState<Record<string, string | null>>({});
  const loader = useMemo(() => new Loader({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    version: "weekly",
    libraries: ["visualization", "places"]
  }), []);

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
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [queryString]);

  // Fetch filter options
  useEffect(() => {
    const url = filters.country ? `/api/options?country=${encodeURIComponent(filters.country)}` : '/api/options';
    fetch(url)
      .then(r => r.json())
      .then(d => setOptions(d))
      .catch(() => {});
  }, [filters.country]);

  // Load bank logos
  useEffect(() => {
    const loadLogos = async () => {
      const logosToLoad: Array<{ bankName: string; cardId: number }> = [];
      data.rows.forEach(card => {
        const key = `${card.id}-${card.bank_name}`;
        if (!card.bank_logo && !bankLogos[key] && !logoLoadingRef.current.has(key)) {
          logosToLoad.push({ bankName: card.bank_name, cardId: card.id });
          logoLoadingRef.current.add(key);
        }
      });
      if (!logosToLoad.length) return;
      const batchSize = 10;
      for (let i = 0; i < logosToLoad.length; i += batchSize) {
        const batch = logosToLoad.slice(i, i + batchSize);
        await Promise.all(batch.map(async ({ bankName, cardId }) => {
          try {
            const logo = await getBankLogo(bankName, null);
            const key = `${cardId}-${bankName}`;
            setBankLogos(prev => prev[key] ? prev : { ...prev, [key]: logo });
          } catch {
            const key = `${cardId}-${bankName}`;
            setBankLogos(prev => prev[key] ? prev : { ...prev, [key]: null });
          }
        }));
      }
    };
    loadLogos();
  }, [data.rows]);

  // Google Map initialization
  useEffect(() => {
    let map: any;
    let heatmap: any;
    const initializeMap = async () => {
      try {
        await loader.load();
        const mapEl = document.getElementById(window.innerWidth >= 1024 ? 'map-desktop' : 'map-mobile');
        if (!mapEl) return;

        const europeCenter = { lat: 50.1109, lng: 8.6821 };
        map = new google.maps.Map(mapEl, { center: europeCenter, zoom: 4, styles: [
          { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
          { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] }
        ]});
        mapRef.current = map;

        // Clear old markers
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        // Create markers and info windows
        const bounds = new google.maps.LatLngBounds();
        data.rows.forEach(card => {
          if (card.latitude && card.longitude) {
            const marker = new google.maps.Marker({
              position: { lat: card.latitude, lng: card.longitude },
              map,
              title: card.cardholder_name,
            });
            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="min-width:200px;">
                <strong>${card.cardholder_name}</strong><br/>
                ${card.bank_name}<br/>
                ${card.card_number}<br/>
                ${[card.city, card.country_name].filter(Boolean).join(', ')}
              </div>`
            });
            marker.addListener('click', () => infoWindow.open(map, marker));
            markersRef.current.push(marker);
            bounds.extend(marker.getPosition());
          }
        });

        if (!bounds.isEmpty()) map.fitBounds(bounds);

        // Marker clustering
        if (markersRef.current.length > 0) {
          const clusterer = new window.MarkerClusterer(map, markersRef.current, {
            imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'
          });
        }

        // Heatmap
        if (showHeatmap) {
          heatmap = new google.maps.visualization.HeatmapLayer({
            data: data.rows.filter(c => c.latitude && c.longitude).map(c => new google.maps.LatLng(c.latitude!, c.longitude!)),
            map,
          });
          heatmapRef.current = heatmap;
        }

        // Search box
        const input = document.getElementById('map-search') as HTMLInputElement;
        if (input) {
          const searchBox = new google.maps.places.SearchBox(input);
          map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
          searchBox.addListener('places_changed', () => {
            const places = searchBox.getPlaces();
            if (!places || places.length === 0) return;
            const bounds = new google.maps.LatLngBounds();
            places.forEach(p => p.geometry?.location && bounds.extend(p.geometry.location));
            map.fitBounds(bounds);
          });
        }
      } catch (err) {
        console.error('Google Maps failed to initialize', err);
      }
    };

    setTimeout(initializeMap, 0);

    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, [loader, data.rows, showHeatmap]);

  // Window resize handler
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (mapRef.current) {
          const center = mapRef.current.getCenter();
          if (center) mapRef.current.setCenter(center);
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
  const getCardLogo = (card: Card) => bankLogos[`${card.id}-${card.bank_name}`] || card.bank_logo;

  const onExportCsv = () => {
    const headers = ['bank_name','card_number','cardholder_name','country_name','state_name','city','expiry_date','owner_email','owner_phone'];
    const lines = [headers.join(',')].concat(
      data.rows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(','))
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

  // ------------------ RENDER ------------------
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Map search input */}
      <input
        id="map-search"
        placeholder="Search location..."
        className="absolute z-50 mt-4 ml-4 px-3 py-2 rounded-md shadow-md border border-gray-300 w-64 bg-white"
      />

      {/* Desktop */}
      <div className="hidden lg:flex h-screen">
        {/* Sidebar filters */}
        <div className="w-80 bg-white shadow-sm border-r border-gray-200 p-6 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-6">Credit Card Database</h1>
          <div className="space-y-4">
            {['Country','State','Card Number','Bank Name','Cardholder'].map((label, idx) => (
              <div key={idx}>
                <label className="block text-xs font-semibold mb-1">{label}</label>
                {label === 'Country' || label === 'State' ? (
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    value={label==='Country'?filters.country:filters.state}
                    onChange={e => setFilters(f => ({ ...f, [label.toLowerCase()]: e.target.value, ...(label==='Country'?{state:''}:{}) }))}
                  >
                    <option value="">All {label}s</option>
                    {(label==='Country'?options.countries:options.states)?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder={label}
                    value={(filters as any)[label.replace(' ','').toLowerCase()]}
                    onChange={e => setFilters(f => ({ ...f, [label.replace(' ','').toLowerCase()]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-auto p-6 space-y-6">
          {/* Map */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="font-bold text-lg">🌍 Map Overview</h3>
              <div className="flex gap-2">
                <button onClick={() => setRefreshKey(k => k+1)} className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200">🔄 Refresh</button>
                <button onClick={onExportCsv} className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white">📊 Export</button>
              </div>
            </div>
            <div id="map-desktop" className="w-full h-[400px]" />
          </div>

          {/* Cards Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold">Bank</th>
                  <th className="px-6 py-3 text-left text-xs font-bold">Card Number</th>
                  <th className="px-6 py-3 text-left text-xs font-bold">Cardholder</th>
                  <th className="px-6 py-3 text-left text-xs font-bold">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-bold">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-bold">Contact</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 flex items-center gap-2">
                      {getCardLogo(r) ? <img src={getCardLogo(r)!} alt={r.bank_name} className="w-10 h-10 rounded-md object-contain"/> :
                        <div className="w-10 h-10 rounded-md bg-red-500 flex items-center justify-center text-white font-bold">{r.bank_name?.charAt(0)}</div>}
                      {r.bank_name}
                    </td>
                    <td className="px-6 py-4 font-mono">{r.card_number}</td>
                    <td className="px-6 py-4">{r.cardholder_name}</td>
                    <td className="px-6 py-4">{[r.city,r.state_name,r.country_name].filter(Boolean).join(', ') || 'Unknown'}</td>
                    <td className="px-6 py-4">{r.expiry_date}</td>
                    <td className="px-6 py-4 space-y-1">{r.owner_email && <div>📧 {r.owner_email}</div>}{r.owner_phone && <div>📱 {r.owner_phone}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.total > limit && (
            <div className="flex justify-center items-center gap-4">
              <button disabled={!hasPrev} onClick={() => setOffset(offset-limit)} className="px-3 py-1 rounded-md border">{'‹ Prev'}</button>
              <span>{Math.floor(offset/limit)+1} of {Math.ceil(data.total/limit)}</span>
              <button disabled={!hasNext} onClick={() => setOffset(offset+limit)} className="px-3 py-1 rounded-md border">{'Next ›'}</button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden p-4 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          <input id="map-search" placeholder="Search location..." className="w-full border rounded-md px-3 py-2"/>
          <div className="flex justify-between items-center">
            <button onClick={() => setRefreshKey(k => k+1)} className="px-3 py-1 rounded-md bg-gray-100">🔄 Refresh</button>
            <button onClick={onExportCsv} className="px-3 py-1 rounded-md bg-blue-600 text-white">📊 Export</button>
          </div>
        </div>
        <div id="map-mobile" className="w-full h-[300px] rounded-lg shadow-sm bg-white"/>
        {/* Cards list */}
        <div className="space-y-3">
          {data.rows.map(r => (
            <div key={r.id} className="bg-white rounded-lg shadow-sm p-3">
              <div className="flex items-center gap-3">
                {getCardLogo(r) ? <img src={getCardLogo(r)!} alt={r.bank_name} className="w-12 h-12 rounded-md"/> :
                  <div className="w-12 h-12 rounded-md bg-red-500 flex items-center justify-center text-white font-bold">{r.bank_name?.charAt(0)}</div>}
                <div>
                  <div className="font-semibold">{r.cardholder_name}</div>
                  <div className="text-sm">{r.bank_name}</div>
                  <div className="font-mono text-sm">{r.card_number}</div>
                  <div className="text-xs text-gray-500">{[r.city,r.country_name].filter(Boolean).join(', ') || 'Unknown'}</div>
                  <div className="text-xs text-gray-500">{r.owner_email && <>📧 {r.owner_email}</>}</div>
                  <div className="text-xs text-gray-500">{r.owner_phone && <>📱 {r.owner_phone}</>}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

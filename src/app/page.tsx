"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { getBankLogo } from "@/lib/bank-logos";

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
  const [filters, setFilters] = useState({
    country: "",
    state: "",
    cardNumber: "",
    bankName: "",
    cardholder: "",
  });
  const [data, setData] = useState<{ rows: Card[]; total: number }>({
    rows: [],
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ countries: string[]; states: string[] }>({
    countries: [],
    states: [],
  });
  const [offset, setOffset] = useState(0);
  const limit = 100;
  const [showHeatmap, setShowHeatmap] = useState(false);

  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const heatmapRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);

  const logoLoadingRef = useRef<Set<string>>(new Set());
  const [bankLogos, setBankLogos] = useState<Record<string, string | null>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const loader = useMemo(
    () =>
      new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        version: "weekly",
        libraries: ["visualization"],
      }),
    []
  );

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    p.set("limit", String(limit));
    p.set("offset", String(offset));
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
    const url = filters.country
      ? `/api/options?country=${encodeURIComponent(filters.country)}`
      : "/api/options";
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
            } catch {
              const key = `${cardId}-${bankName}`;
              setBankLogos((prev) => (prev[key] ? prev : { ...prev, [key]: null }));
            }
          })
        );
      }
    };

    loadLogos();
  }, [data.rows]);

  // Google Map initialization
  useEffect(() => {
    let map: any;
    let heatmap: any;
    let markerCluster: any;

    const initializeMap = async () => {
      try {
        await loader.load();
        const mapEl = document.getElementById(window.innerWidth >= 1024 ? "map-desktop" : "map-mobile");
        if (!mapEl) return;

        // Center on Europe
        map = new google.maps.Map(mapEl, {
          center: { lat: 50.1109, lng: 8.6821 }, // Frankfurt, Europe
          zoom: 4,
        });
        mapRef.current = map;

        // Clear previous markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        // Add markers
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

        if (!bounds.isEmpty()) map.fitBounds(bounds);

        // Clusterer
        if (markersRef.current.length > 0) {
          markerCluster = new MarkerClusterer({ map, markers: markersRef.current });
          clusterRef.current = markerCluster;
        }

        // Heatmap
        if (showHeatmap) {
          heatmap = new google.maps.visualization.HeatmapLayer({
            data: data.rows
              .filter((c) => c.latitude && c.longitude)
              .map((c) => new google.maps.LatLng(c.latitude!, c.longitude!)),
            map,
          });
          heatmapRef.current = heatmap;
        }
      } catch (err) {
        console.error("Google Maps failed to initialize", err);
      }
    };

    initializeMap();

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (heatmapRef.current) heatmapRef.current.setMap(null);
      if (clusterRef.current) clusterRef.current.clearMarkers();
    };
  }, [loader, data.rows, showHeatmap]);

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        const center = mapRef.current.getCenter();
        if (center) mapRef.current.setCenter(center);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hasNext = offset + limit < data.total;
  const hasPrev = offset > 0;

  const getCardLogo = (card: Card) => {
    const key = `${card.id}-${card.bank_name}`;
    return bankLogos[key] || card.bank_logo;
  };

  const onExportCsv = () => {
    const headers = [
      "bank_name",
      "card_number",
      "cardholder_name",
      "country_name",
      "state_name",
      "city",
      "expiry_date",
      "owner_email",
      "owner_phone",
    ];
    const lines = [headers.join(",")].concat(
      data.rows.map((r) => headers.map((h) => JSON.stringify((r as any)[h] ?? "")).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cards.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Layout */}
      <div className="hidden lg:flex h-screen">
        <div className="w-80 bg-white shadow-sm border-r border-gray-200 overflow-y-auto p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight">Credit Card Database</h1>
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">Country</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={filters.country}
                onChange={(e) => setFilters({ ...filters, country: e.target.value, state: "" })}
              >
                <option value="">All Countries</option>
                {options?.countries?.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">State</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={filters.state}
                onChange={(e) => setFilters({ ...filters, state: e.target.value })}
              >
                <option value="">All States</option>
                {options?.states?.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-auto p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 tracking-tight">🌍 Map</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div> Locations
                  <input type="radio" className="hidden" checked={!showHeatmap} onChange={() => setShowHeatmap(false)} />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div> Heatmap
                  <input type="radio" className="hidden" checked={showHeatmap} onChange={() => setShowHeatmap(true)} />
                </label>
                <button onClick={() => setRefreshKey((k) => k + 1)} className="px-4 py-2 bg-gray-100 rounded-md">🔄 Refresh</button>
                <button onClick={onExportCsv} className="px-4 py-2 bg-blue-600 text-white rounded-md">📊 Export</button>
              </div>
            </div>
            <div id="map-desktop" className="w-full h-[500px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

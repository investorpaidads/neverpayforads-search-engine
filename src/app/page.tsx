"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const normalIcon = {
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg width="48" height="64" viewBox="0 0 48 64">
        <ellipse cx="24" cy="58" rx="14" ry="6" fill="rgba(0,0,0,0.25)" />
        <path d="M24 0C14 0 6 8 6 18c0 12 18 36 18 36s18-24 18-36C42 8 34 0 24 0z"
              fill="#EA4335"/>
        <circle cx="24" cy="18" r="7" fill="white"/>
      </svg>
    `),
  scaledSize: new google.maps.Size(40, 54),
  anchor: new google.maps.Point(20, 54),
};

const highlightIcon = {
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg width="48" height="64" viewBox="0 0 48 64">
        <ellipse cx="24" cy="58" rx="16" ry="8" fill="rgba(255,215,0,0.5)" />
        <path d="M24 0C14 0 6 8 6 18c0 12 18 36 18 36s18-24 18-36C42 8 34 0 24 0z"
              fill="#FFD700"/>
        <circle cx="24" cy="18" r="7" fill="white"/>
      </svg>
    `),
  scaledSize: new google.maps.Size(46, 60),
  anchor: new google.maps.Point(23, 60),
};

const handleRowClick = (card: Card) => {
  if (!mapRef.current || !card.latitude || !card.longitude) return;

  const pos = { lat: card.latitude, lng: card.longitude };

  // 1. Move map to marker center
  mapRef.current.panTo(pos);
  mapRef.current.setZoom(12);

  // 2. Update selected marker
  setSelectedId(card.id);

  // 3. Change marker icon immediately
  markersRef.current.forEach((m) => {
    if (m.cardId === card.id) {
      m.setIcon(highlightIcon);
      m.setZIndex(2000);
    } else {
      m.setIcon(normalIcon);
      m.setZIndex(1000);
    }
  });
};

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
  const logoLoadingRef = useRef<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [bankLogos, setBankLogos] = useState<Record<string, string | null>>({});

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

  // Fetch cards
  useEffect(() => {
    setLoading(true);
    fetch(`/api/cards?${queryString}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [queryString]);

  // Fetch options
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
      if (!logosToLoad.length) return;

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

  // Initialize Google Map
  useEffect(() => {
    let map: any;
    let heatmap: any;

    const initializeMap = async () => {
      try {
        await loader.load();
        const mapEl = document.getElementById(window.innerWidth >= 1024 ? "map-desktop" : "map-mobile");
        if (!mapEl) return;

        map = new google.maps.Map(mapEl, { center: { lat: 0, lng: 0 }, zoom: 2 });
        mapRef.current = map;

        // Clear previous markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const bounds = new google.maps.LatLngBounds();


        data.rows.forEach((card) => {
          if (card.latitude && card.longitude) {
            const pos = { lat: card.latitude, lng: card.longitude };
            const marker = new google.maps.Marker({
              position: { lat: card.latitude, lng: card.longitude },
              map,
              title: card.cardholder_name,
              icon:card.id === selectedId ? highlightIcon : normalIcon,
                optimized: false, // <-- important
              mapPaneName: "overlayMouseTarget",
  zIndex: 1000
            });
                markersRef.current.push(marker);
    bounds.extend(pos);
            marker.addListener("click", () => {
  marker.setAnimation(google.maps.Animation.BOUNCE);
  setTimeout(() => marker.setAnimation(null), 1400); // stop bounce
});
            marker.cardId = card.id;
            markersRef.current.push(marker);
            bounds.extend(marker.getPosition());
          }
        });

        if (!bounds.isEmpty()) map.fitBounds(bounds);

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
    };
  }, [loader, data.rows, showHeatmap]);

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

  const hasNext = offset + limit < data.total;
  const hasPrev = offset > 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Desktop & Mobile UI */}
      <div className="lg:flex">
        {/* Sidebar */}
        <div className="lg:w-80 bg-white shadow-sm border-r border-gray-200 p-6">
          <h1 className="text-2xl font-bold mb-6 tracking-tight">Credit Card Database</h1>
          <div className="space-y-4">
            {/* Country */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider">Country</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.country}
                onChange={(e) => setFilters({ ...filters, country: e.target.value, state: "" })}
              >
                <option value="">All Countries</option>
                {options?.countries?.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider">State</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.state}
                onChange={(e) => setFilters({ ...filters, state: e.target.value })}
              >
                <option value="">All States</option>
                {options?.states?.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Card Number */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider">Card Number</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="193"
                value={filters.cardNumber}
                onChange={(e) => setFilters({ ...filters, cardNumber: e.target.value })}
              />
            </div>

            {/* Bank */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider">Bank</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="CIMB"
                value={filters.bankName}
                onChange={(e) => setFilters({ ...filters, bankName: e.target.value })}
              />
            </div>

            {/* Cardholder */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider">Cardholder</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Abdul"
                value={filters.cardholder}
                onChange={(e) => setFilters({ ...filters, cardholder: e.target.value })}
              />
            </div>

            <button
              className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold mt-2 hover:bg-blue-700 transition-all"
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 space-y-6">
          {/* Map */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-lg">🌍 Geographic Distribution</h2>
              <div className="flex items-center gap-2">
                <button
                  className={`px-3 py-1 text-sm rounded-md ${!showHeatmap ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                  onClick={() => setShowHeatmap(false)}
                >
                  Locations
                </button>
                <button
                  className={`px-3 py-1 text-sm rounded-md ${showHeatmap ? "bg-red-500 text-white" : "bg-gray-200"}`}
                  onClick={() => setShowHeatmap(true)}
                >
                  Density
                </button>
                <button
                  className="px-3 py-1 text-sm rounded-md bg-green-500 text-white"
                  onClick={onExportCsv}
                >
                  📊 Export
                </button>
              </div>
            </div>
            <div id="map-desktop" className="w-full h-[400px] rounded-md" />
          </div>

          {/* Cards Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Bank</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Card Number</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Cardholder</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Contact</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.rows.map((r) => (
                  <tr key={r.id} onClick={() => handleRowClick(r)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getCardLogo(r) ? (
                          <img src={getCardLogo(r)!} className="h-10 w-10 rounded-lg object-contain" alt={r.bank_name} />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-300 flex items-center justify-center">
                            {r.bank_name?.charAt(0) || "B"}
                          </div>
                        )}
                        <span>{r.bank_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono">{r.card_number}</td>
                    <td className="px-6 py-4">{r.cardholder_name}</td>
                    <td className="px-6 py-4">
                      {[r.city, r.state_name, r.country_name].filter(Boolean).join(", ")}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">
                        {r.expiry_date}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {r.owner_email && <div>📧 {r.owner_email}</div>}
                      {r.owner_phone && <div>📱 {r.owner_phone}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

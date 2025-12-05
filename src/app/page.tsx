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
        libraries: ["visualization", "marker"],
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

  // Google Map
  useEffect(() => {
    let map: any;
    let heatmap: any;
    const initializeMap = async () => {
      try {
        await loader.load();
        const mapEl = document.getElementById(window.innerWidth >= 1024 ? "map-desktop" : "map-mobile");
        if (!mapEl) return;
        map = new google.maps.Map(mapEl, { center: { lat: 48.8566, lng: 2.3522 }, zoom: 4 }); // Centered in Europe
        mapRef.current = map;

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        const bounds = new google.maps.LatLngBounds();
        data.rows.forEach((card) => {
          if (card.latitude && card.longitude) {
            const marker = new google.maps.Marker({
              position: { lat: card.latitude, lng: card.longitude },
              map,
              title: card.cardholder_name,
              icon: {
                url: "/marker.svg",
                scaledSize: new google.maps.Size(32, 32),
              },
            });
            markersRef.current.push(marker);
            bounds.extend(marker.getPosition()!);
          }
        });
        if (!bounds.isEmpty()) map.fitBounds(bounds);
        else map.setCenter({ lat: 48.8566, lng: 2.3522 });

        if (showHeatmap) {
          heatmap = new google.maps.visualization.HeatmapLayer({
            data: data.rows
              .filter((c) => c.latitude && c.longitude)
              .map((c) => new google.maps.LatLng(c.latitude!, c.longitude!)),
            map,
            radius: 40,
          });
          heatmapRef.current = heatmap;
        }
      } catch (err) {
        console.error("Google Maps failed to initialize", err);
      }
    };
    setTimeout(initializeMap, 0);
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (heatmapRef.current) heatmapRef.current.setMap(null);
      heatmapRef.current = null;
    };
  }, [loader, data.rows, showHeatmap]);

  // Helpers
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

  // ----------------- RENDER -----------------
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {/* Top Filters */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-4">
          💳 Credit Card Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            value={filters.country}
            onChange={(e) => setFilters({ ...filters, country: e.target.value, state: "" })}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          >
            <option value="">All Countries</option>
            {options.countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          >
            <option value="">All States</option>
            {options.states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Card Number"
            value={filters.cardNumber}
            onChange={(e) => setFilters({ ...filters, cardNumber: e.target.value })}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          />
          <input
            type="text"
            placeholder="Bank Name"
            value={filters.bankName}
            onChange={(e) => setFilters({ ...filters, bankName: e.target.value })}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          />
          <input
            type="text"
            placeholder="Cardholder"
            value={filters.cardholder}
            onChange={(e) => setFilters({ ...filters, cardholder: e.target.value })}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          />
        </div>
      </div>

      {/* Map */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="rounded-xl overflow-hidden shadow-lg">
          <div id="map-desktop" className="w-full h-[500px] rounded-xl" />
        </div>
      </div>

      {/* Cards Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">💳 Card Records</h2>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 transition"
              onClick={onExportCsv}
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cardholder
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {getCardLogo(r) ? (
                          <img
                            className="h-10 w-10 rounded-full object-cover border border-gray-200"
                            src={getCardLogo(r)!}
                            alt={r.bank_name}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center">
                            {r.bank_name?.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-medium">{r.bank_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono">{r.card_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{r.cardholder_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {[r.city, r.state_name, r.country_name].filter(Boolean).join(", ")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        {r.expiry_date}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {r.owner_email && <span>📧 {r.owner_email}</span>}
                        {r.owner_phone && <span>📱 {r.owner_phone}</span>}
                      </div>
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

                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Cardholder</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Contact</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
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

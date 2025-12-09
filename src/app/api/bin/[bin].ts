import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { bin } = req.query;
  if (!bin || typeof bin !== "string") {
    return res.status(400).json({ error: "Missing BIN" });
  }

  try {
    const response = await fetch(`https://lookup.binlist.net/${bin}`, {
      headers: { "Accept-Version": "3" },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "BIN lookup failed" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { bank } = req.query;
  if (!bank || typeof bank !== "string") return res.status(400).end();

  // Normalize bank name
  const name = bank.toLowerCase().replace(/[^a-z0-9]/g, "");
  const url = `https://logo.clearbit.com/${name}.com`; // Example, or any URL

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(404).end();

    // Forward image bytes
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // cache 1 day
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
}

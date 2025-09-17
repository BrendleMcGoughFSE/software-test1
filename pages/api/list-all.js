// pages/api/list-all.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;

    if (!url || !key) {
      return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE' });
    }

    const supabase = createClient(url, key);

    const [c, p, f] = await Promise.all([
      supabase.from('customers').select('*').order('created_at'),
      supabase.from('projects').select('*').order('created_at'),
      supabase.from('files').select('*').order('created_at', { ascending: false }),
    ]);

    if (c.error || p.error || f.error) {
      const err = (c.error || p.error || f.error).message;
      return res.status(500).json({ error: 'Supabase query failed: ' + err });
    }

    res.json({
      customers: c.data || [],
      projects: p.data || [],
      files: f.data || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unexpected server error' });
  }
}

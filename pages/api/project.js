import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    const supabase = createClient(url, key);

    const { customer_id, name } = req.body || {};
    if (!customer_id || !name) return res.status(400).json({ error: 'customer_id and name required' });

    const { data, error } = await supabase.from('projects').insert({ customer_id, name }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
}


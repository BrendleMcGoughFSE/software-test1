import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { project_id, filename } = req.body || {};
    if (!project_id || !filename) return res.status(400).json({ error: 'project_id and filename required' });

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    const bucket = process.env.SUPABASE_BUCKET || 'reports';
    if (!url || !key) return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE' });

    const supabase = createClient(url, key);

    const slug = uuidv4().slice(0, 8);
    const path = `uploads/${project_id}/${slug}/${Date.now()}-${filename}`;

    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ ok: true, slug, path, signedUrl: data.signedUrl, bucket });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unexpected server error' });
  }
}

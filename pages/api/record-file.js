import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, project_id, slug, path, file_id } = req.body || {};
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!url || !key) return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE' });

    const supabase = createClient(url, key);

    if (action === 'insert') {
      if (!project_id || !slug || !path) return res.status(400).json({ error: 'project_id, slug, path required' });
      const { data, error } = await supabase
        .from('files')
        .insert({ project_id, slug, storage_path: path })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, id: data.id });
    }

    if (action === 'update') {
      if (!file_id || !path) return res.status(400).json({ error: 'file_id and path required' });
      const { data, error } = await supabase
        .from('files')
        .update({ storage_path: path })
        .eq('id', file_id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, id: data.id });
    }

    return res.status(400).json({ error: 'invalid action' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unexpected server error' });
  }
}


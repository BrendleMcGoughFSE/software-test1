import { createClient } from '@supabase/supabase-js';
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const { file_id } = req.body||{};
  if(!file_id) return res.status(400).json({error:'file_id required'});
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const bucket = process.env.SUPABASE_BUCKET || 'reports';
  const { data: row, error: fetchErr } = await supabase.from('files').select('*').eq('id', file_id).single();
  if(fetchErr || !row) return res.status(404).json({ error:'File not found' });
  await supabase.storage.from(bucket).remove([row.storage_path]);
  const { error: delErr } = await supabase.from('files').delete().eq('id', file_id);
  if(delErr) return res.status(500).json({ error: delErr.message });
  res.json({ ok:true });
}

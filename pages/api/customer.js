import { createClient } from '@supabase/supabase-js';
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const { name } = req.body||{};
  if(!name) return res.status(400).json({error:'name required'});
  const { data, error } = await supabase.from('customers').insert({ name }).select().single();
  if(error) return res.status(500).json({error:error.message});
  res.json({ ok:true, data });
}

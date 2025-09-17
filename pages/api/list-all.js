import { createClient } from '@supabase/supabase-js';
export default async function handler(req,res){
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const [c,p,f]=await Promise.all([
    supabase.from('customers').select('*').order('created_at'),
    supabase.from('projects').select('*').order('created_at'),
    supabase.from('files').select('*').order('created_at',{ascending:false})
  ]);
  res.json({ customers:c.data||[], projects:p.data||[], files:f.data||[] });
}

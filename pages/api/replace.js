import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

function parseMultipart(req){
  return new Promise((resolve,reject)=>{
    let data=Buffer.alloc(0);
    req.on('data',chunk=> data=Buffer.concat([data,chunk]));
    req.on('end',()=>{
      const ct=req.headers['content-type']||''; const m=ct.match(/boundary=(.*)$/); if(!m) return reject(new Error('No boundary'));
      const boundary='--'+m[1];
      const parts=data.toString('binary').split(boundary).slice(1,-1);
      let file_id=null, fileBuf=null, filename='report.pdf';
      for(const p of parts){
        const headEnd=p.indexOf('\r\n\r\n'); const head=p.slice(0,headEnd); const body=p.slice(headEnd+4,p.length-2);
        if(/name="file_id"/.test(head)){ file_id=body.toString(); }
        else if(/name="file"/.test(head)){ const fname=head.match(/filename="([^"]+)"/); filename=(fname&&fname[1])||filename; fileBuf=Buffer.from(body,'binary'); }
      }
      if(!file_id||!fileBuf) return reject(new Error('Missing file_id or file'));
      resolve({ file_id, fileBuf, filename });
    });
    req.on('error',reject);
  });
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const { file_id, fileBuf, filename } = await parseMultipart(req);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    const bucket = process.env.SUPABASE_BUCKET || 'reports';
    const { data: row, error: fetchErr } = await supabase.from('files').select('*').eq('id', file_id).single();
    if(fetchErr || !row) return res.status(404).json({ error:'File not found' });
    const path = `uploads/${row.project_id}/${row.slug}/${Date.now()}-${filename}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, fileBuf, { contentType:'application/pdf' });
    if(upErr) return res.status(500).json({ error: upErr.message });
    const { data: updated, error: updbErr } = await supabase.from('files').update({ storage_path:path }).eq('id', file_id).select().single();
    if(updbErr) return res.status(500).json({ error: updbErr.message });
    res.json({ ok:true, file: updated });
  }catch(e){ res.status(400).json({ error:e.message||'Bad request' }); }
}

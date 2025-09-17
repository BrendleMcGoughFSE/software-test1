import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export const config = { api: { bodyParser: false } };

function parseMultipart(req){
  return new Promise((resolve,reject)=>{
    let data=Buffer.alloc(0);
    req.on('data',chunk=> data=Buffer.concat([data,chunk]));
    req.on('end',()=>{
      const ct=req.headers['content-type']||'';
      const m=ct.match(/boundary=(.*)$/); if(!m) return reject(new Error('No boundary'));
      const boundary='--'+m[1];
      const parts=data.toString('binary').split(boundary).slice(1,-1);
      let project_id=null, fileBuf=null, filename='report.pdf';
      for(const p of parts){
        const headEnd=p.indexOf('\r\n\r\n'); const head=p.slice(0,headEnd); const body=p.slice(headEnd+4,p.length-2);
        if(/name="project_id"/.test(head)){ project_id=body.toString(); }
        else if(/name="file"/.test(head)){ const fname=head.match(/filename="([^"]+)"/); filename=(fname&&fname[1])||filename; fileBuf=Buffer.from(body,'binary'); }
      }
      if(!project_id||!fileBuf) return reject(new Error('Missing project_id or file'));
      resolve({ project_id, fileBuf, filename });
    });
    req.on('error',reject);
  });
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const { project_id, fileBuf, filename } = await parseMultipart(req);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    const bucket = process.env.SUPABASE_BUCKET || 'reports';
    const slug = uuidv4().slice(0,8);
    const path = `uploads/${project_id}/${slug}/${Date.now()}-${filename}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, fileBuf, { contentType:'application/pdf' });
    if(upErr) return res.status(500).json({ error: upErr.message });
    const { data, error } = await supabase.from('files').insert({ project_id, slug, storage_path:path }).select().single();
    if(error) return res.status(500).json({ error: error.message });
    res.json({ ok:true, slug: data.slug, id: data.id });
  }catch(e){ res.status(400).json({ error:e.message||'Bad request' }); }
}

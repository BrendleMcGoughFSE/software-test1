import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export async function getServerSideProps(ctx){
  const { slug } = ctx.query;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const { data: row, error } = await supabase.from('files').select('storage_path, project_id').eq('slug', slug).maybeSingle();
  if (error || !row) return { notFound: true };
  const bucket = process.env.SUPABASE_BUCKET || 'reports';
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(row.storage_path, 60*60);
  // Fetch customer/project for display and for prefill
  const { data: proj } = await supabase.from('projects').select('id, name, customer_id').eq('id', row.project_id).single();
  const { data: cust } = await supabase.from('customers').select('id, name').eq('id', proj.customer_id).single();
  return { props: { slug, signedUrl: signed?.signedUrl || null, projectId: proj?.id || null, customerName: cust?.name || '', projectName: proj?.name || '' } };
}

export default function Viewer({ slug, signedUrl, projectId, customerName, projectName }){
  const next = `/inspect?project_id=${projectId||''}`;
  return (
    <div className="container">
      <div className="header">
        <img src="/logo.png" alt="Logo"/>
        <div style={{flex:1}}>
          <h2>Inspection Document</h2>
          <div className="small">Customer: {customerName} • Project: {projectName}</div>
        </div>
        <Link href={`/login?next=${encodeURIComponent(next)}`}><button className="primary">Brendle & McGough Login</button></Link>
      </div>
      <div className="card">
        <div style={{height:'80vh'}}>
          <iframe src={signedUrl} style={{width:'100%',height:'100%',border:'1px solid #e5e7eb',borderRadius:8}}/>
        </div>
        <div className="small" style={{marginTop:8}}>This public page always shows the current version for /r/{slug}.</div>
      </div>
    </div>
  )
}

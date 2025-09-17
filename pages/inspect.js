import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';

export default function Inspect(){
  const [customers,setCustomers]=useState([]);
  const [projects,setProjects]=useState([]);
  const [form,setForm]=useState({project_id:'', facilityName:'', address:'', inspectionType:'Semi-Annual', inspectorName:'', managerName:'', notes:''});
  const [photos,setPhotos]=useState([]);
  const [sigInspector,setSigInspector]=useState(null); const [sigManager,setSigManager]=useState(null);
  const [uploading,setUploading]=useState(false);
  const [result,setResult]=useState(null); // {slug, url, qr}
  const sig1Ref=useRef(null), sig2Ref=useRef(null); const pad1=useRef(null), pad2=useRef(null);
  const previewRef=useRef(null);

  useEffect(()=>{
    if(sig1Ref.current && !pad1.current) pad1.current=new SignaturePad(sig1Ref.current,{backgroundColor:'#fff'});
    if(sig2Ref.current && !pad2.current) pad2.current=new SignaturePad(sig2Ref.current,{backgroundColor:'#fff'});
    (async()=>{
      const r=await fetch('/api/list-all'); const d=await r.json();
      setCustomers(d.customers||[]); setProjects(d.projects||[]);
      // Prefill from ?project_id=
      const params=new URLSearchParams(window.location.search);
      const pid=params.get('project_id');
      if(pid){ setForm(f=>({...f, project_id:pid})); }
    })();
  },[]);

  useEffect(()=>{
    // If project chosen, prefill facility/address from project name conventions if desired (placeholder)
    // In a real app, you'd add address fields to projects table and fetch here.
  },[form.project_id]);

  const onChange=e=>setForm({...form,[e.target.name]:e.target.value});
  const addPhoto=e=>{const f=e.target.files?.[0]; if(!f) return; setPhotos(p=>[...p,{file:f,url:URL.createObjectURL(f)}]); e.target.value='';};
  const captureSigs=()=>{ if(pad1.current && !pad1.current.isEmpty()) setSigInspector(pad1.current.toDataURL('image/png')); if(pad2.current && !pad2.current.isEmpty()) setSigManager(pad2.current.toDataURL('image/png')); };

  const prompts=[
    "Hood and duct system free of grease accumulation",
    "Filters installed and clean",
    "Exhaust fan operating properly",
    "Fire suppression system inspection tag current",
    "Nozzle caps in place and oriented correctly",
    "Class K extinguisher present and tagged",
  ];
  const [results,setResults]=useState(prompts.map(()=> 'PASS'));
  const setRes=(i,val)=>setResults(r=>r.map((x,idx)=> idx===i?val:x));

  const generatePDF=async(slugForQR)=>{
    captureSigs();
    const node=previewRef.current;
    // Insert QR (data URL) in header block before render-to-image
    let qrData=null;
    if(slugForQR){
      const url=`${location.origin}/r/${slugForQR}`;
      qrData = await QRCode.toDataURL(url,{margin:1,scale:4});
    }
    const canvas=await html2canvas(node,{scale:2});
    const img=canvas.toDataURL('image/png');
    const pdf=new jsPDF('p','pt','letter');
    const PW=612, PH=792, imgW=PW-60, imgH=(canvas.height*imgW)/canvas.width;
    pdf.addImage(img,'PNG',30,30,imgW,imgH);
    if(qrData){
      // Place QR top-right in the PDF margin area
      pdf.addImage(qrData,'PNG', PW-30-100, 30, 100, 100);
    }
    let remaining=imgH-(PH-60);
    while(remaining>0){ pdf.addPage(); const srcY=(imgH-remaining); pdf.addImage(img,'PNG',30,30-srcY,imgW,imgH); remaining-= (PH-60); }
    return pdf;
  };

  const upload=async()=>{
    if(!form.project_id) return alert('Select a project for association.');
    setUploading(true);
    try{
      // First call ingest without file to get slug? Simpler: upload with temp, then we receive slug and create QR in second step:
      // We'll generate PDF first without QR, upload, receive slug, then regen PDF WITH QR and replace file (so QR embedded).
      const pdf0 = await generatePDF(null);
      const blob0=new Blob([pdf0.output('arraybuffer')],{type:'application/pdf'});
      let body=new FormData();
      body.set('project_id', form.project_id);
      body.set('file', new File([blob0], (form.facilityName||'Report')+'.pdf', {type:'application/pdf'}));
      let r=await fetch('/api/ingest',{method:'POST',body});
      let d=await r.json();
      if(!d.ok) throw new Error(d.error||'Upload failed');
      const slug=d.slug;
      // Regenerate with QR embedded
      const pdf = await generatePDF(slug);
      const blob=new Blob([pdf.output('arraybuffer')],{type:'application/pdf'});
      body=new FormData();
      body.set('file_id', d.id);
      body.set('file', new File([blob], (form.facilityName||'Report')+'.pdf', {type:'application/pdf'}));
      r=await fetch('/api/replace',{method:'POST',body});
      d=await r.json();
      if(!d.ok) throw new Error(d.error||'Replace failed');
      const url=`${location.origin}/r/${slug}`;
      const qr=await QRCode.toDataURL(url,{margin:1,scale:6});
      setResult({ slug, url, qr });
      window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'});
    }catch(e){ alert(e.message); }
    finally{ setUploading(false); }
  };

  return (
    <div className="container">
      <div className="header">
        <img src="/logo.png" alt="Logo"/>
        <div>
          <h2>New Inspection</h2>
          <div className="small">Brendle & McGough Fire & Safety Equipment</div>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div className="col">
            <label>Project (prefilled if you came from a QR login)</label>
            <select name="project_id" value={form.project_id} onChange={onChange} required>
              <option value="">Select…</option>
              {projects.map(p=> <option key={p.id} value={p.id}>{p.name} — {customers.find(c=>c.id===p.customer_id)?.name}</option>)}
            </select>
          </div>
          <div className="col">
            <label>Facility Name</label>
            <input name="facilityName" value={form.facilityName} onChange={onChange} placeholder="Joe's BBQ"/>
          </div>
          <div className="col">
            <label>Address</label>
            <input name="address" value={form.address} onChange={onChange} placeholder="123 Main St, Birmingham, AL"/>
          </div>
        </div>
        <div className="row">
          <div className="col">
            <label>Inspection Type</label>
            <select name="inspectionType" value={form.inspectionType} onChange={onChange}>
              <option>Semi-Annual</option><option>Annual</option><option>Other</option>
            </select>
          </div>
          <div className="col">
            <label>Inspector Name</label>
            <input name="inspectorName" value={form.inspectorName} onChange={onChange} placeholder="Your Name"/>
          </div>
          <div className="col">
            <label>Manager/Rep Name</label>
            <input name="managerName" value={form.managerName} onChange={onChange} placeholder="Facility Rep"/>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>PASS / FAIL Checklist</h3>
        {prompts.map((p,i)=>(
          <div key={i} className="row" style={{alignItems:'center'}}>
            <div className="col"><span>{i+1}. {p}</span></div>
            <div className="col">
              <select value={results[i]} onChange={e=>setRes(i,e.target.value)}>
                <option>PASS</option><option>FAIL</option>
              </select>
            </div>
          </div>
        ))}
        <label>Deficiencies Noted</label>
        <textarea name="notes" rows={3} value={form.notes} onChange={onChange} placeholder="(1) ...(2) ..."/>
      </div>

      <div className="card">
        <h3>Photos</h3>
        <input type="file" accept="image/*" capture="environment" onChange={addPhoto}/>
        <div className="row">
          {photos.map((ph,i)=><div key={i} className="col"><img src={ph.url} style={{width:'100%',borderRadius:8,border:'1px solid #e5e7eb'}}/></div>)}
        </div>
      </div>

      <div className="card">
        <h3>Signatures</h3>
        <div className="row">
          <div className="col">
            <div className="small"><b>Inspector’s Certification</b></div>
            <div className="small">I certify this inspection was performed to the best of my ability per NFPA 96 and company standards.</div>
            <div className="sig-line"></div>
            <div className="small">Inspector Signature</div>
            <canvas ref={sig1Ref} width={380} height={120}/>
          </div>
          <div className="col">
            <div className="small"><b>Facility Manager Disclaimer</b></div>
            <div className="small">I acknowledge receipt of this inspection report. All items are at Owner’s & General Contractor’s risk. See report notes for deficiencies.</div>
            <div className="sig-line"></div>
            <div className="small">Facility Manager / Representative Signature</div>
            <canvas ref={sig2Ref} width={380} height={120}/>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Preview</h3>
        <div ref={previewRef} className="preview">
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <img src="/logo.png" style={{height:40}}/>
            <div>
              <div style={{fontWeight:800}}>Brendle & McGough Fire & Safety Equipment</div>
              <div className="small">Inspection Report</div>
            </div>
          </div>
          <hr/>
          <div><b>Facility:</b> {form.facilityName}</div>
          <div><b>Address:</b> {form.address}</div>
          <div><b>Type:</b> {form.inspectionType}</div>
          <div><b>Inspector:</b> {form.inspectorName}</div>
          <div><b>Manager:</b> {form.managerName}</div>
          <h4 style={{marginTop:12}}>Checklist</h4>
          <ul className="tight">
            {prompts.map((p,i)=>(<li key={i}>{i+1}. {p} — <b>{results[i]}</b></li>))}
          </ul>
          {form.notes && (<><h4>Deficiencies</h4><div>{form.notes}</div></>)}
          <h4 style={{marginTop:12}}>Photos</h4>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {photos.map((ph,i)=>(<img key={i} src={ph.url} style={{width:'100%',border:'1px solid #eee',borderRadius:6}}/>))}
          </div>
          <hr/>
          <div className="small"><b>Inspector’s Certification:</b> I certify this inspection was performed to the best of my ability per NFPA 96 and company standards.</div>
          <div className="small"><b>Facility Manager Disclaimer:</b> All items are transported & stored at Owner’s & General Contractor’s risk. See report notes.</div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap'}}>
          <button className="primary" disabled={uploading} onClick={upload}>{uploading?'Generating & Uploading…':'Generate, Upload & Embed QR'}</button>
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>Public Link & QR</h3>
          <div className="small">Share this link or QR. Your team can use the Login button on that page to start a new inspection with project prefilled.</div>
          <p><a href={result.url} target="_blank" rel="noreferrer">{result.url}</a></p>
          <img className="qr" src={result.qr} alt="QR"/>
        </div>
      )}
    </div>
  );
}

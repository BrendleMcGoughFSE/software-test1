import { useEffect, useRef, useState } from 'react';

// Browser-only libs loaded dynamically so SSR/build won't crash
let SigPad, jsPDF, html2canvas, QRCode;

export default function Inspect() {
  const [libsReady, setLibsReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    project_id: '',
    facilityName: '',
    address: '',
    inspectionType: 'Semi-Annual',
    inspectorName: '',
    managerName: '',
    notes: ''
  });

  const sig1Ref = useRef(null);
  const sig2Ref = useRef(null);
  const sigPad1 = useRef(null);
  const sigPad2 = useRef(null);
  const previewRef = useRef(null);

  const isBrowser = typeof window !== 'undefined';
  const origin = isBrowser ? window.location.origin : '';

  // Load customers/projects
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/list-all');
        const text = await r.text();
        let d;
        try { d = JSON.parse(text); }
        catch {
          console.error('Non-JSON from /api/list-all', text);
          alert('Server error loading data. Check env vars + Supabase.');
          return;
        }
        setProjects(d.projects || []);
        setCustomers(d.customers || []);
      } catch (e) {
        console.error(e);
        alert('Network error loading data.');
      }
    };
    load();
  }, []);

  // Dynamically import browser-only libs after mount
  useEffect(() => {
    const loadLibs = async () => {
      if (!isBrowser) return;
      try {
        const sp = await import('signature_pad');
        const jp = await import('jspdf');
        const h2c = await import('html2canvas');
        const qr = await import('qrcode');
        SigPad = sp.default || sp;
        jsPDF = (jp.default || jp).jsPDF || jp;   // handle both exports
        html2canvas = h2c.default || h2c;
        QRCode = qr.default || qr;
        setLibsReady(true);
      } catch (e) {
        console.error('Failed to load libs', e);
        alert('Failed to load required libraries. Try a hard refresh (Ctrl+F5).');
      }
    };
    loadLibs();
  }, [isBrowser]);

  // Init signature pads once libs & canvases are ready
  useEffect(() => {
    if (!libsReady) return;
    if (sig1Ref.current && !sigPad1.current) {
      sigPad1.current = new SigPad(sig1Ref.current, { backgroundColor: '#fff' });
    }
    if (sig2Ref.current && !sigPad2.current) {
      sigPad2.current = new SigPad(sig2Ref.current, { backgroundColor: '#fff' });
    }
  }, [libsReady]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Render the on-screen preview DOM to a PDF; if slug provided, also draw QR onto the PDF
  const generatePDF = async (slugOrNull) => {
    if (!libsReady) throw new Error('Libraries not ready yet');
    const node = previewRef.current;
    const canvas = await html2canvas(node, { scale: 2 });
    const img = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'pt', 'letter');
    const PW = 612, PH = 792;
    const contentW = PW - 60;
    const imgH = (canvas.height * contentW) / canvas.width;

    pdf.addImage(img, 'PNG', 30, 30, contentW, imgH);

    // Optional QR overlay (top-right) if we already know the slug/URL
    if (slugOrNull && origin) {
      const url = `${origin}/r/${slugOrNull}`;
      const qr = await QRCode.toDataURL(url, { margin: 1, scale: 4 });
      pdf.addImage(qr, 'PNG', PW - 30 - 100, 30, 100, 100);
    }

    // Handle multipage if preview taller than 1 page
    let remaining = imgH - (PH - 60);
    while (remaining > 0) {
      pdf.addPage();
      const srcY = (imgH - remaining);
      pdf.addImage(img, 'PNG', 30, 30 - srcY, contentW, imgH);
      remaining -= (PH - 60);
    }
    return pdf;
  };

  // Signed-upload flow: reserve a path + slug, upload to Supabase directly,
  // insert/update DB row, then regenerate PDF with embedded QR
  const upload = async () => {
    if (!form.project_id) return alert('Select a project to associate this report.');
    setUploading(true);
    try {
      // 1) Create preliminary PDF (no QR yet) so we can reserve a path
      const pdf0 = await generatePDF(null);
      const blob0 = new Blob([pdf0.output('arraybuffer')], { type: 'application/pdf' });
      const baseName = (form.facilityName || 'Report') + '.pdf';

      // 2) Ask server for signed URL + slug + storage path
      let r = await fetch('/api/init-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: form.project_id, filename: baseName })
      });
      let d = await r.json();
      if (!d.ok) throw new Error(d.error || 'init-upload failed');
      const { slug, path, signedUrl } = d;

      // 3) Upload preliminary PDF directly to Supabase (bypasses Vercel body-size limit)
      let put = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'content-type': 'application/pdf' },
        body: blob0
      });
      if (!put.ok) throw new Error('Upload to storage failed (preliminary).');

      // 4) Create DB row referencing this path/slug
      r = await fetch('/api/record-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'insert', project_id: form.project_id, slug, path })
      });
      d = await r.json();
      if (!d.ok) throw new Error(d.error || 'record-file insert failed');
      const fileId = d.id;

      // 5) Regenerate PDF WITH QR (using the real slug)
      const pdf = await generatePDF(slug);
      const blob = new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });

      // 6) Get final signed URL (you can keep same filename scheme)
      r = await fetch('/api/init-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: form.project_id, filename: baseName })
      });
      d = await r.json();
      if (!d.ok) throw new Error(d.error || 'init-upload (final) failed');
      const { path: finalPath, signedUrl: finalSignedUrl } = d;

      // 7) Upload final PDF
      put = await fetch(finalSignedUrl, {
        method: 'PUT',
        headers: { 'content-type': 'application/pdf' },
        body: blob
      });
      if (!put.ok) throw new Error('Upload to storage failed (final).');

      // 8) Update DB row to point to final path
      r = await fetch('/api/record-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', file_id: fileId, path: finalPath })
      });
      d = await r.json();
      if (!d.ok) throw new Error(d.error || 'record-file update failed');

      // 9) Show success + QR on screen
      const url = `${origin}/r/${slug}`;
      const qr = await QRCode.toDataURL(url, { margin: 1, scale: 6 });
      setResult({ slug, url, qr });
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      alert(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <img src="/logo.png" alt="Logo" />
        <div>
          <h2>Create Inspection Report</h2>
          <div className="small">Libraries ready: {String(libsReady)}</div>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div className="col">
            <label>Project</label>
            <select name="project_id" value={form.project_id} onChange={onChange}>
              <option value="">Select…</option>
              {projects.map(p => {
                const cust = customers.find(c => c.id === p.customer_id);
                return <option key={p.id} value={p.id}>{p.name} — {cust?.name}</option>;
              })}
            </select>
          </div>
          <div className="col">
            <label>Facility Name</label>
            <input name="facilityName" value={form.facilityName} onChange={onChange} placeholder="Joe's BBQ" />
          </div>
          <div className="col">
            <label>Address</label>
            <input name="address" value={form.address} onChange={onChange} placeholder="123 Main St" />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Checklist (sample)</h3>
        <div className="small">Keep it simple for now — we’re validating the pipeline.</div>
        <textarea name="notes" rows={3} value={form.notes} onChange={onChange} placeholder="Any deficiencies or notes..." />
      </div>

      <div className="card">
        <h3>Signatures</h3>
        <div className="row">
          <div className="col">
            <div className="small"><b>Inspector</b></div>
            <canvas ref={sig1Ref} width={380} height={120} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} />
          </div>
          <div className="col">
            <div className="small"><b>Manager</b></div>
            <canvas ref={sig2Ref} width={380} height={120} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Preview (rendered into PDF)</h3>
        <div ref={previewRef} className="preview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" style={{ height: 40 }} alt="Logo" />
            <div>
              <div style={{ fontWeight: 800 }}>Brendle &amp; McGough Fire &amp; Safety Equipment</div>
              <div className="small">Inspection Report</div>
            </div>
          </div>
          <hr />
          <div><b>Facility:</b> {form.facilityName}</div>
          <div><b>Address:</b> {form.address}</div>
          <div><b>Type:</b> {form.inspectionType}</div>
          <div><b>Inspector:</b> {form.inspectorName}</div>
          <div><b>Manager:</b> {form.managerName}</div>
          {form.notes && (<><h4>Notes</h4><div>{form.notes}</div></>)}
          <hr />
          <div className="small"><b>Inspector’s Certification:</b> NFPA 96 compliance to the best of my ability.</div>
          <div className="small"><b>Facility Manager Disclaimer:</b> Items handled at Owner’s &amp; GC’s risk.</div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="primary" onClick={upload} disabled={!libsReady || uploading}>
            {uploading ? 'Uploading…' : 'Generate, Upload & Embed QR'}
          </button>
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>Public Link & QR</h3>
          <p><a href={result.url} target="_blank" rel="noreferrer">{result.url}</a></p>
          <img className="qr" src={result.qr} alt="QR" />
          <div className="small">This QR points to a stable URL; replacing the PDF keeps the same QR working.</div>
        </div>
      )}
    </div>
  );
}



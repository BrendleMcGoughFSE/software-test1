import { useEffect, useRef, useState } from 'react';

// NOTE: We use dynamic imports for browser-only libs to avoid SSR crashes.
let SigPad, jsPDF, html2canvas, QRCode;

export default function Inspect() {
  const [libsReady, setLibsReady] = useState(false);
  const [form, setForm] = useState({
    project_id: '',
    facilityName: '',
    address: '',
    inspectionType: 'Semi-Annual',
    inspectorName: '',
    managerName: '',
    notes: ''
  });

  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [result, setResult] = useState(null);
  const sig1Ref = useRef(null);
  const sig2Ref = useRef(null);
  const sigPad1 = useRef(null);
  const sigPad2 = useRef(null);
  const previewRef = useRef(null);

  const isBrowser = typeof window !== 'undefined';

  // Load projects/customers
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
        jsPDF = jp.default || jp;
        html2canvas = h2c.default || h2c;
        QRCode = qr.default || qr;
        setLibsReady(true);
      } catch (e) {
        console.error('Failed to load libs', e);
        alert('Failed to load required libraries. Please hard-refresh (Ctrl+F5).');
      }
    };
    loadLibs();
  }, [isBrowser]);

  // Initialize signature pads once canvas is present and libs are ready
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

  // Minimal PDF generation (demo) — no upload, just to prove the page renders safely
  const generateDemoPDF = async () => {
    try {
      if (!libsReady) return alert('Libraries not ready yet. Try again in a second.');
      const node = previewRef.current;
      const canvas = await html2canvas(node, { scale: 2 });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'letter');
      const PW = 612, PH = 792;
      const imgW = PW - 60;
      const imgH = (canvas.height * imgW) / canvas.width;

      pdf.addImage(img, 'PNG', 30, 30, imgW, imgH);
      let remaining = imgH - (PH - 60);
      while (remaining > 0) {
        pdf.addPage();
        const srcY = (imgH - remaining);
        pdf.addImage(img, 'PNG', 30, 30 - srcY, imgW, imgH);
        remaining -= (PH - 60);
      }
      pdf.save('inspection-demo.pdf');

      // Show a placeholder QR pointing to the home page just to verify QR generation works.
      const url = isBrowser ? `${window.location.origin}/` : '/';
      const qr = await QRCode.toDataURL(url, { margin: 1, scale: 6 });
      setResult({ url, qr });
    } catch (e) {
      console.error(e);
      alert('Demo PDF generation failed: ' + (e.message || e));
    }
  };

  return (
    <div className="container">
      <div className="header">
        <img src="/logo.png" alt="Logo" />
        <div><h2>Create Inspection Report</h2><div className="small">If you see this, the page is rendering 😀</div></div>
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
        <h3>Signatures</h3>
        <div className="row">
          <div className="col">
            <div className="small"><b>Inspector Signature</b></div>
            <canvas ref={sig1Ref} width={380} height={120} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} />
          </div>
          <div className="col">
            <div className="small"><b>Manager Signature</b></div>
            <canvas ref={sig2Ref} width={380} height={120} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Preview</h3>
        <div ref={previewRef} className="preview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" style={{ height: 40 }} alt="Logo"/>
            <div>
              <div style={{ fontWeight: 800 }}>Brendle &amp; McGough Fire &amp; Safety Equipment</div>
              <div className="small">Inspection Report (Demo Render)</div>
            </div>
          </div>
          <hr />
          <div><b>Facility:</b> {form.facilityName}</div>
          <div><b>Address:</b> {form.address}</div>
          <div><b>Type:</b> {form.inspectionType}</div>
          <div><b>Inspector:</b> {form.inspectorName}</div>
          <div><b>Manager:</b> {form.managerName}</div>
          <div className="small" style={{ marginTop: 12 }}>
            (If you can see this preview, the page is working. Next we’ll re-enable upload.)
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="primary" onClick={generateDemoPDF}>
            Generate Demo PDF (no upload)
          </button>
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>Demo Link & QR</h3>
          <p><a href={result.url} target="_blank" rel="noreferrer">{result.url}</a></p>
          <img className="qr" src={result.qr} alt="QR" />
        </div>
      )}
    </div>
  );
}



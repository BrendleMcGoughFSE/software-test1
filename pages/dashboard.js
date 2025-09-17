import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [files, setFiles] = useState([]);
  const [qr, setQr] = useState({ slug: '', data: '' });

  // Build-safe guards (Next.js can pre-render on server)
  const isBrowser = typeof window !== 'undefined';
  const origin = isBrowser ? window.location.origin : '';

  const refresh = async () => {
    try {
      const r = await fetch('/api/list-all');
      const text = await r.text();
      let d;
      try { d = JSON.parse(text); }
      catch {
        console.error('Non-JSON from /api/list-all:', text);
        alert('Server error loading data. Check Vercel env vars + Supabase setup.');
        return;
      }
      setCustomers(d.customers || []);
      setProjects(d.projects || []);
      setFiles(d.files || []);
    } catch (err) {
      console.error(err);
      alert('Network error loading data.');
    }
  };

  useEffect(() => { refresh(); }, []);

  const createCustomer = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget; // capture BEFORE await
    const fd = new FormData(formEl);
    const name = fd.get('name');

    try {
      const r = await fetch('/api/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!r.ok) throw new Error(await r.text());
    } catch (err) {
      alert('Create customer failed: ' + (err.message || err));
    } finally {
      formEl?.reset();
      refresh();
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const customer_id = fd.get('customer_id');
    const name = fd.get('name');

    try {
      const r = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id, name })
      });
      if (!r.ok) throw new Error(await r.text());
    } catch (err) {
      alert('Create project failed: ' + (err.message || err));
    } finally {
      formEl?.reset();
      refresh();
    }
  };

  const replacePdf = async (fileId, file) => {
    const body = new FormData();
    body.set('file_id', fileId);
    body.set('file', file);
    try {
      const r = await fetch('/api/replace', { method: 'POST', body });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Replace failed');
      refresh();
    } catch (err) {
      alert('Replace failed: ' + (err.message || err));
    }
  };

  const del = async (id) => {
    if (!confirm('Delete?')) return;
    try {
      const r = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: id })
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Delete failed');
      refresh();
    } catch (err) {
      alert('Delete failed: ' + (err.message || err));
    }
  };

  const showQR = async (slug) => {
    if (!isBrowser) return;
    const url = `${origin}/r/${slug}`;
    const data = await QRCode.toDataURL(url, { margin: 1, scale: 6 });
    setQr({ slug, data });
  };

  // ---------- UI ----------
  return (
    <div className="container">
      <div className="header"><img src="/logo.png" alt="Logo"/><h2>Dashboard</h2></div>

      <div className="card">
        <h3>Create Customer</h3>
        <form onSubmit={createCustomer} className="row">
          <div className="col">
            <label>Name</label>
            <input name="name" required placeholder="Acme Foods" />
          </div>
          <div className="col" style={{ alignSelf: 'end' }}>
            <button type="submit" className="primary">Create</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Create Project</h3>
        <form onSubmit={createProject} className="row">
          <div className="col">
            <label>Customer</label>
            <select name="customer_id" required>
              <option value="">Select…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col">
            <label>Project</label>
            <input name="name" required placeholder="Kitchen Hood — Downtown" />
          </div>
          <div className="col" style={{ alignSelf: 'end' }}>
            <button type="submit" className="primary">Create</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Files</h3>
        <table>
          <thead>
            <tr><th>Customer</th><th>Project</th><th>Slug URL</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {files.map(f => {
              const proj = projects.find(p => p.id === f.project_id);
              const cust = customers.find(c => c.id === proj?.customer_id);
              const fullUrl = origin ? `${origin}/r/${f.slug}` : `/r/${f.slug}`;
              return (
                <tr key={f.id}>
                  <td>{cust?.name}</td>
                  <td>{proj?.name}</td>
                  <td>
                    <a href={`/r/${f.slug}`} target="_blank" rel="noreferrer">/r/{f.slug}</a>
                    <div className="small">{fullUrl}</div>
                  </td>
                  <td>
                    <label className="small" style={{ marginRight: 8 }}>
                      Replace PDF
                      <input type="file" accept="application/pdf"
                        onChange={(e) => e.target.files?.[0] && replacePdf(f.id, e.target.files[0])} />
                    </label>
                    <button type="button" className="ghost" onClick={() => showQR(f.slug)}>Show QR</button>{' '}
                    <button type="button" onClick={() => del(f.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {qr.data && (
          <div className="qr" style={{ marginTop: 12 }}>
            <div><div className="small">QR for /r/{qr.slug}</div><img src={qr.data} alt="QR" /></div>
          </div>
        )}
      </div>
    </div>
  );
}


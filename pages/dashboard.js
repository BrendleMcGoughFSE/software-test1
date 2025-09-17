import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function Dashboard(){
  const [customers,setCustomers]=useState([]);
  const [projects,setProjects]=useState([]);
  const [files,setFiles]=useState([]);
  const [qr,setQr]=useState({slug:'', data:''});

  const refresh=async()=>{
    const r=await fetch('/api/list-all'); const d=await r.json();
    setCustomers(d.customers||[]); setProjects(d.projects||[]); setFiles(d.files||[]);
  };
  useEffect(()=>{refresh();},[]);
const createCustomer = async (e) => {
  e.preventDefault();
  const formEl = e.currentTarget;                 // capture BEFORE any await
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
    formEl?.reset();                              // safe even if component re-rendered
    refresh();                                    // re-fetch table data
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

  };

  const showQR=async(slug)=>{
    const data=await QRCode.toDataURL(`${location.origin}/r/${slug}`,{margin:1,scale:6});
    setQr({slug,data});
  };

  return (
    <div className="container">
      <div className="header"><img src="/logo.png"/><h2>Dashboard</h2></div>
      <div className="card">
        <h3>Create Customer</h3>
        <form onSubmit={createCustomer} className="row">
          <div className="col"><label>Name</label><input name="name" required placeholder="Acme Foods"/></div>
          <div className="col" style={{alignSelf:'end'}}><button className="primary">Create</button></div>
        </form>
      </div>
      <div className="card">
        <h3>Create Project</h3>
        <form onSubmit={createProject} className="row">
          <div className="col"><label>Customer</label>
            <select name="customer_id" required><option value="">Select…</option>
              {customers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col"><label>Project</label><input name="name" required placeholder="Kitchen Hood — Downtown"/></div>
          <div className="col" style={{alignSelf:'end'}}><button className="primary">Create</button></div>
        </form>
      </div>
      <div className="card">
        <h3>Files</h3>
        <table><thead><tr><th>Customer</th><th>Project</th><th>Stable URL</th></tr></thead>
          <tbody>
            {files.map(f=>{
              const proj=projects.find(p=>p.id===f.project_id);
              const cust=customers.find(c=>c.id===proj?.customer_id);
              const url=`${location.origin}/r/${f.slug}`;
              return (
                <tr key={f.id}>
                  <td>{cust?.name}</td>
                  <td>{proj?.name}</td>
                  <td>
                    <a href={`/r/${f.slug}`} target="_blank" rel="noreferrer">{url}</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {qr.data && <div className="qr" style={{marginTop:12}}>
          <div><div className="small">QR for /r/{qr.slug}</div><img src={qr.data} alt="QR"/></div>
        </div>}
      </div>
    </div>
  )
}

import Link from 'next/link';
export default function Home(){
  return (
    <div className="container">
      <div className="header">
        <img src="/logo.png" alt="Logo"/>
        <div>
          <h1>Inspection Cloud (Branded)</h1>
          <div className="small">Brendle & McGough Fire & Safety Equipment</div>
        </div>
      </div>
      <div className="card">
        <p>End-to-end flow:</p>
        <ul>
          <li>Collect photos, signatures, checklist → generate PDF on device</li>
          <li>Upload PDF to server (Supabase Storage)</li>
          <li>Associate with customer/project, get stable URL <code>/r/slug</code> + QR</li>
          <li>Public page shows the current PDF; team can login from there to start a new inspection prefilled for that customer/location.</li>
        </ul>
      </div>
      <div className="card">
        <Link href="/inspect"><button className="primary">Create Inspection Report</button></Link>{' '}
        <Link href="/dashboard"><button>Open Dashboard</button></Link>
      </div>
    </div>
  )
}

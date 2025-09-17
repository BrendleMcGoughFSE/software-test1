import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';

export default function Inspect() {
  // ...your code...
  return (
    <div className="container">
      {/* ...UI... */}
    </div>
  );
}

const upload = async () => {
  if (!form.project_id) return alert('Select a project for association.');
  setUploading(true);
  try {
    const pdf0 = await generatePDF(null);
    const blob0 = new Blob([pdf0.output('arraybuffer')], { type: 'application/pdf' });
    const baseName = (form.facilityName || 'Report') + '.pdf';

    // 1) get signed URL + slug
    let r = await fetch('/api/init-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: form.project_id, filename: baseName })
    });
    let d = await r.json();
    if (!d.ok) throw new Error(d.error || 'init-upload failed');
    const { slug, path, signedUrl } = d;

    // 2) upload preliminary PDF directly to Supabase
    let put = await fetch(signedUrl, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: blob0 });
    if (!put.ok) throw new Error('Upload to storage failed (preliminary).');

    // 3) create DB row
    r = await fetch('/api/record-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'insert', project_id: form.project_id, slug, path })
    });
    d = await r.json();
    if (!d.ok) throw new Error(d.error || 'record-file insert failed');
    const fileId = d.id;

    // 4) regenerate with QR
    const pdf = await generatePDF(slug);
    const blob = new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });

    // 5) new signed URL for the final file
    r = await fetch('/api/init-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: form.project_id, filename: baseName })
    });
    d = await r.json();
    if (!d.ok) throw new Error(d.error || 'init-upload (final) failed');
    const { path: finalPath, signedUrl: finalSignedUrl } = d;

    // 6) upload final
    put = await fetch(finalSignedUrl, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: blob });
    if (!put.ok) throw new Error('Upload to storage failed (final).');

    // 7) update DB row to final path
    r = await fetch('/api/record-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', file_id: fileId, path: finalPath })
    });
    d = await r.json();
    if (!d.ok) throw new Error(d.error || 'record-file update failed');

    // 8) show result
    const url = `${location.origin}/r/${slug}`;
    const qr = await QRCode.toDataURL(url, { margin: 1, scale: 6 });
    setResult({ slug, url, qr });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  } catch (e) {
    alert(e.message);
  } finally {
    setUploading(false);
  }
};


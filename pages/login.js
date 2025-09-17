import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function Login(){
  const [email,setEmail]=useState('');
  const [sent,setSent]=useState(false);
  const router = useRouter();
  const next = router.query.next || '/dashboard';

  const sendLink = async (e) => {
    e.preventDefault();
    const supabase = supabaseBrowser();
    if(!supabase) return alert('Supabase client env vars not set.');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/login-complete?next=' + encodeURIComponent(next) } });
    if (error) return alert(error.message);
    setSent(true);
  };

  return (
    <div className="container">
      <div className="header">
        <img src="/logo.png" alt="Logo"/><h2>Brendle & McGough Login</h2>
      </div>
      <div className="card">
        {!sent ? (
          <form onSubmit={sendLink}>
            <label>Work Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@brendlemcgough.com" required/>
            <div style={{marginTop:12}}><button className="primary">Send Login Link</button></div>
          </form>
        ):(
          <div>Check your email for a magic link.</div>
        )}
      </div>
    </div>
  )
}

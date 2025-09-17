import { useEffect } from 'react';
import { supabaseBrowser } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function LoginComplete(){
  const router = useRouter();
  const next = router.query.next || '/dashboard';

  useEffect(()=>{
    const supabase = supabaseBrowser();
    // On returning from magic link, the session is set by supabase-js. Just redirect.
    const t = setTimeout(()=> router.replace(next), 600);
    return ()=> clearTimeout(t);
  },[router, next]);

  return (
    <div className="container">
      <div className="header"><img src="/logo.png"/><h2>Logging you in…</h2></div>
      <div className="card">If you’re not redirected, go to <a href={next}>{next}</a>.</div>
    </div>
  );
}

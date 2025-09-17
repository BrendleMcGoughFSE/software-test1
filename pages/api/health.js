export default function handler(req, res) {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasRole = !!process.env.SUPABASE_SERVICE_ROLE;
  const bucket = process.env.SUPABASE_BUCKET;
  res.status(200).json({
    ok: hasUrl && hasRole && !!bucket,
    hasUrl, hasRole, bucket
  });
}

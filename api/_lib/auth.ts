import { type SupabaseClient, createClient } from '@supabase/supabase-js';

/**
 * Verifies the request's Supabase JWT and returns a client that acts as that user,
 * so every query is subject to RLS. Returns an error Response when the request can't proceed.
 */
export async function authenticate(request: Request): Promise<SupabaseClient | Response> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const token = authHeader.slice('Bearer '.length);

  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    // Capitalized to match supabase-js internals; a lowercase key gets merged into "Bearer x, Bearer x".
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error } = await client.auth.getUser(token);

  if (error) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  return client;
}

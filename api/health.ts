export async function GET(request: Request): Promise<Response> {
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

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!userResponse.ok) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const user = (await userResponse.json()) as { id: string };
  return Response.json({ userId: user.id });
}

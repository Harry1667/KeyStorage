// API 客戶端：與 PHP 後端溝通

const API_URL = '/api.php';

let sessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

async function request<T>(action: string, body?: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

  const res = await fetch(`${API_URL}?action=${action}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export interface MetaResponse {
  initialized: boolean;
  pbkdf2_salt?: string;
  verify_cipher?: string;
  verify_iv?: string;
  proof_hash?: string;
}

export async function getMeta(): Promise<MetaResponse> {
  return request<MetaResponse>('get_meta');
}

export async function init(data: {
  pbkdf2_salt: string;
  verify_cipher: string;
  verify_iv: string;
  proof_hash: string;
}): Promise<{ ok: boolean }> {
  return request('init', data);
}

export async function verify(proof: string): Promise<{ session_token: string }> {
  return request('verify', { proof });
}

export interface KeyRecord {
  id: number;
  encrypted_data: string;
  iv: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

export async function listKeys(): Promise<KeyRecord[]> {
  const res = await request<{ keys: KeyRecord[] }>('list');
  return res.keys;
}

export async function createKey(data: { encrypted_data: string; iv: string }): Promise<{ id: number }> {
  return request('create', data);
}

export async function updateKey(id: number, data: { encrypted_data: string; iv: string }): Promise<{ ok: boolean }> {
  return request('update', { id, ...data });
}

export async function deleteKey(id: number): Promise<{ ok: boolean }> {
  return request('delete', { id });
}

export async function touchKey(id: number): Promise<{ ok: boolean }> {
  return request('touch', { id });
}

export async function exportKeys(): Promise<{ keys: KeyRecord[]; meta: MetaResponse }> {
  return request('export');
}

export async function importKeys(data: { keys: KeyRecord[] }): Promise<{ ok: boolean }> {
  return request('import', data);
}

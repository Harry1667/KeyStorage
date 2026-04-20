// 端到端加密模組：PBKDF2 + AES-256-GCM

const PBKDF2_ITERATIONS = 100000;
const VERIFY_PLAINTEXT = 'keystorage-verify';

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function generateSalt(): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return toBase64(salt.buffer);
}

export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(key: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  return { ciphertext: toBase64(encrypted), iv: toBase64(iv.buffer) };
}

export async function decrypt(key: CryptoKey, ciphertextB64: string, ivB64: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivB64) },
    key,
    fromBase64(ciphertextB64)
  );
  return new TextDecoder().decode(decrypted);
}

export async function hashProof(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return toBase64(hash);
}

export async function createVerifyCipher(key: CryptoKey): Promise<{ ciphertext: string; iv: string; proofHash: string }> {
  const result = await encrypt(key, VERIFY_PLAINTEXT);
  const proofHash = await hashProof(VERIFY_PLAINTEXT);
  return { ...result, proofHash };
}

export async function verifyPassword(key: CryptoKey, ciphertextB64: string, ivB64: string): Promise<string | null> {
  try {
    const decrypted = await decrypt(key, ciphertextB64, ivB64);
    if (decrypted === VERIFY_PLAINTEXT) {
      return await hashProof(decrypted);
    }
    return null;
  } catch {
    return null;
  }
}

export interface KeyData {
  name: string;
  value: string;
  category: string;
  tags: string[];
  notes: string;
}

export async function encryptKeyData(key: CryptoKey, data: KeyData): Promise<{ encrypted_data: string; iv: string }> {
  const json = JSON.stringify(data);
  const { ciphertext, iv } = await encrypt(key, json);
  return { encrypted_data: ciphertext, iv };
}

export async function decryptKeyData(key: CryptoKey, encryptedData: string, iv: string): Promise<KeyData | null> {
  try {
    const json = await decrypt(key, encryptedData, iv);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

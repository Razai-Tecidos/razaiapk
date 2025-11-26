import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

console.log('Reading .env from:', envPath);

try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) {
      env[key.trim()] = val.join('=').trim();
    }
  });

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const bucket = env.VITE_SUPABASE_BUCKET || 'backups';

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  console.log('Target:', url);
  console.log('Bucket:', bucket);
  console.log('Testing connection...');

  const listUrl = `${url}/storage/v1/object/list/${bucket}`;
  
  fetch(listUrl, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 5,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
      prefix: ''
    })
  })
  .then(async res => {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Status ${res.status}: ${text}`);
    }
    const data = await res.json();
    console.log('Connection SUCCESS!');
    console.log('Files found:', data.length);
    data.forEach(f => console.log(` - ${f.name} (${new Date(f.created_at).toLocaleString()})`));
  })
  .catch(err => {
    console.error('Connection FAILED:', err.message);
    process.exit(1);
  });

} catch (e) {
  console.error('Error reading .env:', e.message);
}

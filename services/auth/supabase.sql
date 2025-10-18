CREATE TABLE IF NOT EXISTS users(
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  email text UNIQUE NOT NULL,
  password_hash text,
  created_at timestamptz DEFAULT now()
);


CREATE TYPE todo_status AS enum(
  'not_started',
  'in_progress',
  'completed'
);

CREATE TABLE todo_lists(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid,
  is_deleted boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE todo_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES todo_lists(id) ON DELETE CASCADE,
  name text,
  description text,
  due_date timestamptz,
  status todo_status DEFAULT 'not_started',
  done boolean DEFAULT FALSE,
  media_url text,
  is_deleted boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER
  AS $$
BEGIN
  IF NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER update_todo_lists_updated_at
  BEFORE UPDATE ON todo_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todo_items_updated_at
  BEFORE UPDATE ON todo_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TYPE list_role AS ENUM(
  'owner',
  'editor',
  'viewer'
);

CREATE TABLE todo_list_members(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES todo_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ROLE list_role DEFAULT 'viewer',
  created_at timestamptz DEFAULT now(),
  UNIQUE (list_id, user_id)
);


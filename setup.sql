-- =====================================================
-- WhatsApp Clone - Database Schema Setup
-- =====================================================

-- 1. PROFILES TABLE
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'Hey there! I am using WhatsApp',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

-- 2. CONVERSATIONS TABLE
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_group BOOLEAN DEFAULT FALSE,
  group_name TEXT,
  group_avatar_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

-- 3. CONVERSATION MEMBERS TABLE
CREATE TABLE conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select" ON conversation_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "members_insert" ON conversation_members
  FOR INSERT WITH CHECK (true);

-- Conversations RLS (after members table)
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = id AND user_id = auth.uid()
    )
  );

-- 4. MESSAGES TABLE
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  image_url TEXT,
  image_key TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

-- 5. REALTIME CHANNELS
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES
  ('chat:%', 'Chat room channels for real-time messaging', true),
  ('user:%', 'User-specific notification channels', true);

-- 6. REALTIME TRIGGER ON MESSAGES
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'chat:' || NEW.conversation_id::text,
    'new_message',
    jsonb_build_object(
      'id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'content', NEW.content,
      'message_type', NEW.message_type,
      'image_url', NEW.image_url,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER messages_realtime
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Seed data for development
INSERT OR IGNORE INTO users (uid, name, email, password_hash, auth_provider, points, ref_code) VALUES
  ('demo-user-1', 'Alice', 'alice@example.com', '$HASH$demo123', 'email', 500, 'WTALICE1'),
  ('demo-user-2', 'Bob', 'bob@example.com', '$HASH$demo456', 'email', 1200, 'WTBOB001'),
  ('demo-user-3', 'Charlie', 'charlie@example.com', '$HASH$demo789', 'email', 3500, 'WTCHARL1');

INSERT OR IGNORE INTO point_transactions (user_id, amount, type, description) VALUES
  (1, 100, 'signup_bonus', 'Welcome bonus'),
  (1, 400, 'watch', 'Video watching rewards'),
  (2, 100, 'signup_bonus', 'Welcome bonus'),
  (2, 1100, 'watch', 'Video watching rewards'),
  (3, 100, 'signup_bonus', 'Welcome bonus'),
  (3, 3400, 'watch', 'Video watching rewards');

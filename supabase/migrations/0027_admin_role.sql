-- 0027: the 'admin' account role. On its own because a new enum value cannot
-- be used in the transaction that adds it; 0028 builds on it.
alter type user_role add value if not exists 'admin';

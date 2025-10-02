-- Check all users and their companies
SELECT
  u.id as user_id,
  u.email,
  c.id as company_id,
  c.name as company_name,
  cu.role
FROM auth.users u
LEFT JOIN company_users cu ON u.id = cu.user_id
LEFT JOIN companies c ON cu.company_id = c.id
ORDER BY u.email;

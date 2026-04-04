-- Add MEMBER value to UserRole enum
-- MEMBER = sem permissões de sistema; acesso definido apenas pelo papel personalizado
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MEMBER';

INSERT INTO tenants (id, created_at) VALUES ('staging-tenant', NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO banks (id, tenant_id, created_at) VALUES ('staging-bank', 'staging-tenant', NOW()) ON CONFLICT (tenant_id, id) DO NOTHING;

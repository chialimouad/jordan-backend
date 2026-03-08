# Fix Railway Deployment & Database Connection

1. Removed the IPv4 DNS force in `main.ts` since the Supabase instance only has an IPv6 address.
2. The user will need to enable IPv6 external network access in the Railway project settings.
3. The user will need to use the direct connection string (`:5432`).

## Plan: Operational Gaps To Close

1. Página Cutter Home: atualizar app/src/pages/CutterMode.tsx com DS/Mantine, mostrar estoque antes/depois, tratar erros Supabase e usar lib/platform + lib/db para modo offline.
2. Catálogo & Imagens: entregar rotas/serviços do README (Catálogo Novo) e publicar imagens locais no bucket para linkService.getImageUrl funcionar.
3. Mobile Auth & Busca: ajustar RazaiToolsMobile/context/AuthContext.tsx para usar profiles.role, parametrizar chaves em .env e reutilizar linkService.search com cache/offline-friendly no HomeScreen.
4. Stock Movements: garantir que StockOutFlow (mobile) e Cutter Mode (web) enviem p_user_id real e suportem ajustes/zeragem via stock-api.ts.
5. Offline & Sync: integrar fluxos críticos a lib/db + fila de sync, concluir Edge Function e políticas de Cloud Sync (README) para backup seguro.

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';

export async function generateTissuePdf(tissueId: string) {
  try {
    // Fetch Tissue
    const { data: tissue, error: tissueError } = await supabase
      .from('tissues')
      .select('*')
      .eq('id', tissueId)
      .single();
    
    if (tissueError) throw tissueError;

    // Fetch Links
    const { data: links, error: linksError } = await supabase
      .from('links')
      .select(`
        *,
        colors (*)
      `)
      .eq('tissue_id', tissueId)
      .eq('status', 'Ativo');

    if (linksError) throw linksError;

    if (!links || links.length === 0) {
      throw new Error('Não há cores vinculadas para gerar o PDF.');
    }

    // Prepare data with public URLs
    const linksWithUrls = links.map((l: any) => ({
      ...l,
      imageUrl: l.image_path 
        ? supabase.storage.from('tissue-images').getPublicUrl(l.image_path).data.publicUrl
        : null
    }));

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0; size: A4; }
          body { 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            margin: 0; 
            padding: 40px; 
            color: #111;
            background: #fff;
          }
          .header {
            margin-bottom: 30px;
            border-bottom: 2px solid #111;
            padding-bottom: 20px;
          }
          .brand {
            font-size: 14px;
            letter-spacing: 3px;
            text-transform: uppercase;
            font-weight: bold;
            color: #000;
            margin-bottom: 8px;
          }
          .title {
            font-size: 36px;
            font-weight: 300;
            margin: 0;
            margin-bottom: 12px;
            text-transform: capitalize;
          }
          .meta-grid {
            display: flex;
            gap: 40px;
            margin-top: 16px;
          }
          .meta-item {
            display: flex;
            flex-direction: column;
          }
          .meta-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #666;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }
          .meta-value {
            font-size: 16px;
            font-weight: 500;
          }
          .grid {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            justify-content: flex-start;
          }
          .card {
            width: 30%;
            margin-bottom: 30px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .image-container {
            width: 100%;
            aspect-ratio: 1;
            background-color: #f0f0f0;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
            border: 1px solid #eee;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .color-placeholder {
            width: 100%;
            height: 100%;
          }
          .info-name {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 4px;
            color: #000;
          }
          .info-sku {
            font-size: 12px;
            color: #666;
            font-family: monospace;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            font-size: 10px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">RAZAI</div>
          <h1 class="title">${tissue.name}</h1>
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Largura</span>
              <span class="meta-value">${tissue.width} cm</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Composição</span>
              <span class="meta-value">${tissue.composition || 'Não informada'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">SKU Base</span>
              <span class="meta-value">${tissue.sku}</span>
            </div>
          </div>
        </div>

        <div class="grid">
          ${linksWithUrls.map((l: any) => `
            <div class="card">
              <div class="image-container">
                ${l.imageUrl 
                  ? `<img src="${l.imageUrl}" />` 
                  : `<div class="color-placeholder" style="background-color: ${l.colors?.hex || '#eee'}"></div>`
                }
              </div>
              <div class="info-name">${l.colors?.name}</div>
              <div class="info-sku">${l.sku_filho}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="footer">
          Gerado em ${new Date().toLocaleDateString('pt-BR')} • RAZAI Tools
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    return true;

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

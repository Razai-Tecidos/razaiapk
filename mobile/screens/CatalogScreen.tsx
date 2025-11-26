import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ShareSheet from '../components/ShareSheet';

const WEB_APP_URL = 'https://razai-colaborador.vercel.app';

export default function CatalogScreen() {
  const [tissues, setTissues] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  useEffect(() => {
    fetchTissues();
  }, []);

  async function fetchTissues() {
    try {
      const { data, error } = await supabase.from('tissues').select('*').order('name');
      if (error) throw error;
      setTissues(data || []);
    } catch (error) {
      console.error('Error fetching tissues:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    if (selectedIds.size === tissues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tissues.map(t => t.id)));
    }
  }

  async function handleSharePdf() {
    if (selectedIds.size === 0) return;
    setGenerating(true);

    try {
      const ids = Array.from(selectedIds);
      
      // Fetch details for all selected tissues
      // We need links for each tissue
      const { data: linksData, error } = await supabase
        .from('links')
        .select(`
          *,
          tissues (*),
          colors (*)
        `)
        .in('tissue_id', ids)
        .eq('status', 'Ativo')
        .order('tissue_id'); // Group by tissue roughly

      if (error) throw error;

      // Group by tissue
      const grouped = new Map<string, { tissue: any, links: any[] }>();
      
      // Initialize with selected tissues to ensure order or existence even if empty
      // (Optional: fetch tissues again if needed, but we have them in 'tissues' state)
      ids.forEach(id => {
        const t = tissues.find(x => x.id === id);
        if (t) grouped.set(id, { tissue: t, links: [] });
      });

      linksData?.forEach(l => {
        if (grouped.has(l.tissue_id)) {
          grouped.get(l.tissue_id)?.links.push({
            ...l,
            imageUrl: l.image_path 
              ? supabase.storage.from('tissue-images').getPublicUrl(l.image_path).data.publicUrl
              : null
          });
        }
      });

      const sectionsHtml = Array.from(grouped.values()).map((group, index) => {
        const { tissue, links } = group;
        return `
          <div class="tissue-section" style="${index > 0 ? 'page-break-before: always;' : ''}">
            <div class="header">
              <div>
                <div class="brand">RAZAI</div>
                <h1 class="title">${tissue.name}</h1>
                <div class="meta">
                  Largura: ${tissue.width} cm • Composição: ${tissue.composition || 'N/A'}
                </div>
              </div>
            </div>

            <div class="grid">
              ${links.map(l => `
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
          </div>
        `;
      }).join('');

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
            .tissue-section {
              margin-bottom: 40px;
            }
            .header {
              margin-bottom: 30px;
              border-bottom: 1px solid #eee;
              padding-bottom: 20px;
            }
            .brand {
              font-size: 12px;
              letter-spacing: 2px;
              text-transform: uppercase;
              font-weight: bold;
              color: #000;
            }
            .title {
              font-size: 32px;
              font-weight: 300;
              margin: 0;
              margin-top: 10px;
            }
            .meta {
              font-size: 12px;
              color: #666;
              margin-top: 8px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }
            .card {
              break-inside: avoid;
              page-break-inside: avoid;
              margin-bottom: 20px;
            }
            .image-container {
              width: 100%;
              aspect-ratio: 1;
              background-color: #f5f5f5;
              border-radius: 4px;
              overflow: hidden;
              margin-bottom: 8px;
            }
            img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .color-placeholder {
              width: 100%;
              height: 100%;
            }
            .info-name {
              font-size: 14px;
              font-weight: 500;
              margin-bottom: 2px;
            }
            .info-sku {
              font-size: 11px;
              color: #999;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          ${sectionsHtml}
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

    } catch (error) {
      console.error('Error generating catalog:', error);
      Alert.alert('Erro', 'Falha ao gerar catálogo.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleShareLink() {
    const url = `${WEB_APP_URL}/vitrine`;
    try {
      await Share.share({
        message: `Confira nosso catálogo completo de tecidos: ${url}`,
        url: url,
      });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.title}>Catálogo</Text>
            <Text style={styles.subtitle}>Selecione os tecidos para exportar</Text>
          </View>
          <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
            <Text style={styles.selectAllText}>
              {selectedIds.size === tissues.length ? 'Desmarcar' : 'Todos'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : (
        <FlatList
          data={tissues}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.id);
            return (
              <TouchableOpacity 
                style={[styles.card, selected && styles.cardSelected]} 
                onPress={() => toggleSelection(item.id)}
              >
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, selected && styles.textSelected]}>{item.name}</Text>
                  <Text style={[styles.cardSubtitle, selected && styles.textSelected]}>{item.sku}</Text>
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, selectedIds.size === 0 && styles.buttonDisabled]}
          disabled={selectedIds.size === 0 || generating}
          onPress={() => setShareModalVisible(true)}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              Exportar ({selectedIds.size})
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ShareSheet 
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        onSharePdf={handleSharePdf}
        onShareLink={handleShareLink}
        title="Exportar Catálogo"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  selectAllBtn: {
    padding: 8,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
  },
  selectAllText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  textSelected: {
    color: '#2563eb',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  checkboxSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

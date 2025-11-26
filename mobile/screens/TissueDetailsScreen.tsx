import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Image, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import ShareSheet from '../components/ShareSheet';
import { generateTissuePdf } from '../lib/pdf';

const WEB_APP_URL = 'https://razai-colaborador.vercel.app';

export default function TissueDetailsScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [tissue, setTissue] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    try {
      // Fetch Tissue
      const { data: tissueData, error: tissueError } = await supabase
        .from('tissues')
        .select('*')
        .eq('id', id)
        .single();
      
      if (tissueError) throw tissueError;
      setTissue(tissueData);

      // Fetch Links
      const { data: linksData, error: linksError } = await supabase
        .from('links')
        .select(`
          *,
          colors (*)
        `)
        .eq('tissue_id', id)
        .eq('status', 'Ativo'); // Only active links?

      if (linksError) throw linksError;
      setLinks(linksData || []);

    } catch (error) {
      console.error('Error fetching tissue details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSharePdf() {
    setGeneratingPdf(true);
    try {
      await generateTissuePdf(id);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleShareLink() {
    const url = `${WEB_APP_URL}/vitrine/tecido/${id}`;
    try {
      await Share.share({
        message: `Confira o tecido ${tissue?.name} no nosso catálogo: ${url}`,
        url: url,
      });
    } catch (error) {
      console.error(error);
    }
  }

  function renderItem({ item }: { item: any }) {
    const imageUrl = item.image_path 
      ? supabase.storage.from('tissue-images').getPublicUrl(item.image_path).data.publicUrl
      : null;

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('LinkDetails', { id: item.id })}
      >
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: item.colors?.hex || '#ccc' }]} />
          )}
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.colors?.name}</Text>
        <Text style={styles.cardSku}>{item.sku_filho}</Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{tissue?.name}</Text>
          <Text style={styles.headerSubtitle}>{tissue?.sku}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => setShareModalVisible(true)} 
          style={styles.pdfBtn}
        >
          <Ionicons name="share-social-outline" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={links}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={<Text style={styles.emptyText}>Nenhum vínculo encontrado.</Text>}
      />

      <ShareSheet 
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        onSharePdf={handleSharePdf}
        onShareLink={handleShareLink}
      />

      {generatingPdf && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 10 }}>Gerando PDF...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  pdfBtn: {
    padding: 8,
  },
  listContent: {
    padding: 16,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  cardSku: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
});

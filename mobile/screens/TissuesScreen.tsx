import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Share, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import ShareSheet from '../components/ShareSheet';
import { generateTissuePdf } from '../lib/pdf';

const WEB_APP_URL = 'https://razai-colaborador.vercel.app';

export default function TissuesScreen({ navigation }: any) {
  const [tissues, setTissues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedTissue, setSelectedTissue] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchTissues();
  }, []);

  async function fetchTissues() {
    try {
      const { data, error } = await supabase.from('tissues').select('*').limit(20);
      if (error) throw error;
      setTissues(data || []);
    } catch (error) {
      console.error('Error fetching tissues:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSharePress(tissue: any) {
    setSelectedTissue(tissue);
    setShareModalVisible(true);
  }

  async function handleSharePdf() {
    if (!selectedTissue) return;
    setGenerating(true);
    try {
      await generateTissuePdf(selectedTissue.id);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível gerar o PDF. Verifique se há cores vinculadas.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleShareLink() {
    if (!selectedTissue) return;
    const url = `${WEB_APP_URL}/vitrine/tecido/${selectedTissue.id}`;
    try {
      await Share.share({
        message: `Confira o tecido ${selectedTissue.name} no nosso catálogo: ${url}`,
        url: url, // iOS only
      });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tecidos</Text>
        <Text style={styles.subtitle}>Lista de tecidos cadastrados</Text>
      </View>
      
      {loading ? (
        <Text style={styles.loading}>Carregando...</Text>
      ) : (
        <FlatList
          data={tissues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => navigation.navigate('TissueDetails', { id: item.id })}
            >
              <View style={styles.cardContent}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardSubtitle}>{item.sku} • {item.width}cm</Text>
                </View>
                <TouchableOpacity 
                  style={styles.shareBtn}
                  onPress={() => handleSharePress(item)}
                >
                  <Ionicons name="share-social-outline" size={24} color="#2563eb" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum tecido encontrado.</Text>}
        />
      )}

      <ShareSheet 
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        onSharePdf={handleSharePdf}
        onShareLink={handleShareLink}
      />

      {generating && (
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
  list: {
    padding: 16,
  },
  loading: {
    textAlign: 'center',
    marginTop: 40,
    color: '#666',
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  shareBtn: {
    padding: 8,
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

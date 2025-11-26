import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, TextInput, FlatList, Image, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen({ navigation }: any) {
  const { signOut } = useAuth();
  const [stats, setStats] = useState({ tissues: 0, colors: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [cutterMode, setCutterMode] = useState(false);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length > 1) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  async function fetchStats() {
    try {
      const [tissuesResponse, colorsResponse] = await Promise.all([
        supabase.from('tissues').select('*', { count: 'exact', head: true }),
        supabase.from('colors').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        tissues: tissuesResponse.count || 0,
        colors: colorsResponse.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function performSearch(query: string) {
    setSearching(true);
    try {
      // 1. Find matching Tissues
      const { data: tissues } = await supabase
        .from('tissues')
        .select('id')
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`);
      
      const tissueIds = tissues?.map(t => t.id) || [];

      // 2. Find matching Colors
      const { data: colors } = await supabase
        .from('colors')
        .select('id')
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`);
      
      const colorIds = colors?.map(c => c.id) || [];

      // 3. Find Links matching SKU OR Tissue OR Color
      let linkQuery = supabase
        .from('links')
        .select(`
          id,
          sku_filho,
          image_path,
          tissues!inner (name, sku),
          colors!inner (name, sku, hex)
        `)
        .limit(50);

      const conditions = [`sku_filho.ilike.%${query}%`];
      if (tissueIds.length > 0) conditions.push(`tissue_id.in.(${tissueIds.join(',')})`);
      if (colorIds.length > 0) conditions.push(`color_id.in.(${colorIds.join(',')})`);

      const { data: links, error } = await linkQuery.or(conditions.join(','));

      if (error) throw error;
      setSearchResults(links || []);

    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }

  async function handleShortage(item: any) {
    setSelectedItem(item);
    setQuantity(1);
    setModalVisible(true);
  }

  async function confirmShortage(type: 'ZERO' | 'QTY') {
    if (!selectedItem) return;
    
    try {
      if (type === 'ZERO') {
        // Get current stock
        const { data: stockData } = await supabase
          .from('stock_items')
          .select('quantity_rolls')
          .eq('link_id', selectedItem.id)
          .single();
        
        const currentQty = stockData?.quantity_rolls || 0;

        if (currentQty > 0) {
            await supabase.rpc('register_stock_movement', {
              p_link_id: selectedItem.id,
              p_type: 'OUT',
              p_quantity: currentQty,
              p_user_id: null
            });
        } else {
            // Ensure it is zeroed/initialized even if it was null
            await supabase.rpc('register_stock_movement', {
              p_link_id: selectedItem.id,
              p_type: 'ADJUST', // or OUT 0
              p_quantity: 0,
              p_user_id: null
            });
        }
      } else {
        // QTY
        await supabase.rpc('register_stock_movement', {
          p_link_id: selectedItem.id,
          p_type: 'OUT',
          p_quantity: quantity,
          p_user_id: null
        });
      }

      Alert.alert("Sucesso", "Estoque atualizado.");
      setModalVisible(false);
      setCutterMode(false);
      setSearchQuery('');
      setSelectedItem(null);
    } catch (e) {
      Alert.alert("Erro", "Falha ao atualizar estoque.");
      console.error(e);
    }
  }

  function renderSearchResult({ item }: { item: any }) {
    return (
      <LinkCard 
        item={item} 
        onPress={() => {
          if (cutterMode) {
            handleShortage(item);
          } else {
            navigation.navigate('LinkDetails', { id: item.id });
          }
        }} 
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, cutterMode && { backgroundColor: '#fef2f2' }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={[styles.title, { marginBottom: 0 }]}>{cutterMode ? 'Modo Cortador ✂️' : 'Razai Mobile'}</Text>
          <TouchableOpacity onPress={() => signOut()}>
            <Ionicons name="log-out-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchContainer, cutterMode && { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#ef4444' }]}>
          <Ionicons name="search" size={20} color={cutterMode ? '#ef4444' : "#666"} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={cutterMode ? "Busque o tecido que acabou..." : "Buscar tecido, cor ou código..."}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            placeholderTextColor={cutterMode ? '#f87171' : '#999'}
          />
          {searching && <ActivityIndicator size="small" color={cutterMode ? '#ef4444' : "#2563eb"} />}
        </View>
      </View>

      {searchQuery.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderSearchResult}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            !searching ? <Text style={styles.emptyText}>Nenhum resultado encontrado.</Text> : null
          }
        />
      ) : (
        <View style={styles.content}>
          <Text style={styles.subtitle}>Bem-vindo ao sistema de gestão</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              {loading ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text style={styles.statNumber}>{stats.tissues}</Text>
              )}
              <Text style={styles.statLabel}>Tecidos</Text>
            </View>
            <View style={styles.statCard}>
              {loading ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text style={styles.statNumber}>{stats.colors}</Text>
              )}
              <Text style={styles.statLabel}>Cores</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('Tecidos')}
          >
            <Text style={styles.buttonText}>Ver Tecidos</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, { marginTop: 16, backgroundColor: cutterMode ? '#dc2626' : '#fff', borderWidth: 1, borderColor: '#dc2626' }]}
            onPress={() => setCutterMode(!cutterMode)}
          >
            <Text style={[styles.buttonText, { color: cutterMode ? '#fff' : '#dc2626' }]}>
              {cutterMode ? 'Cancelar Aviso de Falta' : '✂️ Avisar Falta de Tecido'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Quantos acabaram?</Text>
            <Text style={styles.modalSubtitle}>{selectedItem?.tissues?.name} - {selectedItem?.colors?.name}</Text>
            
            <View style={styles.counterContainer}>
              <TouchableOpacity onPress={() => setQuantity(Math.max(1, quantity - 1))} style={styles.counterButton}>
                <Text style={styles.counterButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.counterValue}>{quantity}</Text>
              <TouchableOpacity onPress={() => setQuantity(quantity + 1)} style={styles.counterButton}>
                <Text style={styles.counterButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#2563eb', marginBottom: 12 }]}
              onPress={() => confirmShortage('QTY')}
            >
              <Text style={styles.buttonText}>Confirmar Saída ({quantity})</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#ef4444' }]}
              onPress={() => confirmShortage('ZERO')}
            >
              <Text style={[styles.buttonText, { color: '#dc2626' }]}>ACABOU TUDO (0)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={{ marginTop: 16, padding: 10 }}
              onPress={() => setModalVisible(false)}
            >
              <Text style={{ color: '#666', fontSize: 16 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalView: {
    width: '90%',
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center'
  },
  modalSubtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center'
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 8
  },
  counterButton: {
    width: 56,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  counterButtonText: {
    fontSize: 32,
    color: '#333',
    fontWeight: 'bold',
    lineHeight: 36
  },
  counterValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginHorizontal: 24,
    minWidth: 40,
    textAlign: 'center'
  },
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
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 40,
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnailContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  colorPreview: {
    width: '100%',
    height: '100%',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  resultColor: {
    fontWeight: '400',
    color: '#666',
  },
  resultSku: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
  },
});


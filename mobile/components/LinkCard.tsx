import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';

type LinkCardProps = {
  item: any;
  onPress: () => void;
};

export default function LinkCard({ item, onPress }: LinkCardProps) {
  const imageUrl = item.image_path 
    ? supabase.storage.from('tissue-images').getPublicUrl(item.image_path).data.publicUrl
    : null;

  return (
    <TouchableOpacity style={styles.resultItem} onPress={onPress}>
      <View style={styles.thumbnailContainer}>
        {imageUrl ? (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.thumbnail} 
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.colorPreview, { backgroundColor: item.colors?.hex || '#ccc' }]} />
        )}
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle}>
          {item.tissues?.name} <Text style={styles.resultColor}>• {item.colors?.name}</Text>
        </Text>
        <Text style={styles.resultSku}>{item.sku_filho}</Text>
      </View>
      <View style={styles.arrow}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  arrow: {
    marginLeft: 8,
  },
  arrowText: {
    fontSize: 20,
    color: '#ccc',
    fontWeight: '300',
  }
});

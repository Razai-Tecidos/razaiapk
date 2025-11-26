import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  onSharePdf: () => void;
  onShareLink: () => void;
  title?: string;
}

export default function ShareSheet({ visible, onClose, onSharePdf, onShareLink, title = "O que deseja compartilhar?" }: ShareSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color="#999" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.options}>
                <TouchableOpacity style={styles.option} onPress={() => { onClose(); onSharePdf(); }}>
                  <View style={[styles.iconContainer, { backgroundColor: '#fee2e2' }]}>
                    <Ionicons name="document-text" size={28} color="#ef4444" />
                  </View>
                  <Text style={styles.optionText}>PDF</Text>
                  <Text style={styles.optionSubtext}>Arquivo para impressão</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.option} onPress={() => { onClose(); onShareLink(); }}>
                  <View style={[styles.iconContainer, { backgroundColor: '#dbeafe' }]}>
                    <Ionicons name="link" size={28} color="#2563eb" />
                  </View>
                  <Text style={styles.optionText}>Link</Text>
                  <Text style={styles.optionSubtext}>Vitrine Digital</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  options: {
    flexDirection: 'row',
    gap: 16,
  },
  option: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionSubtext: {
    fontSize: 12,
    color: '#666',
  },
});

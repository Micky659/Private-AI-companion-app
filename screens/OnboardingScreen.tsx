// screens/OnboardingScreen.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { PersonalityTrait } from '../services/SystemPromptBuilder';

interface OnboardingScreenProps {
  onComplete: (data: OnboardingData) => void;
}

export interface OnboardingData {
  name: string;
  nickname?: string;
  role?: string;
  ageGroup?: string;
  gender?: string;
  traits: PersonalityTrait[];
}

type OnboardingStep = 'intro' | 'name' | 'nickname' | 'role' | 'basics' | 'personality';

const PERSONALITY_TRAITS: { trait: PersonalityTrait; emoji: string }[] = [
  { trait: 'nonchalant', emoji: '😎' },
  { trait: 'enthusiastic', emoji: '🎉' },
  { trait: 'pessimist', emoji: '🤔' },
  { trait: 'quirky', emoji: '🦄' },
  { trait: 'direct', emoji: '🎯' },
  { trait: 'empathetic', emoji: '💙' },
  { trait: 'formal', emoji: '👔' },
  { trait: 'witty', emoji: '✨' },
  { trait: 'stoic', emoji: '🗿' },
];

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState<OnboardingStep>('intro');
  const [data, setData] = useState<OnboardingData>({
    name: '',
    traits: [],
  });

  const [tempInput, setTempInput] = useState('');

  const handleNext = () => {
    const steps: OnboardingStep[] = ['intro', 'name', 'nickname', 'role', 'basics', 'personality'];
    const currentIndex = steps.indexOf(step);
    
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
      setTempInput('');
    }
  };

  const handleNameSubmit = () => {
    if (tempInput.trim()) {
      setData({ ...data, name: tempInput.trim() });
      handleNext();
    }
  };

  const handleNicknameSubmit = () => {
    setData({ ...data, nickname: tempInput.trim() || undefined });
    handleNext();
  };

  const handleRoleSubmit = () => {
    setData({ ...data, role: tempInput.trim() || undefined });
    handleNext();
  };

  const toggleTrait = (trait: PersonalityTrait) => {
    const currentTraits = data.traits;
    if (currentTraits.includes(trait)) {
      setData({ ...data, traits: currentTraits.filter(t => t !== trait) });
    } else if (currentTraits.length < 3) {
      setData({ ...data, traits: [...currentTraits, trait] });
    }
  };

  const handleComplete = () => {
    if (data.name && data.traits.length > 0) {
      onComplete(data);
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return (
          <View style={styles.contentContainer}>
            <Text style={styles.viText}>👋</Text>
            <Text style={styles.messageText}>
              Hey there. I'm Vi, your personal AI assistant.
            </Text>
            <Text style={styles.subText}>
              I live entirely on your device. No cloud, no tracking, just us.
            </Text>
            <Text style={styles.subText}>
              Let's get to know each other?
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Let's go</Text>
            </TouchableOpacity>
          </View>
        );

      case 'name':
        return (
          <View style={styles.contentContainer}>
            <Text style={styles.questionText}>What's your name?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Your name..."
              placeholderTextColor="#64748B"
              value={tempInput}
              onChangeText={setTempInput}
              autoFocus
              onSubmitEditing={handleNameSubmit}
            />
            <TouchableOpacity 
              style={[styles.primaryButton, !tempInput.trim() && styles.disabledButton]} 
              onPress={handleNameSubmit}
              disabled={!tempInput.trim()}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 'nickname':
        return (
          <View style={styles.contentContainer}>
            <Text style={styles.questionText}>
              Nice to meet you, {data.name}! Any nickname you prefer?
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Or just press Continue..."
              placeholderTextColor="#64748B"
              value={tempInput}
              onChangeText={setTempInput}
              autoFocus
              onSubmitEditing={handleNicknameSubmit}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleNicknameSubmit}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 'role':
        return (
          <View style={styles.contentContainer}>
            <Text style={styles.questionText}>What do you do?</Text>
            <Text style={styles.subText}>Your role, job, or passion</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Student, Engineer, Artist..."
              placeholderTextColor="#64748B"
              value={tempInput}
              onChangeText={setTempInput}
              autoFocus
              onSubmitEditing={handleRoleSubmit}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleRoleSubmit}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 'basics':
        return (
          <View style={styles.contentContainer}>
            <Text style={styles.questionText}>Cool. Just a couple more things...</Text>
            <Text style={styles.subText}>(Optional - helps me understand you better)</Text>
            
            <Text style={styles.labelText}>Age Group</Text>
            <View style={styles.chipRow}>
              {['18-24', '25-34', '35-44', '45+'].map(age => (
                <TouchableOpacity
                  key={age}
                  style={[styles.chip, data.ageGroup === age && styles.chipSelected]}
                  onPress={() => setData({ ...data, ageGroup: age })}
                >
                  <Text style={[styles.chipText, data.ageGroup === age && styles.chipTextSelected]}>
                    {age}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.labelText}>Gender</Text>
            <View style={styles.chipRow}>
              {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(gender => (
                <TouchableOpacity
                  key={gender}
                  style={[styles.chip, data.gender === gender && styles.chipSelected]}
                  onPress={() => setData({ ...data, gender })}
                >
                  <Text style={[styles.chipText, data.gender === gender && styles.chipTextSelected]}>
                    {gender}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 'personality':
        return (
          <View style={styles.contentContainer}>
            <Text style={styles.questionText}>How should I behave?</Text>
            <Text style={styles.subText}>Pick up to 3 traits</Text>
            
            <View style={styles.traitGrid}>
              {PERSONALITY_TRAITS.map(({ trait, emoji }) => {
                const isSelected = data.traits.includes(trait);
                const isDisabled = !isSelected && data.traits.length >= 3;
                
                return (
                  <TouchableOpacity
                    key={trait}
                    style={[
                      styles.traitChip,
                      isSelected && styles.traitChipSelected,
                      isDisabled && styles.traitChipDisabled,
                    ]}
                    onPress={() => toggleTrait(trait)}
                    disabled={isDisabled}
                  >
                    <Text style={styles.traitEmoji}>{emoji}</Text>
                    <Text style={[
                      styles.traitText,
                      isSelected && styles.traitTextSelected,
                    ]}>
                      {trait.charAt(0).toUpperCase() + trait.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, data.traits.length === 0 && styles.disabledButton]} 
              onPress={handleComplete}
              disabled={data.traits.length === 0}
            >
              <Text style={styles.primaryButtonText}>All Set 🚀</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Midnight Blue
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  contentContainer: {
    alignItems: 'center',
  },
  viText: {
    fontSize: 64,
    marginBottom: 24,
  },
  messageText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#E2E8F0',
    textAlign: 'center',
    marginBottom: 16,
  },
  questionText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#E2E8F0',
    textAlign: 'center',
    marginBottom: 12,
  },
  subText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  labelText: {
    fontSize: 14,
    color: '#CBD5E1',
    alignSelf: 'flex-start',
    marginTop: 20,
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    width: '100%',
    backgroundColor: '#1E293B',
    color: '#E2E8F0',
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  primaryButton: {
    backgroundColor: '#2DD4BF',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipSelected: {
    backgroundColor: '#2DD4BF',
    borderColor: '#2DD4BF',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#0F172A',
    fontWeight: '600',
  },
  traitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    marginBottom: 24,
  },
  traitChip: {
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    minWidth: 100,
  },
  traitChipSelected: {
    backgroundColor: '#2DD4BF',
    borderColor: '#2DD4BF',
  },
  traitChipDisabled: {
    opacity: 0.3,
  },
  traitEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  traitText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  traitTextSelected: {
    color: '#0F172A',
    fontWeight: '700',
  },
});
// App.tsx - Main app with navigation
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { dbService, UserProfile } from './services/SQLiteService';
import { buildSystemPrompt, PersonalityTrait } from './services/SystemPromptBuilder';
import OnboardingScreen, { OnboardingData } from './screens/OnboardingScreen';
import ChatScreen from './screens/ChatScreen';

const Tab = createBottomTabNavigator();

// Placeholder screens for other tabs
function NotesScreen() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderEmoji}>📝</Text>
      <Text style={styles.placeholderText}>Notes</Text>
      <Text style={styles.placeholderSubtext}>Coming in Phase 5</Text>
    </View>
  );
}

function ListsScreen() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderEmoji}>✅</Text>
      <Text style={styles.placeholderText}>Lists</Text>
      <Text style={styles.placeholderSubtext}>Coming in Phase 5</Text>
    </View>
  );
}

function GoalsScreen() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderEmoji}>🎯</Text>
      <Text style={styles.placeholderText}>Goals</Text>
      <Text style={styles.placeholderSubtext}>Coming in Phase 5</Text>
    </View>
  );
}

function MindmapScreen() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderEmoji}>🧠</Text>
      <Text style={styles.placeholderText}>Mindmap</Text>
      <Text style={styles.placeholderSubtext}>Coming in Phase 5</Text>
    </View>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    try {
      // Initialize database
      await dbService.init();

      // Check if user profile exists
      const existingUser = await dbService.getUser();

      if (existingUser) {
        setUserProfile(existingUser);
        
        // Build system prompt from saved profile
        const traits: PersonalityTrait[] = JSON.parse(existingUser.traits_json);
        const prompt = buildSystemPrompt({
          name: existingUser.name,
          nickname: existingUser.nickname,
          role: existingUser.role,
          traits,
        });
        
        setSystemPrompt(prompt);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('App initialization error:', error);
      setIsLoading(false);
    }
  }

  const handleOnboardingComplete = async (data: OnboardingData) => {
    try {
      // Save user profile to database
      const userId = await dbService.createUser({
        name: data.name,
        nickname: data.nickname,
        role: data.role,
        age_group: data.ageGroup,
        gender: data.gender,
        traits_json: JSON.stringify(data.traits),
      });

      // Fetch the saved profile
      const savedProfile = await dbService.getUser();
      setUserProfile(savedProfile);

      // Build system prompt
      const prompt = buildSystemPrompt({
        name: data.name,
        nickname: data.nickname,
        role: data.role,
        traits: data.traits,
      });
      
      setSystemPrompt(prompt);

      // Create default lists
      await dbService.createList('Groceries', 'grocery');
      await dbService.createList('To-Do', 'todo');
      await dbService.createList('Movies to Watch', 'movies');

      // Add initial mindmap node (central node)
      await dbService.addMindmapNode(data.name, 'personality', 1.0);

    } catch (error) {
      console.error('Onboarding save error:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2DD4BF" />
        <Text style={styles.loadingText}>Starting Vichar...</Text>
      </View>
    );
  }

  // Show onboarding if no user profile exists
  if (!userProfile) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // Main app with bottom tab navigation
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#2DD4BF',
          tabBarInactiveTintColor: '#64748B',
          tabBarLabelStyle: styles.tabBarLabel,
        }}
      >
        <Tab.Screen
          name="Chat"
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>💬</Text>,
          }}
        >
          {() => <ChatScreen systemPrompt={systemPrompt} />}
        </Tab.Screen>

        <Tab.Screen
          name="Notes"
          component={NotesScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📝</Text>,
          }}
        />

        <Tab.Screen
          name="Lists"
          component={ListsScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>✅</Text>,
          }}
        />

        <Tab.Screen
          name="Goals"
          component={GoalsScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🎯</Text>,
          }}
        />

        <Tab.Screen
          name="Mindmap"
          component={MindmapScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🧠</Text>,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
  },
  tabBar: {
    backgroundColor: '#1E293B',
    borderTopColor: '#334155',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#64748B',
  },
});
// About screen - app information, version, and help resources
import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  Image
} from 'react-native';
import { 
  Card, 
  Title, 
  List, 
  Button,
  useTheme,
  Text,
  Divider,
  Surface,
  Chip
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/Navigation';

type AboutNavigationProp = StackNavigationProp<RootStackParamList>;

const AboutScreen: React.FC = () => {
  const navigation = useNavigation<AboutNavigationProp>();
  const theme = useTheme();

  const appInfo = {
    name: 'Cocona',
    version: '1.0.0',
    buildNumber: '1',
    releaseDate: 'October 2025',
    developer: 'Saksham Gupta',
    description: 'A comprehensive expense management app built with React Native'
  };

  const handleOpenURL = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this link');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  const handleSendEmail = (type: 'feedback' | 'support' | 'bug') => {
    const subjects = {
      feedback: 'App Feedback',
      support: 'Support Request',
      bug: 'Bug Report'
    };
    
    const emailURL = `mailto:sakshamdev3+cocona@gmail.com?subject=${subjects[type]} - ${appInfo.name} v${appInfo.version}`;
    handleOpenURL(emailURL);
  };

  const features = [
    'Create and manage multiple expense books',
    'Track income and expenses with detailed categorization',
    'Visual analytics with charts and insights',
    'Custom categories with colors and icons',
    'Data export in CSV and JSON formats',
    'Secure local storage with AsyncStorage',
    'Material Design 3 interface',
    'Offline-first architecture'
  ];

  const technologies = [
    { name: 'React Native', version: '0.74' },
    { name: 'Expo', version: '54.0' },
    { name: 'React Native Paper', version: '5.x' },
    { name: 'AsyncStorage', version: '1.24' },
    { name: 'React Navigation', version: '7.x' },
    { name: 'TypeScript', version: '5.x' }
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        {/* App Info Header */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.appHeader}>
              <Image 
                source={require('../../assets/icon.png')} 
                style={styles.appIcon}
                resizeMode="contain"
              />
              <View style={styles.appInfo}>
                <Title style={{ color: theme.colors.onSurface }}>{appInfo.name}</Title>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  Version {appInfo.version} ({appInfo.buildNumber})
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Released {appInfo.releaseDate}
                </Text>
              </View>
            </View>
            
            <Text variant="bodyMedium" style={[styles.description, { color: theme.colors.onSurface }]}>
              {appInfo.description}
            </Text>
          </Card.Content>
        </Card>

        {/* Features */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Features</Title>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color={theme.colors.primary} />
                <Text variant="bodyMedium" style={[styles.featureText, { color: theme.colors.onSurface }]}>
                  {feature}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Technologies */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Built With</Title>
            <View style={styles.techContainer}>
              {technologies.map((tech, index) => (
                <Chip
                  key={index}
                  mode="outlined"
                  style={styles.techChip}
                  textStyle={{ fontSize: 12 }}
                >
                  {tech.name} {tech.version}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Feedback */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Feedback</Title>
            <List.Item
              title="Send Feedback"
              description="Share your thoughts and suggestions"
              left={(props) => <List.Icon {...props} icon="message" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => handleSendEmail('feedback')}
            />
          </Card.Content>
        </Card>

        {/* Connect */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Connect</Title>
            <List.Item
              title="LinkedIn"
              description="linkedin.com/in/sakshamgupta912"
              left={(props) => <List.Icon {...props} icon="linkedin" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => handleOpenURL('https://linkedin.com/in/sakshamgupta912')}
            />
            <Divider />
            <List.Item
              title="GitHub"
              description="github.com/sakshamgupta912"
              left={(props) => <List.Icon {...props} icon="github" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => handleOpenURL('https://github.com/sakshamgupta912')}
            />
          </Card.Content>
        </Card>

        {/* Legal */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Legal</Title>
            <List.Item
              title="Privacy Policy"
              description="How we handle your data"
              left={(props) => <List.Icon {...props} icon="shield-lock" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => Alert.alert('Privacy Policy', 'Cocona respects your privacy. All data is stored locally on your device and is never shared with third parties without your explicit consent.')}
            />
            <Divider />
            <List.Item
              title="Terms & Conditions"
              description="Terms of use"
              left={(props) => <List.Icon {...props} icon="file-document" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => Alert.alert(
                'Terms & Conditions',
                'By using Cocona, you agree to:\n\n' +
                '1. Use the app for personal expense tracking purposes\n' +
                '2. Maintain the security of your device and data\n' +
                '3. Not attempt to reverse engineer or modify the app\n' +
                '4. Accept that the app is provided "as is" without warranties\n' +
                '5. Understand that you are responsible for backing up your data\n\n' +
                'The developer is not liable for any data loss or damages arising from app usage.'
              )}
            />
          </Card.Content>
        </Card>

        {/* Developer Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Developer</Title>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              Developed with ❤️ by {appInfo.developer}
            </Text>
            <Text variant="bodySmall" style={[styles.copyright, { color: theme.colors.onSurfaceVariant }]}>
              © 2025 {appInfo.developer}. All rights reserved.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginRight: 16,
  },
  appInfo: {
    flex: 1,
  },
  description: {
    lineHeight: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  featureText: {
    marginLeft: 8,
    flex: 1,
  },
  techContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  techChip: {
    marginBottom: 4,
  },
  copyright: {
    marginTop: 8,
    textAlign: 'center',
  },
});

export default AboutScreen;
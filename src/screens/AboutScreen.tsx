// About screen - app information, version, and help resources
import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Alert
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
    name: 'ExpenseBudgetApp',
    version: '1.0.0',
    buildNumber: '1',
    releaseDate: 'September 2025',
    developer: 'Your Development Team',
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
    
    const emailURL = `mailto:support@example.com?subject=${subjects[type]} - ${appInfo.name} v${appInfo.version}`;
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
              <Surface style={[styles.appIcon, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                <MaterialIcons name="account-balance-wallet" size={32} color={theme.colors.onPrimaryContainer} />
              </Surface>
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

        {/* Help & Support */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Help & Support</Title>
            <List.Item
              title="User Guide"
              description="Learn how to use all app features"
              left={(props) => <List.Icon {...props} icon="book-open" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => handleOpenURL('https://github.com')}
            />
            <Divider />
            <List.Item
              title="FAQ"
              description="Frequently asked questions"
              left={(props) => <List.Icon {...props} icon="help-circle" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => handleOpenURL('https://github.com')}
            />
            <Divider />
            <List.Item
              title="Video Tutorials"
              description="Watch step-by-step guides"
              left={(props) => <List.Icon {...props} icon="play-circle" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => handleOpenURL('https://youtube.com')}
            />
          </Card.Content>
        </Card>

        {/* Contact */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Contact</Title>
            <List.Item
              title="Send Feedback"
              description="Share your thoughts and suggestions"
              left={(props) => <List.Icon {...props} icon="message" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => handleSendEmail('feedback')}
            />
            <Divider />
            <List.Item
              title="Get Support"
              description="Need help with the app?"
              left={(props) => <List.Icon {...props} icon="support" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => handleSendEmail('support')}
            />
            <Divider />
            <List.Item
              title="Report Bug"
              description="Found an issue? Let us know"
              left={(props) => <List.Icon {...props} icon="bug-report" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => handleSendEmail('bug')}
            />
          </Card.Content>
        </Card>

        {/* Social & Links */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Connect</Title>
            <List.Item
              title="Source Code"
              description="View on GitHub"
              left={(props) => <List.Icon {...props} icon="code" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => handleOpenURL('https://github.com')}
            />
            <Divider />
            <List.Item
              title="Website"
              description="Visit our website"
              left={(props) => <List.Icon {...props} icon="web" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => handleOpenURL('https://example.com')}
            />
            <Divider />
            <List.Item
              title="Privacy Policy"
              description="How we handle your data"
              left={(props) => <List.Icon {...props} icon="privacy-tip" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => handleOpenURL('https://example.com/privacy')}
            />
            <Divider />
            <List.Item
              title="Terms of Service"
              description="Terms and conditions"
              left={(props) => <List.Icon {...props} icon="description" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => handleOpenURL('https://example.com/terms')}
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
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
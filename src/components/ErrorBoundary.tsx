import React, { Component, ReactNode } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, Card, useTheme } from 'react-native-paper';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log error details for debugging
    const errorDetails = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    };
    
    console.error('Error details:', errorDetails);
    
    // Optionally show alert for critical errors
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      Alert.alert(
        'App Update Required',
        'Please restart the app to get the latest updates.',
        [{ text: 'OK' }]
      );
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry }) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.error }]}>
            Something went wrong
          </Text>
          
          <Text variant="bodyMedium" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
            We encountered an unexpected error. This has been logged and our team will look into it.
          </Text>
          
          {__DEV__ && error && (
            <View style={styles.errorDetails}>
              <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                Error Details (Development Mode):
              </Text>
              <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.outline }]}>
                {error.message}
              </Text>
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={onRetry}
              style={styles.retryButton}
            >
              Try Again
            </Button>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorDetails: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    alignItems: 'center',
  },
  retryButton: {
    minWidth: 120,
  },
});

export default ErrorBoundary;
// Manual Transaction Entry Dialog - Quick add transactions for AI prediction
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Dialog,
  Portal,
  Text,
  TextInput,
  Button,
  HelperText,
} from 'react-native-paper';
import { spacing } from '../theme/materialTheme';

interface ManualEntryDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: { amount: number; description: string; date: Date }) => Promise<void>;
}

export const ManualEntryDialog: React.FC<ManualEntryDialogProps> = ({
  visible,
  onDismiss,
  onSubmit,
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; description?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { amount?: string; description?: string } = {};

    // Validate amount
    const amountNum = parseFloat(amount);
    if (!amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Amount must be a positive number';
    }

    // Validate description
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.trim().length < 3) {
      newErrors.description = 'Description must be at least 3 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        amount: parseFloat(amount),
        description: description.trim(),
        date: new Date(),
      });

      // Reset form
      setAmount('');
      setDescription('');
      setErrors({});
      onDismiss();
    } catch (error) {
      console.error('Error submitting manual entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setAmount('');
    setDescription('');
    setErrors({});
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleCancel}>
        <Dialog.Title>Add Transaction Manually</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Enter transaction details. AI will predict the book, category, and payment mode.
          </Text>

          {/* Amount Input */}
          <TextInput
            label="Amount *"
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              if (errors.amount) setErrors({ ...errors, amount: undefined });
            }}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
            error={!!errors.amount}
            left={<TextInput.Affix text="₹" />}
            disabled={isSubmitting}
          />
          {errors.amount && (
            <HelperText type="error" visible={true}>
              {errors.amount}
            </HelperText>
          )}

          {/* Description Input */}
          <TextInput
            label="Description *"
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (errors.description) setErrors({ ...errors, description: undefined });
            }}
            mode="outlined"
            style={styles.input}
            error={!!errors.description}
            placeholder="e.g., Amazon Order, Swiggy Delivery"
            disabled={isSubmitting}
          />
          {errors.description && (
            <HelperText type="error" visible={true}>
              {errors.description}
            </HelperText>
          )}

          <HelperText type="info" visible={true}>
            💡 Tip: Include merchant name for better predictions
          </HelperText>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onPress={handleSubmit}
            mode="contained"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Add Transaction
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    marginBottom: spacing.md,
    opacity: 0.8,
  },
  input: {
    marginBottom: spacing.xs,
  },
});

import { getFunctions, httpsCallable } from 'firebase/functions';

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  message: string;
}

export interface PaymentData {
  amount: number;
  email: string;
  reference: string;
  metadata?: Record<string, any>;
}

class PaymentService {
  constructor() { }

  async initializeMockPayment(data: PaymentData): Promise<PaymentResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      transactionId: `MOCK-${Date.now()}`,
      message: 'Mock payment initialized',
    };
  }

  async initializeMonnifyPayment(orderId: string, amount: number, user: { name: string; email: string }): Promise<PaymentResult & { accountDetails?: any }> {
    try {
      const functions = getFunctions();
      const initializeMonnifyTransaction = httpsCallable(functions, 'initializeMonnifyTransaction');

      const result: any = await initializeMonnifyTransaction({
        orderId,
        amount,
        customerName: user.name,
        customerEmail: user.email
      });

      const data = result.data;
      if (data.success) {
        return {
          success: true,
          message: 'Virtual account created',
          accountDetails: {
            accountNumber: data.accountNumber,
            accountName: data.accountName,
            bankName: data.bankName,
            reference: data.reference
          }
        };
      } else {
        return { success: false, message: data.error || 'Failed to initialize Monnify' };
      }
    } catch (error: any) {
      console.error('Monnify Init Error:', error);
      return { success: false, message: error.message || 'Error initializing Monnify' };
    }
  }

  generatePaymentReference(): string {
    return `ABM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const paymentService = new PaymentService();

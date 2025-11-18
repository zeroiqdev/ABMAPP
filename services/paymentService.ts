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
  private paystackPublicKey: string;
  private flutterwavePublicKey: string;

  constructor() {
    this.paystackPublicKey = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
    this.flutterwavePublicKey = process.env.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '';
  }

  async initializePaystackPayment(data: PaymentData): Promise<PaymentResult> {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.paystackPublicKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: data.amount * 100,
          email: data.email,
          reference: data.reference,
          metadata: data.metadata,
        }),
      });

      const result = await response.json();

      if (result.status) {
        return {
          success: true,
          transactionId: result.data.reference,
          message: 'Payment initialized successfully',
        };
      } else {
        return {
          success: false,
          message: result.message || 'Payment initialization failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Payment initialization failed',
      };
    }
  }

  async initializeFlutterwavePayment(data: PaymentData): Promise<PaymentResult> {
    try {
      const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.flutterwavePublicKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: data.reference,
          amount: data.amount,
          currency: 'NGN',
          redirect_url: 'abmapp://payment-callback',
          customer: {
            email: data.email,
          },
          meta: data.metadata,
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        return {
          success: true,
          transactionId: result.data.tx_ref,
          message: 'Payment initialized successfully',
        };
      } else {
        return {
          success: false,
          message: result.message || 'Payment initialization failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Payment initialization failed',
      };
    }
  }

  async verifyPaystackPayment(reference: string): Promise<PaymentResult> {
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.paystackPublicKey}`,
          },
        }
      );

      const result = await response.json();

      if (result.status && result.data.status === 'success') {
        return {
          success: true,
          transactionId: result.data.reference,
          message: 'Payment verified successfully',
        };
      } else {
        return {
          success: false,
          message: 'Payment verification failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Payment verification failed',
      };
    }
  }

  async verifyFlutterwavePayment(transactionId: string): Promise<PaymentResult> {
    try {
      const response = await fetch(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.flutterwavePublicKey}`,
          },
        }
      );

      const result = await response.json();

      if (result.status === 'success' && result.data.status === 'successful') {
        return {
          success: true,
          transactionId: result.data.tx_ref,
          message: 'Payment verified successfully',
        };
      } else {
        return {
          success: false,
          message: 'Payment verification failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Payment verification failed',
      };
    }
  }

  generatePaymentReference(): string {
    return `ABM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const paymentService = new PaymentService();


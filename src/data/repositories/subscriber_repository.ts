import { Subscriber, ScanLog, FinanceLog } from "../../domain/entities/subscriber.ts";

export class SubscriberRepository {
  async register(subscriber: Subscriber): Promise<string> {
    const response = await fetch('/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriber),
    });

    if (!response.ok) {
      throw new Error('Failed to register subscriber');
    }

    const data = await response.json();
    return data.id;
  }

  async getSubscriber(id: string, token: string): Promise<Subscriber> {
    const response = await fetch(`/api/subscribers/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscriber');
    }

    return response.json();
  }

  async getAllSubscribers(token: string): Promise<Subscriber[]> {
    const response = await fetch(`/api/subscribers`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscribers');
    }

    return response.json();
  }

  async verifySubscriber(id: string, token: string): Promise<void> {
    const response = await fetch(`/api/subscribers/${id}/verify`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to verify subscriber');
    }
  }

  async renewSubscriber(id: string, token: string): Promise<Subscriber> {
    const response = await fetch(`/api/subscribers/${id}/renew`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to renew subscriber');
    }
    
    const data = await response.json();
    return data.subscriber;
  }

  async renewSessionSubscriber(id: string, token: string): Promise<Subscriber> {
    const response = await fetch(`/api/subscribers/${id}/renew-session`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to renew session');
    }
    
    const data = await response.json();
    return data.subscriber;
  }

  async deleteSubscriber(id: string, token: string): Promise<void> {
    const response = await fetch(`/api/subscribers/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete subscriber');
    }
  }

  async updateSubscriber(id: string, subscriber: Partial<Subscriber>, token: string): Promise<Subscriber> {
    const response = await fetch(`/api/subscribers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(subscriber)
    });

    if (!response.ok) {
      throw new Error('Failed to update subscriber');
    }
    
    const data = await response.json();
    return data.subscriber;
  }

  async logScan(subscriberId: string, token: string): Promise<{subscriber: Subscriber, scanLog: ScanLog}> {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscriberId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (errorData?.expired) {
        throw { isExpired: true, message: errorData.error, subscriber: errorData.subscriber };
      }
      throw new Error(errorData?.error || 'Failed to log scan');
    }

    return response.json();
  }

  async getAllScanLogs(token: string): Promise<ScanLog[]> {
    const response = await fetch('/api/scans', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch scan logs');
    }

    return response.json();
  }

  async getFinanceLogs(token: string): Promise<FinanceLog[]> {
    const response = await fetch('/api/finance', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch finance logs');
    }

    return response.json();
  }

  async deleteScanLog(id: string, token: string): Promise<void> {
    const response = await fetch(`/api/scans/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete scan log');
    }
  }

  async updateScanLog(id: string, scannedAt: string, token: string): Promise<ScanLog> {
    const response = await fetch(`/api/scans/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ scannedAt })
    });

    if (!response.ok) {
      throw new Error('Failed to update scan log');
    }

    const data = await response.json();
    return data.scanLog;
  }
}

export const subscriberRepository = new SubscriberRepository();

export interface Subscriber {
  id?: string;
  fullName: string;
  age: number;
  gender: string;
  guardianName?: string;
  whatsappNumber: string;
  previousExperience?: string;
  classType: 'Parkour' | 'Tricking';
  packageType: string;
  receiptImageBase64: string;
  isVerified: boolean;
  activeUntil?: string;
  createdAt?: string;
}

export const CLASS_RULES = {
  Parkour: {
    minAge: 3,
    maxAge: 99,
    schedule: "Sunday Only (6:00 PM - 7:00 PM)",
    allowedDays: [0],
    startTime: "18:00",
    endTime: "19:00",
    packages: {
      Monthly: { price: 200, sessions: 4 },
      Trial: { price: 50, sessions: 1 }
    }
  },
  Tricking: {
    minAge: 6,
    maxAge: 99,
    schedule: "Saturday and Sunday (7:00 PM - 8:00 PM)",
    allowedDays: [0, 6],
    startTime: "19:00",
    endTime: "20:00",
    packages: {
      Monthly: { price: 240, sessions: 4 },
      Trial: { price: 60, sessions: 1, note: "Saturdays only" }
    }
  }
};

export interface ScanLog {
  id: string;
  subscriberId: string;
  scannedAt: string;
  subscriberName?: string;
  subscriberClass?: string;
  subscriberPackage?: string;
  subscriberRegistrationDate?: string;
}

export interface FinanceLog {
  id: string;
  subscriberId: string;
  amount: number;
  type: string;
  date: string;
  subscriberName?: string;
  subscriberClass?: string;
}
